import { describe, expect, it } from 'vitest';
import {
  type Accepts,
  type Connectable,
  candidateTargets,
  type PortAt,
  type PortTable,
  portsOf,
  samePort,
  stepPort,
  stepTarget,
  usablePorts,
} from '../src/canvas/connect-mode';

/**
 * Joining two steps without a mouse.
 *
 * Until this existed the canvas could be walked, and a step selected, configured and deleted
 * from the keyboard — and the one thing the editor is for could only be done by dragging. Each
 * case below is something that has to hold for the keyboard path to be worth having: it has to
 * offer only what the rule would accept, offer *everything* it would accept, and never leave
 * somebody on a port where Enter does nothing.
 */

const node = (id: string, componentRef: string, x: number, y = 0): Connectable => ({
  id,
  position: { x, y },
  data: { componentRef },
});

/** Ports are named rather than typed here: legality is a parameter, not this module's business. */
const manifest = (inputs: string[], outputs: string[]): PortTable => ({
  ports: {
    inputs: Object.fromEntries(inputs.map((name) => [name, {}])),
    outputs: Object.fromEntries(outputs.map((name) => [name, {}])),
  },
});

const MANIFESTS: Record<string, PortTable> = {
  'watch@1': manifest([], ['file']),
  'resize@1': manifest(['image', 'width'], ['image']),
  'save@1': manifest(['file'], []),
};

const GRAPH = [
  node('watch', 'watch@1', 0),
  node('resize', 'resize@1', 260),
  node('save', 'save@1', 520),
];

/** Everything is legal. Used where the case is about ordering rather than about the rule. */
const anything: Accepts = () => true;

/** Nothing is. */
const nothing: Accepts = () => false;

describe('portsOf', () => {
  it('reads the names in declaration order, which is the order they are drawn', () => {
    expect(portsOf(GRAPH[1] as Connectable, MANIFESTS, 'inputs')).toEqual(['image', 'width']);
  });

  it('has nothing to say about a component this build does not have', () => {
    // A graph can reference something that is not installed — the node renders as "Not
    // installed". Offering its ports as targets would be offering a connection to nothing.
    expect(portsOf(node('ghost', 'missing@9', 0), MANIFESTS, 'inputs')).toEqual([]);
  });
});

describe('candidateTargets', () => {
  const from: PortAt = { node: 'watch', port: 'file' };

  it('offers every input on every other step, in walk order', () => {
    expect(
      candidateTargets({ source: from, nodes: GRAPH, manifests: MANIFESTS, accepts: anything }),
    ).toEqual([
      { node: 'resize', port: 'image' },
      { node: 'resize', port: 'width' },
      { node: 'save', port: 'file' },
    ]);
  });

  it('offers nothing when the rule refuses everything', () => {
    // The case connect mode must not enter at all: a mode with no choice in it and an Enter
    // that cannot complete is worse than the absence of the mode.
    expect(
      candidateTargets({ source: from, nodes: GRAPH, manifests: MANIFESTS, accepts: nothing }),
    ).toEqual([]);
  });

  it('skips the ports the rule refuses rather than offering them and saying no', () => {
    // Arrow keys move between things that can be chosen. Landing on a port only to be told it
    // is impossible is the pointer's problem — it has to let you aim anywhere — and the
    // keyboard does not have to inherit it.
    const onlyImages: Accepts = (c) => c.targetHandle === 'image';
    expect(
      candidateTargets({ source: from, nodes: GRAPH, manifests: MANIFESTS, accepts: onlyImages }),
    ).toEqual([{ node: 'resize', port: 'image' }]);
  });

  it('never offers the step it starts from', () => {
    // A node feeding itself is a cycle of one. The rule refuses it anyway; skipping it here
    // keeps a refusal nobody asked about out of the count the live region reads out.
    const targets = candidateTargets({
      source: { node: 'resize', port: 'image' },
      nodes: GRAPH,
      manifests: MANIFESTS,
      accepts: anything,
    });
    expect(targets.every((t) => t.node !== 'resize')).toBe(true);
  });

  it('still offers an input that already has a connection', () => {
    // `connect` in the store replaces whatever was feeding an input rather than adding a second
    // edge, because that is what validation enforces. Hiding an occupied input here would make
    // the keyboard refuse something the pointer allows — so candidates are computed from ports
    // and legality alone, and never from the edges that happen to exist.
    const occupied = candidateTargets({
      source: from,
      nodes: GRAPH,
      manifests: MANIFESTS,
      accepts: anything,
    });
    expect(occupied).toContainEqual({ node: 'save', port: 'file' });
  });

  it('follows the layout when the steps move, not the order they were added', () => {
    const rearranged = [node('save', 'save@1', 0), node('resize', 'resize@1', 260)];
    const targets = candidateTargets({
      source: { node: 'watch', port: 'file' },
      nodes: rearranged,
      manifests: MANIFESTS,
      accepts: anything,
    });
    expect(targets.map((t) => t.node)).toEqual(['save', 'resize', 'resize']);
  });
});

describe('stepTarget', () => {
  const targets: PortAt[] = [
    { node: 'resize', port: 'image' },
    { node: 'resize', port: 'width' },
    { node: 'save', port: 'file' },
  ];

  it('moves forward and back', () => {
    expect(stepTarget(targets, targets[1] ?? null, 'next')).toEqual(targets[2]);
    expect(stepTarget(targets, targets[1] ?? null, 'previous')).toEqual(targets[0]);
  });

  it('wraps at both ends', () => {
    // Unlike walking the canvas, where wrapping reads as having lost the selection. These are a
    // list of choices with no geometry to them, and a ring is what every other chooser does.
    expect(stepTarget(targets, targets[2] ?? null, 'next')).toEqual(targets[0]);
    expect(stepTarget(targets, targets[0] ?? null, 'previous')).toEqual(targets[2]);
  });

  it('enters from either end when nothing is held', () => {
    expect(stepTarget(targets, null, 'next')).toEqual(targets[0]);
    expect(stepTarget(targets, null, 'previous')).toEqual(targets[2]);
  });

  it('recovers when what was held is no longer offered', () => {
    // The step the target was on can be deleted mid-mode. Treating an unknown one as "nothing
    // held" means the next press lands somewhere real rather than doing nothing for ever.
    expect(stepTarget(targets, { node: 'gone', port: 'x' }, 'next')).toEqual(targets[0]);
  });

  it('has nothing to offer with no candidates', () => {
    expect(stepTarget([], null, 'next')).toBeUndefined();
  });
});

describe('stepPort', () => {
  it('cycles the output ports of a step with several', () => {
    const ports = ['image', 'log'];
    expect(stepPort(ports, 'image', 'next')).toBe('log');
    expect(stepPort(ports, 'log', 'next')).toBe('image');
    expect(stepPort(ports, 'image', 'previous')).toBe('log');
  });

  it('stays put when there is only one', () => {
    expect(stepPort(['image'], 'image', 'next')).toBe('image');
  });
});

describe('usablePorts', () => {
  const twoOutputs: Record<string, PortTable> = {
    ...MANIFESTS,
    'convert@1': manifest([], ['image', 'log']),
  };
  const graph = [node('convert', 'convert@1', 0), node('resize', 'resize@1', 260)];

  it('keeps only the outputs that have somewhere legal to go', () => {
    // A component with a `log` output beside its real one is common, and entering connect mode
    // on a port nothing accepts would give somebody a mode whose Enter does nothing.
    const imagesOnly: Accepts = (c) => c.sourceHandle === 'image';
    expect(
      usablePorts({
        node: graph[0] as Connectable,
        nodes: graph,
        manifests: twoOutputs,
        accepts: imagesOnly,
      }),
    ).toEqual(['image']);
  });

  it('keeps both when both fit', () => {
    expect(
      usablePorts({
        node: graph[0] as Connectable,
        nodes: graph,
        manifests: twoOutputs,
        accepts: anything,
      }),
    ).toEqual(['image', 'log']);
  });

  it('is empty when the step produces nothing anything can take', () => {
    expect(
      usablePorts({
        node: graph[0] as Connectable,
        nodes: graph,
        manifests: twoOutputs,
        accepts: nothing,
      }),
    ).toEqual([]);
  });

  it('is empty for a step with no outputs at all', () => {
    expect(
      usablePorts({
        node: node('save', 'save@1', 0),
        nodes: GRAPH,
        manifests: MANIFESTS,
        accepts: anything,
      }),
    ).toEqual([]);
  });
});

describe('samePort', () => {
  it('compares both halves, and treats absence as no match', () => {
    expect(samePort({ node: 'a', port: 'x' }, { node: 'a', port: 'x' })).toBe(true);
    expect(samePort({ node: 'a', port: 'x' }, { node: 'a', port: 'y' })).toBe(false);
    expect(samePort(null, null)).toBe(false);
  });
});
