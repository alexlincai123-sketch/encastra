// Ask the page itself what is on it, over the Chrome DevTools Protocol.
//
// Why this exists at all, next to a harness that drives everything else through UI Automation.
//
// gui_journeys.ps1 asserts that a step was placed on the canvas by looking for an element whose
// AutomationId is `node-<id>` — the id ComponentNode.tsx writes. It never found one, in any run,
// and the negative was a measurement artefact rather than a product failure. Two facts, both
// established against the running application:
//
//   * Chromium publishes a `<div>` with no ARIA role as role `generic` with an empty name, and it
//     does NOT publish the element's `id` as an AutomationId. A dump of the whole accessibility
//     tree of the Builder contains zero nodes referencing `node-*`. So UI Automation can never see
//     a canvas step by its id: the thing the harness was waiting for does not exist in the tree it
//     was waiting in. Not "usually absent" — absent by construction.
//   * React Flow's `onlyRenderVisibleElements` unmounts nodes outside the viewport. `addNode`
//     places each new step at `rightmost.x + 260`, so from the third step on a node is inserted
//     into the DOM and removed again about three milliseconds later. Clicking Fit View brings them
//     all back.
//
// The canvas is therefore observed through the DOM, which is where it exists, and the native parts
// — the choosers, the dialogs, the sidebar — stay on UI Automation, which is what UI Automation is
// for. This file is the smallest thing that can ask the page a question: no npm dependency, no
// browser driver, one WebSocket, the global one Node has had since 22.
//
// The port is exposed only because the harness launches the application with
// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222. That flag is test-only; see
// docs/security/AI-AGENT-SURFACE.md for what an open debugging port means and why no shipped
// configuration sets it.
//
// Usage:
//   node scripts/verify/cdp.mjs --port 9222 eval "<js expression>"
//   node scripts/verify/cdp.mjs --port 9222 wait "<js expression>" --timeout-ms 5000 --interval-ms 100
//
// `eval` prints the JSON of what the expression evaluated to. `wait` polls it until it is truthy
// and prints that value. Either prints {"error": "..."} and exits 1 instead — including when the
// expression itself throws, which is a different answer from `false` and is never reported as one.

const APP_TITLE = 'encastra';

function parseArgs(argv) {
  const opts = { port: 9222, timeoutMs: 5000, intervalMs: 100 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(argv[++i]);
    else if (a === '--interval-ms') opts.intervalMs = Number(argv[++i]);
    else rest.push(a);
  }
  opts.command = rest[0];
  opts.expression = rest.slice(1).join(' ');
  return opts;
}

function fail(message) {
  process.stdout.write(`${JSON.stringify({ error: String(message) })}\n`);
  process.exit(1);
}

// The page target, named rather than guessed at: a WebView2 process also publishes service-worker
// and other targets, and connecting to one of those would evaluate the expression somewhere the
// interface is not. When there is no such page the list of what there was is the whole diagnosis.
async function pageTarget(port) {
  let targets;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json`);
    targets = await response.json();
  } catch (error) {
    throw new Error(
      `no CDP endpoint on 127.0.0.1:${port} (${error.message}); the application has to be started with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=${port}`,
    );
  }
  const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const named = pages.find((t) =>
    String(t.title ?? '')
      .toLowerCase()
      .includes(APP_TITLE),
  );
  if (named) return named;
  const seen = targets.map((t) => `${t.type}:'${t.title}'`).join(' ') || '(no targets at all)';
  throw new Error(`no page target titled like '${APP_TITLE}' on port ${port}; targets: ${seen}`);
}

class Session {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 0;
    this.pending = new Map();
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(this));
      this.ws.addEventListener('error', () =>
        reject(new Error('the CDP WebSocket would not open')),
      );
      this.ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      });
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} did not answer within 30s`));
      }, 30000);
    });
  }

  // An expression that throws is reported as a throw. Collapsing it to undefined would let a typo
  // in a selector read as "the thing is not there", which is the class of mistake this whole file
  // exists to stop making.
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception?.description ?? details.text ?? 'the expression threw');
    }
    return result.result.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // A socket that is already gone needs no closing, and saying so helps nobody.
    }
  }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.command !== 'eval' && opts.command !== 'wait') {
  fail(`usage: cdp.mjs [--port N] eval|wait "<js expression>" [--timeout-ms N] [--interval-ms N]`);
}
if (!opts.expression) fail('no expression given');

let session;
try {
  const target = await pageTarget(opts.port);
  session = await new Session(target.webSocketDebuggerUrl).open();
  if (opts.command === 'eval') {
    const value = await session.evaluate(opts.expression);
    process.stdout.write(`${JSON.stringify(value ?? null)}\n`);
    session.close();
    process.exit(0);
  }
  const deadline = Date.now() + opts.timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await session.evaluate(opts.expression);
    if (last) {
      process.stdout.write(`${JSON.stringify(last)}\n`);
      session.close();
      process.exit(0);
    }
    await new Promise((resolve) => setTimeout(resolve, opts.intervalMs));
  }
  session.close();
  fail(`still falsy after ${opts.timeoutMs}ms (last value ${JSON.stringify(last ?? null)})`);
} catch (error) {
  session?.close();
  fail(error.message);
}
