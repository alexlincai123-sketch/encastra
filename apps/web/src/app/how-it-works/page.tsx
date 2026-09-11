import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { FlowStep, NodeState } from '@/components/graph/Graph';
import { GraphFlow, GraphNode } from '@/components/graph/Graph';
import { PermissionMock } from '@/components/ui/PermissionMock';
import { StepSection } from '@/components/ui/StepSection';
import { ButtonRow, CTA, PageHeader, SourceRef } from '@/components/ui/Ui';
import { componentNode, findComponent } from '@/lib/graph-nodes';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'The six steps every Encastra workflow goes through, from picking a component to reading the journal of a finished run — shown with the same diagrams the editor uses, not screenshots.',
};

const READ = componentNode('encastra.file.read');
const PARSE = componentNode('encastra.data.json');
const WRITE = componentNode('encastra.file.write');
const NOTIFY = componentNode('encastra.system.notify');
const RESIZE = componentNode('encastra.image.resize');
const SAVE_CAPABILITY = findComponent('encastra.file.save').capabilities[0];

const CONNECTED_FLOW: readonly FlowStep[] = [
  { node: READ },
  { node: PARSE, wire: { type: 'string', label: 'TEXT → TEXT' } },
  { node: WRITE, wire: { type: 'json', label: 'JSON → TEXT · stringify-json' } },
  { node: NOTIFY, wire: { type: 'bool', label: 'BOOL → TEXT' } },
];

const RUN_STATES: Readonly<Record<string, NodeState>> = {
  [READ.id]: 'ok',
  [PARSE.id]: 'ok',
  [WRITE.id]: 'failed',
  [NOTIFY.id]: 'skipped',
};

const PALETTE_PREVIEW = [
  'encastra.file.watch',
  'encastra.image.resize',
  'encastra.flow.if',
  'encastra.net.http',
  'encastra.data.csv.read',
  'encastra.system.timer',
] as const;

export default function HowItWorksPage(): ReactNode {
  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow="How it works"
          title="Six steps, every time"
          lead="A workflow that watches a folder and one that runs once and stops go through the same shape. Nothing below is a screenshot — every diagram is the same node-and-wire language the editor renders, built from the real component manifests."
        />
      </div>

      <StepSection
        number={1}
        title="Choose"
        visual={
          <ul className={styles.palette}>
            {PALETTE_PREVIEW.map((id) => {
              const node = componentNode(id);
              return (
                <li key={id} className={styles.paletteItem}>
                  <span>{node.name}</span>
                  <span>{node.id.split('.').slice(0, 2).join('.')}</span>
                </li>
              );
            })}
          </ul>
        }
      >
        <p className="lead">
          The palette lists every component available to you — nineteen, plus two triggers. Each
          states what it does in one sentence, the same sentence everywhere it appears: on the
          block, in the palette, and in the <a href="/components">component catalogue</a>.
        </p>
        <p className="prose">
          Components are deliberately narrow. A block that resized an image and saved it and sent a
          notification would be easy to use once and impossible to reuse. Kept narrow, the same
          Resize Image block serves a photo workflow, a thumbnail workflow, and one nobody has built
          yet.
        </p>
      </StepSection>

      <StepSection
        number={2}
        title="Drag"
        reverse
        visual={
          <div className={styles.canvas}>
            <span className={styles.canvasGhost} aria-hidden="true" />
            <GraphNode node={RESIZE} />
          </div>
        }
      >
        <p className="lead">
          Place a block on the canvas. Nothing about the workflow exists yet except this one step —
          it has no connections and will not run on its own.
        </p>
        <p className="prose">
          The canvas is reachable entirely from the keyboard, not only a mouse — a block that could
          not be selected without one would leave its settings and its permission prompt unreachable
          to anyone who cannot use one.
        </p>
      </StepSection>

      <StepSection
        number={3}
        title="Connect"
        caption="examples/json-report, unconnected to a run"
        visual={<GraphFlow steps={CONNECTED_FLOW} dense />}
      >
        <p className="lead">
          Draw a line from an output to an input and the type system decides, on the spot, whether
          it fits — before the workflow exists, not when it fails halfway through a run.
        </p>
        <p className="prose">
          Same type fits silently. A narrower type into a wider one — an image into a file — fits
          silently too. A wider type into a narrower one is legal but never silent: a visible
          conversion appears on the wire, because a claim that can be wrong needs a place to fail.
          Sideways — an image into a video — is refused outright; both are kinds of file, and being
          siblings is not a relationship that converts.
        </p>
        <p className="prose">
          The graph on the right is <code>examples/json-report</code>, the same one quoted in the
          README: read a file, parse it as JSON, write it back out, then notify. Its three
          connections show all three kinds at once — a same-type wire, an explicit conversion, and
          an implicit one.
        </p>
      </StepSection>

      <StepSection
        number={4}
        title="Configure permissions"
        reverse
        caption="What the inspector shows for Save File — reconstructed from its real manifest, not a screenshot, and not an interactive control on this page."
        visual={
          <PermissionMock
            kind={SAVE_CAPABILITY?.kind ?? 'fs.write'}
            reason={
              SAVE_CAPABILITY?.reason ??
              'Saves the file into the folder you pick. It cannot write anywhere else.'
            }
            scope={SAVE_CAPABILITY?.scope ?? 'chosen-folder'}
            location="C:\Users\you\out"
          />
        }
      >
        <p className="lead">
          A step that needs to reach something outside the graph — a folder, a network address, a
          notification — asks for exactly that, with a sentence written for the person deciding, not
          the name of the capability.
        </p>
        <p className="prose">
          Declaring is not being granted. A component that asks for <code>fs.write</code> still
          cannot write anything until a person presses the button, and the button stays disabled
          until a folder is actually chosen — a grant with nothing attached is an unbounded grant,
          and the application will not offer one.
        </p>
      </StepSection>

      <StepSection
        number={5}
        title="Run"
        caption="One refusal does not discard the work that already succeeded"
        visual={<GraphFlow steps={CONNECTED_FLOW} states={RUN_STATES} activeIndex={3} dense />}
      >
        <p className="lead">
          Press run and every step&rsquo;s state changes as it happens — waiting, running, finished,
          failed, skipped — with timing shown while it is still useful to watch.
        </p>
        <p className="prose">
          This is the same graph, actually run, with no folder yet allowed for Save File — the exact
          transcript quoted in the README. <code>Write File</code> is refused, and{' '}
          <code>Notify</code> is skipped because the step it depended on did not finish. The first
          two steps still completed; a run with one refusal is reported as partly finished, not as a
          crash.
        </p>
      </StepSection>

      <StepSection
        number={6}
        title="Inspect"
        reverse
        visual={
          <div className={styles.journalCard}>
            <div className={styles.journalHead}>
              <strong>Write File</strong>
              <code>encastra.file.write@1.0.0</code>
            </div>
            <dl className={styles.journalList}>
              <dt>State</dt>
              <dd>failed · 0ms</dd>
              <dt>Input</dt>
              <dd>content: text (62 characters)</dd>
              <dt>Capability</dt>
              <dd>
                <code>fs.write</code> — refused
              </dd>
              <dt>Reason</dt>
              <dd>no folder has been allowed for this node</dd>
            </dl>
          </div>
        }
      >
        <p className="lead">
          Select the failed step and the inspector shows the journal: what went in, what came out,
          how long it took, and every permission the broker saw — allowed or refused.
        </p>
        <p className="prose">
          The journal describes values rather than quoting them — a length, a shape, a handle number
          — never the contents of a file. It is written to be pasted into a bug report without
          anyone&rsquo;s data leaving with it.
        </p>
        <SourceRef
          path="crates/encastra-builtins/tests/image_processor.rs"
          note="the automated version of this checkpoint"
        />
      </StepSection>

      <section className="section">
        <div className="page">
          <div className="stack">
            <p className="lead">
              This is what the whole product does today — nothing here waits on a feature that is
              not built yet.
            </p>
            <ButtonRow>
              <CTA href="/tutorials">Build the same workflow yourself</CTA>
              <CTA href="/download" variant="secondary">
                Download the beta
              </CTA>
            </ButtonRow>
          </div>
        </div>
      </section>
    </div>
  );
}
