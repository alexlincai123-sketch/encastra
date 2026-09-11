import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, CTA, PageHeader, SectionHeading, SourceRef } from '@/components/ui/Ui';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'What the capability broker enforces, what every first-party component asks for, what is deliberately absent, and — stated as plainly as the source document — what none of this protects against.',
};

const SCOPES = [
  {
    scope: 'InputHandles',
    body: 'Only what the graph wired to this node’s ports. No decision needed — it adds nothing you have not already said by drawing a line.',
  },
  {
    scope: 'Directory(path)',
    body: 'One folder you chose. Nothing outside it. Symlinks are resolved, not followed out.',
  },
  {
    scope: 'HttpHosts(list)',
    body: 'The exact hosts you allowed. An empty list is not “all hosts” — it is no hosts.',
  },
  {
    scope: 'Allowed',
    body: 'A plain yes, for a capability with nothing to parameterise, such as showing a notification.',
  },
] as const;

const ASKS_FOR = [
  { component: 'Read File', kind: 'fs.read', scope: 'input-handles' },
  {
    component: 'Write File · Save File · Move File · Rename File',
    kind: 'fs.write',
    scope: 'chosen-folder',
  },
  {
    component: 'Resize Image · Convert Image · Thumbnail · Image Info',
    kind: 'fs.read',
    scope: 'input-handles',
  },
  { component: 'Parse JSON · Write JSON · Read CSV · Write CSV', kind: 'nothing', scope: '—' },
  { component: 'If · Switch · Delay', kind: 'nothing', scope: '—' },
  { component: 'Notify', kind: 'system.notify', scope: 'notifications' },
  { component: 'Copy to Clipboard', kind: 'system.clipboard', scope: 'write' },
  { component: 'HTTP Request', kind: 'net.http', scope: 'allowed-hosts' },
  { component: 'Watch Folder (trigger)', kind: 'fs.read', scope: 'watched-folder' },
  { component: 'Timer (trigger)', kind: 'nothing', scope: '—' },
] as const;

const ABSENT = [
  {
    title: 'Process execution',
    body: 'There is no process.* capability anywhere in the build. The manifest validator holds an allowlist of five capability kinds and refuses any other. No consent dialog can ever be made to offer one.',
  },
  {
    title: 'A webhook listener',
    body: 'Receiving a request means listening on a port, which is a different security question from making one. It belongs with future trigger work, not with the HTTP client that exists today.',
  },
  {
    title: 'Video information',
    body: 'Reading a container’s metadata honestly needs a parser this build does not have. probe-video and probe-audio remain declared-but-unimplemented conversions rather than a component that returns guesses.',
  },
  {
    title: 'A native plugin escape hatch',
    body: 'There is no path for a third party to reach the trusted, in-process tier, and none is planned. If one ever appears, the security story described on this page is gone.',
  },
] as const;

export default function SecurityPage(): ReactNode {
  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow="Security"
          title="The capability model, stated with its limits"
          lead="This page does not claim the product is secure. It describes what the capability broker actually enforces, and — as plainly as the strengths — what it does not."
        />

        <div className={styles.intro}>
          <Callout tone="warn" title="Reviewed, not audited">
            Encastra has been security reviewed by the people who wrote it. It has not been
            externally reviewed by anyone else, and the sandbox boundary that matters most for a
            stranger&rsquo;s code does not exist in this build yet. An external audit is a
            prerequisite before anything resembling a marketplace could launch.
          </Callout>
        </div>

        <SectionHeading
          eyebrow="The broker"
          title="One gate, for every component, including the ones that ship with the product"
          lead="crates/encastra-core/src/broker.rs is the only code in the runtime that touches OS authority. A core component that did not declare fs.read cannot open a file, because it asks the broker and the broker refuses — there is a test that proves it. Routing trusted code through the same gate as an untrusted one means the permission dialog cannot lie about what it enforces."
        />

        <div className={`grid ${styles.scopeGrid}`}>
          {SCOPES.map((item) => (
            <Card key={item.scope}>
              <div className={styles.scopeCard}>
                <h3>{item.scope}</h3>
                <p>{item.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow="What each component asks for"
            title="No component asks for more than its job needs"
            lead="This table is also a test: nothing_first_party_quietly_asks_for_more_than_it_needs holds the same list in code and fails the build if a component's declared capabilities change without the change being deliberate."
          />
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Asks for</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {ASKS_FOR.map((row) => (
                  <tr key={row.component}>
                    <td>{row.component}</td>
                    <td>
                      <code>{row.kind}</code>
                    </td>
                    <td>{row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceRef path="docs/SECURITY.md" note="§7, with the full reasoning" />
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow="Deliberately absent"
            title="These are not denied. They do not exist."
            lead="Four capabilities a component might plausibly ask for, and why none of them can be granted in this build."
          />
          <div className={`grid ${styles.absentGrid}`}>
            {ABSENT.map((item) => (
              <Card key={item.title}>
                <div className={styles.absentCard}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow="Known limitations"
            title="What the model does not do"
            lead="Stated plainly, because a security page that only lists controls is marketing. This is the current version of docs/SECURITY.md §9 — kept here in the same words the reference document uses."
          />
          <div className={`prose ${styles.limitations}`}>
            <ol>
              <li>
                <strong>The sandbox does not exist yet.</strong> Third-party components cannot
                execute at all. A <code>kind: &quot;wasm&quot;</code> node fails with{' '}
                <code>no-implementation</code>. Everything running today is first-party and
                in-process.
              </li>
              <li>
                <strong>Nothing is signed and nothing is verified.</strong> Ed25519 signing, a
                counter-signing registry, and a signed revocation list are specified and not
                implemented. There is no registry to install from.
              </li>
              <li>
                <strong>No timeout, fuel ceiling or memory ceiling on a step.</strong> Cancellation
                is a cooperative flag. A component that loops without checking it is not stopped.
              </li>
              <li>
                <strong>The broker has no sensitive-location deny-list.</strong> It checks that a
                request stays inside a folder you granted; it does not check whether that folder was
                somewhere it should have refused in the first place. Grant a system directory and
                you have granted a system directory.
              </li>
              <li>
                <strong>Secrets are declared and never resolved.</strong> A workflow can mark a
                variable secret; nothing reads it and there is no keystore integration. A secret
                value cannot reach the project file — that guarantee is real and tested — but a
                workflow needing a token has nowhere safe to put one yet.
              </li>
              <li>
                <strong>Grants are per run and are not remembered.</strong> There is no record of
                what has been allowed before, and no distinction between &ldquo;allowed once&rdquo;
                and &ldquo;allowed always&rdquo;.
              </li>
              <li>
                <strong>The desktop bridge trusts its own front end.</strong> That is the correct
                trust relationship — the WebView is first-party — but it means a scripting bug in
                the editor would be a grant-forging bug, not merely a defacement.
              </li>
              <li>
                <strong>No external audit.</strong> This model has been reviewed by the people who
                built it and by the automated test suite. That is not the same thing.
              </li>
              <li>
                <strong>Side channels are out of scope.</strong> Speculative-execution and timing
                attacks from within a future WebAssembly guest against host memory are not defended
                against and are not analysed.
              </li>
            </ol>
          </div>
          <SourceRef path="docs/SECURITY.md" note="§9, the authoritative and current version" />
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow="Found something"
            title="Reporting a vulnerability"
            lead="Please do not open a public issue for a security problem. A public report starts a clock that the people who can fix it may not be able to beat."
          />
          <Callout tone="note">
            <p>
              A published security address does not exist yet — the domain in this project&rsquo;s
              identifiers is not registered, so any address you might infer from this site goes
              nowhere. Until one is published, report through the repository host&rsquo;s private
              vulnerability reporting, or see the coordinated-disclosure draft for what to include.
            </p>
          </Callout>
          <div className={styles.disclosureCta}>
            <CTA href="/legal/security-disclosure" variant="secondary">
              Read the disclosure draft
            </CTA>
          </div>
        </div>
      </section>
    </div>
  );
}
