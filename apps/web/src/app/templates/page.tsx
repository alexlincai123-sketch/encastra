import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { FlowStep, GraphNodeSpec } from '@/components/graph/Graph';
import { GraphBranch, GraphFlow } from '@/components/graph/Graph';
import { PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { componentNode } from '@/lib/graph-nodes';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Templates',
  description:
    'The three workflows that ship with the application — Image Processor, File Organiser and Thumbnails. Ordinary graphs, run on the same runtime as anything you build, with their folders deliberately left empty.',
};

const WATCH = componentNode('encastra.file.watch');
const RESIZE = componentNode('encastra.image.resize');
const SAVE = componentNode('encastra.file.save');
const THUMBNAIL = componentNode('encastra.image.thumbnail');
const SWITCH = componentNode('encastra.flow.switch');
const MOVE = componentNode('encastra.file.move');

const IMAGES_ARM: GraphNodeSpec = {
  ...MOVE,
  id: 'file-organiser-images',
  name: 'Move File → images',
};
const DOCUMENTS_ARM: GraphNodeSpec = {
  ...MOVE,
  id: 'file-organiser-documents',
  name: 'Move File → documents',
};

const IMAGE_PROCESSOR_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
  { node: SAVE, wire: { type: 'image', label: 'IMAGE → FILE' } },
];

const THUMBNAILS_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: THUMBNAIL, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
  { node: SAVE, wire: { type: 'image', label: 'IMAGE → FILE' } },
];

const ORGANISER_TRUNK: readonly FlowStep[] = [
  { node: WATCH },
  { node: SWITCH, wire: { type: 'string', label: 'EXTENSION → MATCH' } },
];

const ORGANISER_ARMS: readonly FlowStep[] = [{ node: IMAGES_ARM }, { node: DOCUMENTS_ARM }];

export default function TemplatesPage(): ReactNode {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Templates"
        title="Workflows that ship with the app"
        lead="Three demos, and they double as end-to-end test fixtures — not screenshots. Each one arrives with its folders deliberately empty, the same reason a workflow you send somebody else arrives with no permissions granted."
      />

      <div className={styles.template}>
        <div className={styles.head}>
          <h2>Image Processor</h2>
          <StatusBadge state="built" />
        </div>
        <p className={styles.summary}>
          Watches a folder. Whenever an image appears, it makes a smaller copy in another folder —
          the same checkpoint quoted in the README, and the workflow{' '}
          <a href="/tutorials">the tutorial</a> builds from scratch.
        </p>
        <div className={styles.needs}>
          <span className={styles.needsItem}>A folder to watch</span>
          <span className={styles.needsItem}>A folder to save into</span>
        </div>
        <div className={styles.diagram}>
          <GraphFlow steps={IMAGE_PROCESSOR_FLOW} dense />
        </div>
      </div>

      <div className={styles.template}>
        <div className={styles.head}>
          <h2>File Organiser</h2>
          <StatusBadge state="built" />
        </div>
        <p className={styles.summary}>
          Watches a folder and moves what lands in it into one of three others, by file type. The
          extension decides the route; the file itself is what travels along it.
        </p>
        <div className={styles.needs}>
          <span className={styles.needsItem}>A folder to watch</span>
          <span className={styles.needsItem}>A folder for images</span>
          <span className={styles.needsItem}>A folder for documents</span>
        </div>
        <div className={styles.diagram}>
          <GraphBranch
            trunk={ORGANISER_TRUNK}
            arms={ORGANISER_ARMS}
            caption="A third route, for anything else, is wired but not shown here"
          />
        </div>
      </div>

      <div className={styles.template}>
        <div className={styles.head}>
          <h2>Thumbnails</h2>
          <StatusBadge state="built" />
        </div>
        <p className={styles.summary}>
          Turns a folder of images into square previews, ready for a gallery or a grid. Unlike Image
          Processor, this one processes files already sitting in the folder when it starts.
        </p>
        <div className={styles.needs}>
          <span className={styles.needsItem}>A folder to watch</span>
          <span className={styles.needsItem}>A folder to save into</span>
        </div>
        <div className={styles.diagram}>
          <GraphFlow steps={THUMBNAILS_FLOW} dense />
        </div>
      </div>

      <section className="section">
        <SectionHeading
          eyebrow="One rule"
          title="Every template is an ordinary graph"
          lead="Nothing about these three is privileged. They run through the same validation, the same capability broker, and the same runtime as a workflow you build from an empty canvas — which is also why they make honest test fixtures rather than curated screenshots."
        />
      </section>
    </div>
  );
}
