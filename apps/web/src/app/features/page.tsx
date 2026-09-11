import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Card, CTA, NotBuilt, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';
import { COMPONENT_COUNT, TRIGGER_COUNT } from '@/lib/components.data';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'What the application does today: a real runtime, a capability broker, a typed canvas, native version history, and a CLI — everything cross-checked by tests, nothing implied that is not built.',
};

const BUILT = [
  {
    title: 'A typed canvas',
    body: 'Place components, connect them, and the connection is checked on the spot against one rule table both the editor and the runtime read — an illegal connection is impossible to draw, not merely discouraged.',
  },
  {
    title: 'A real runtime',
    body: 'Validation, topological scheduling, execution, and a journal of exactly what each step did — sequential by design, and the same engine behind the desktop app and the CLI.',
  },
  {
    title: 'The capability broker',
    body: 'The only code that touches OS authority, including for components that ship with the product. A refusal is recorded with a reason; an allowance is recorded too.',
  },
  {
    title: `${COMPONENT_COUNT} components + ${TRIGGER_COUNT} triggers`,
    body: 'Files, images, data, flow control, the network, the system clipboard and notifications. Small on purpose — see the full catalogue.',
  },
  {
    title: 'Triggers and sessions',
    body: 'Watch a folder or run on a timer, and the workflow starts itself per event rather than waiting for a person to press a button each time.',
  },
  {
    title: 'Native project versioning',
    body: 'A .encastra file is a deterministic ZIP with its own version history — create, restore, compare — with no external database.',
  },
  {
    title: 'A CLI',
    body: 'The same runtime, headless, with the entire permission model expressible as flags — encastra run --allow-write step=./folder is not a simplification of the desktop app, it is the same engine.',
  },
  {
    title: 'Image processing, with real limits',
    body: 'Resize, convert, thumbnail, and read metadata — with a decoder that refuses an image claiming an impossible size before it allocates anything.',
  },
];

export default function FeaturesPage(): ReactNode {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Features"
        title="What the application does today"
        lead="Every item below is either an automated test or something you can do in the palette right now. Nothing here is a roadmap item dressed up as a feature."
      />

      <div className={`grid ${styles.grid}`}>
        {BUILT.map((item) => (
          <Card key={item.title}>
            <div className={styles.card}>
              <StatusBadge state="built" />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <SectionHeading
        eyebrow="Not yet"
        title="What is designed, and what is only that"
        lead="Stated here rather than left for somebody to discover by clicking a dead link — the interface should never promise something that does not exist."
      />

      <NotBuilt
        state={STATUS.wasmSandbox}
        title="Third-party components, in a WebAssembly sandbox"
        blockedBy={[
          'A host crate that loads a WIT-defined component with no ambient authority',
          'Per-node timeouts, fuel metering and a memory ceiling',
          'Signing and a revocation list, so an installed component can be verified',
        ]}
      >
        <p>
          The design is written down — see /security — and none of it runs. Every component in this
          build is first-party and in-process; a manifest declaring{' '}
          <code>kind: &quot;wasm&quot;</code> fails immediately with <code>no-implementation</code>.
        </p>
      </NotBuilt>

      <div className={styles.notBuilt}>
        <NotBuilt
          state={STATUS.registry}
          title="A registry, a marketplace, and installing a new component"
          blockedBy={[
            'The Wasm sandbox above',
            'A backend: auth, users, projects',
            'A publishing and review path',
          ]}
        >
          <p>
            Nothing you use today came from anywhere but the box it shipped in. See{' '}
            <a href="/marketplace">/marketplace</a> and <a href="/community">/community</a> for what
            those pages say about themselves.
          </p>
        </NotBuilt>
      </div>

      <div className={styles.cta}>
        <CTA href="/components">See every component in detail</CTA>
      </div>
    </div>
  );
}
