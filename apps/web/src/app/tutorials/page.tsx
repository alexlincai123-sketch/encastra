import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { FlowStep } from '@/components/graph/Graph';
import { GraphFlow, GraphNode } from '@/components/graph/Graph';
import { PermissionMock } from '@/components/ui/PermissionMock';
import { StepSection } from '@/components/ui/StepSection';
import { ButtonRow, Callout, Card, CTA, PageHeader, SectionHeading } from '@/components/ui/Ui';
import type { ConfigRecord } from '@/lib/components.types';
import { componentNode, findComponent } from '@/lib/graph-nodes';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Build your first workflow',
  description:
    'The one tutorial written out in full: watch a folder, resize what lands in it, save a smaller copy somewhere else. The same three blocks the project uses as its own proof that everything works.',
};

const WATCH = componentNode('encastra.file.watch');
const RESIZE = componentNode('encastra.image.resize');
const SAVE = componentNode('encastra.file.save');

const WATCH_CAP = findComponent('encastra.file.watch').capabilities[0];
const SAVE_CAP = findComponent('encastra.file.save').capabilities[0];

const CONNECT_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
];

const FULL_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
  { node: SAVE, wire: { type: 'image', label: 'IMAGE → FILE' } },
];

function SettingsTable({ config }: { config: readonly ConfigRecord[] }): ReactNode {
  return (
    <div className={`table-scroll ${styles.settings}`}>
      <table className="data">
        <thead>
          <tr>
            <th>Setting</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {config.map((field) => (
            <tr key={field.key}>
              <td>
                <strong>{field.label}</strong>
                {field.required ? ' (required)' : ''}
              </td>
              <td>{field.doc ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TutorialsPage(): ReactNode {
  const watchConfig = findComponent('encastra.file.watch').config;
  const resizeConfig = findComponent('encastra.image.resize').config;
  const saveConfig = findComponent('encastra.file.save').config;

  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow="Learn"
          title="Build your first workflow"
          lead="A workflow that sits and watches a folder. Every time you drop a photo into it, a smaller copy appears in a different folder, automatically. This is the same three blocks the project uses as its own proof that everything works — there is an automated test that puts a real 800×400 PNG in and checks a real 200×100 PNG comes out, and if it fails the product is considered broken."
        />
        <dl className={styles.meta}>
          <div>
            <dt>Time</dt>
            <dd>About ten minutes, most of it reading</dd>
          </div>
          <div>
            <dt>Needs</dt>
            <dd>Encastra installed, and one image file to test with</dd>
          </div>
        </dl>

        <SectionHeading eyebrow="Before you start" title="Make two folders" />
        <p className="prose">
          Two separate folders, not one. If the workflow wrote its results back into the folder it
          was watching, the watcher would notice the result and process it again, and the result of
          that again. Keeping them apart avoids the whole class of problem.
        </p>
        <div className={`grid ${styles.folders}`}>
          <Card>
            <div className={styles.folder}>
              <strong>inbox</strong>
              <p>The folder you will drop photos into.</p>
              <code>./inbox</code>
            </div>
          </Card>
          <Card>
            <div className={styles.folder}>
              <strong>out</strong>
              <p>The folder the smaller copies will appear in.</p>
              <code>./out</code>
            </div>
          </Card>
        </div>
      </div>

      <StepSection
        number={1}
        title="An empty canvas"
        visual={
          <p className="prose">
            Open Encastra. From <strong>Home</strong>, start a new workflow. You land in{' '}
            <strong>Builder</strong>, looking at three areas: the <strong>palette</strong> on one
            side, listing every block available to you; the <strong>canvas</strong> in the middle,
            currently empty; and the <strong>inspector</strong> on the other side, which fills in
            when you select a block.
          </p>
        }
      >
        <p className="lead">Nothing is on the canvas yet. That is the whole of this step.</p>
      </StepSection>

      <StepSection
        number={2}
        title="Add Watch Folder"
        reverse
        visual={<GraphNode node={WATCH} highlighted />}
      >
        <p className="lead">
          Find <strong>Watch Folder</strong> in the palette and put it on the canvas, towards the
          left. It notices when a file appears in a folder and starts the workflow.
        </p>
        <p className="prose">
          It is a <strong>trigger</strong>, which is a different kind of block from the rest: it has
          no inputs, because nothing feeds it — it is the thing that begins. It gives out three
          outputs; you only need <code>file</code> for this workflow.
        </p>
        <SettingsTable config={watchConfig} />
      </StepSection>

      <StepSection
        number={3}
        title="Add Resize Image"
        visual={<GraphNode node={RESIZE} highlighted />}
      >
        <p className="lead">
          Put <strong>Resize Image</strong> on the canvas to the right of the watcher. It changes an
          image&rsquo;s size, and nothing else — it does not save anything, and Step 5 explains why
          that matters.
        </p>
        <SettingsTable config={resizeConfig} />
      </StepSection>

      <StepSection
        number={4}
        title="The first connection, and what it means"
        reverse
        caption="watch.file → resize.image — legal, and not silent"
        visual={<GraphFlow steps={CONNECT_FLOW} dense />}
      >
        <p className="lead">
          Drag from the watcher&rsquo;s <code>file</code> output to the resizer&rsquo;s{' '}
          <code>image</code> input. A connection says: when this step produces its result, hand it
          to that one — and it decides the order, because you never schedule anything.
        </p>
        <p className="prose">
          The watcher&rsquo;s <code>file</code> port is typed File; the resizer&rsquo;s{' '}
          <code>image</code> port is typed Image. Those are not the same type, and Image is the
          narrower of the two — every image is a file, but not every file is an image. Connecting a
          File to an Image is a claim that this file really is one, and that claim can be wrong. So
          the connection is allowed, but it is not silent: <code>decode-image</code> appears on the
          wire, a conversion where a file that turns out to be a text document has somewhere visible
          to fail.
        </p>
        <p className="prose">
          What travels along the line is not a path. The resizer receives a <strong>handle</strong>{' '}
          — an opaque ticket meaning &ldquo;the file you were given&rdquo; — and can look at nothing
          else, which is why the permission question in Step 6 is narrow enough to be worth
          answering.
        </p>
      </StepSection>

      <StepSection
        number={5}
        title="Add Save File"
        caption="watch.file → resize.image → save.file"
        visual={<GraphFlow steps={FULL_FLOW} dense />}
      >
        <p className="lead">
          Put <strong>Save File</strong> to the right of the resizer, and connect the
          resizer&rsquo;s <code>image</code> output to Save File&rsquo;s <code>file</code> input.
          That connection needs no conversion — an Image going into a File input is a{' '}
          <em>widening</em>, which can never fail.
        </p>
        <p className="prose">
          Why does the resizer not just save its own result? The resizer writes into scratch space
          belonging to the run, which is not anywhere you can see and needs no permission from you.
          Putting a file somewhere you <em>can</em> see is a different act, and it is the act that
          has to ask — so Save File is the one block that does, and you always know which step
          touches your disk.
        </p>
        <SettingsTable config={saveConfig} />
      </StepSection>

      <StepSection
        number={6}
        title="Permissions, and why you are being asked"
        reverse
        visual={
          <div className={styles.permissions}>
            <PermissionMock
              kind={WATCH_CAP?.kind ?? 'fs.read'}
              reason={
                WATCH_CAP?.reason ??
                'Watches the folder you pick and reads the files that appear in it.'
              }
              scope={WATCH_CAP?.scope ?? 'watched-folder'}
              location="C:\Users\you\inbox"
            />
            <PermissionMock
              kind={SAVE_CAP?.kind ?? 'fs.write'}
              reason={
                SAVE_CAP?.reason ??
                'Saves the file into the folder you pick. It cannot write anywhere else.'
              }
              scope={SAVE_CAP?.scope ?? 'chosen-folder'}
              location="C:\Users\you\out"
            />
          </div>
        }
      >
        <p className="lead">
          Select Watch Folder again and look at the inspector: below its settings is a{' '}
          <strong>Permissions</strong> section. Select Save File and you find its own. Press{' '}
          <strong>Allow this folder</strong> on both.
        </p>
        <p className="prose">
          What you just agreed to is not &ldquo;this workflow may read and write files&rdquo;. You
          agreed that this watcher may read inside that one folder, and that this Save File block
          may write inside that other one folder — nothing outside it, and a second Save File block
          would be a second, separate decision.
        </p>
        <p className="prose">
          Notice what Resize Image is <em>not</em> asking for: nothing. It only ever sees what the
          workflow handed it, which is not a decision, because you already said so by drawing the
          line.
        </p>
        <Callout tone="note">
          These last one run. They are not saved into the file and not remembered between runs — if
          you send this workflow to somebody, it arrives able to do nothing until they answer for
          themselves.
        </Callout>
      </StepSection>

      <StepSection
        number={7}
        title="Run it"
        visual={
          <div className="prose">
            <p>
              Notice the button does not say <em>Run</em>. It says <strong>Start watching</strong>,
              because this workflow begins with a trigger: it waits, rather than doing a thing once
              and stopping. A dot in the toolbar and a counter in the status bar tell you it is
              live.
            </p>
            <p>
              Drop a photo into <code>inbox</code>. Within a second or so the three blocks light up
              in turn, a smaller copy appears in <code>out</code>, and the status bar counts one
              run. Each file is its own run — drop three more in and watch it happen three more
              times.
            </p>
          </div>
        }
      >
        <p className="lead">
          Press <strong>Ctrl</strong> + <strong>Enter</strong>, or the button in the toolbar.
        </p>
        <p className="prose">
          There is a short pause before anything happens on purpose: the watcher checks the folder
          about twice a second, then waits until the file has stopped changing size before handing
          it on. A large photo copied from a network drive keeps growing for a few seconds after it
          appears, and handing that to the resizer would fail in a way that looks like your
          workflow&rsquo;s fault.
        </p>
      </StepSection>

      <StepSection
        number={8}
        title="Look at what happened"
        reverse
        visual={
          <Card>
            <strong>Resize Image</strong>
            <p className="prose">finished · 38ms</p>
            <p className="prose">image: 800×400 in → image: 200×100 out</p>
            <p className="prose">fs.read — allowed (input-handles)</p>
          </Card>
        }
      >
        <p className="lead">
          After it stops, the inspector shows the <strong>journal</strong> — the record of the run.
          Select the resizer and you see what state it ended in, how long it took, and every
          permission request the gate saw, allowed or refused.
        </p>
        <p className="prose">
          The journal describes values rather than quoting them — never the contents of your
          photographs. Nothing is written to disk in this build; close the application and this
          record is gone.
        </p>
      </StepSection>

      <StepSection
        number={9}
        title="Save it"
        visual={
          <p className="prose">
            <strong>Ctrl</strong> + <strong>S</strong>. You get a single <code>.encastra</code> file
            holding the graph, the settings on each block, and a version history you can look back
            through and restore from. It does not hold your permissions, and it cannot hold a secret
            — the place that would store one does not exist in the format.
          </p>
        }
      >
        <p className="lead">
          One file. You can email it, put it in a repository, or rename it — nothing about it
          depends on the machine that wrote it.
        </p>
      </StepSection>

      <section className="section">
        <div className="page">
          <SectionHeading eyebrow="When it refuses to run" title="This is the system working" />
          <p className="prose">
            If you run before granting a permission, or change a folder afterwards so the grant no
            longer matches:
          </p>
          <p className={styles.refusal}>
            {'denied: This component tried to use fs.write and was not allowed: no folder has\n' +
              'been allowed for this node.\n' +
              'Grant this component access to a folder, then run again.'}
          </p>
          <p className="prose">
            Select the step, check the Permissions section, press the button again. The rest of the
            workflow still ran — steps that depended on the refused one are marked skipped, with the
            reason.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading eyebrow="Try breaking it" title="What to change next" />
          <div className={`grid ${styles.changeGrid}`}>
            <Card>
              <h3>Swap the resizer</h3>
              <p>
                Replace Resize Image with Thumbnail to get square previews instead of a scaled copy.
              </p>
            </Card>
            <Card>
              <h3>Add a notification</h3>
              <p>
                Put Notify after Save File. It needs its own permission — a plain Allow, since there
                is nothing to narrow about a notification.
              </p>
            </Card>
            <Card>
              <h3>Force a format</h3>
              <p>
                Put Convert Image between the resizer and Save File to write everything as WebP.
              </p>
            </Card>
            <Card>
              <h3>Take a permission away</h3>
              <p>Run it again with a folder ungranted, just to watch it refuse properly.</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <div className="stack">
            <p className="lead">
              Two demo workflows ship alongside the one you just built: File Organiser and
              Thumbnails, both with their folders deliberately left empty.
            </p>
            <ButtonRow>
              <CTA href="/templates">See the shipped templates</CTA>
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
