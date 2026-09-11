import { describe, expect, it } from 'vitest';
import { COLUMN_TOLERANCE, indexOf, step, walkOrder } from '../src/canvas/walk';

/**
 * Reaching a step without a mouse.
 *
 * Each case here is something that has to hold for the canvas to be usable from the keyboard.
 * The canvas had no tab stop at all before this: tabbing went sidebar, toolbar, palette and
 * then wrapped, so the nodes were unreachable and therefore unconfigurable.
 */

const at = (id: string, x: number, y: number) => ({ id, position: { x, y } });

describe('walkOrder', () => {
  it('reads left to right, which is how a pipeline is drawn', () => {
    const order = walkOrder([at('save', 520, 0), at('watch', 0, 0), at('resize', 260, 0)]);
    expect(order.map((n) => n.id)).toEqual(['watch', 'resize', 'save']);
  });

  it('reads top to bottom within a column', () => {
    const order = walkOrder([at('lower', 0, 200), at('upper', 0, 0), at('middle', 0, 100)]);
    expect(order.map((n) => n.id)).toEqual(['upper', 'middle', 'lower']);
  });

  it('treats a small horizontal drift as the same column', () => {
    // Two steps a few pixels apart are the same column to a person looking at them, so they
    // must order top-to-bottom. Ordering them by that drift would make the next keypress
    // unpredictable.
    const drift = COLUMN_TOLERANCE - 1;
    const order = walkOrder([at('lower', drift, 200), at('upper', 0, 0)]);
    expect(order.map((n) => n.id)).toEqual(['upper', 'lower']);
  });

  it('treats a clear horizontal gap as a new column', () => {
    const gap = COLUMN_TOLERANCE + 1;
    const order = walkOrder([at('right', gap, 0), at('left', 0, 500)]);
    expect(order.map((n) => n.id)).toEqual(['left', 'right']);
  });

  it('does not disturb the array it is given', () => {
    const nodes = [at('b', 100, 0), at('a', 0, 0)];
    walkOrder(nodes);
    expect(nodes.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('step', () => {
  const graph = walkOrder([at('watch', 0, 0), at('resize', 260, 0), at('save', 520, 0)]);

  it('moves forward and back', () => {
    expect(step(graph, 'watch', 'forward')?.id).toBe('resize');
    expect(step(graph, 'resize', 'back')?.id).toBe('watch');
  });

  it('enters the graph from either end when nothing is selected', () => {
    expect(step(graph, null, 'forward')?.id).toBe('watch');
    expect(step(graph, null, 'back')?.id).toBe('save');
  });

  it('stops at the ends rather than wrapping', () => {
    // Wrapping would make pressing right at the last step jump back to the first, which reads
    // as having lost the selection rather than as having reached the end.
    expect(step(graph, 'save', 'forward')?.id).toBe('save');
    expect(step(graph, 'watch', 'back')?.id).toBe('watch');
  });

  it('has nothing to offer on an empty canvas', () => {
    expect(step([], null, 'forward')).toBeUndefined();
    expect(step([], 'anything', 'back')).toBeUndefined();
  });

  it('recovers when the selected step is gone', () => {
    // A step can be deleted while selected. Treating an unknown id as "nothing selected" means
    // the next arrow press gets back into the graph instead of doing nothing for ever.
    expect(step(graph, 'deleted', 'forward')?.id).toBe('watch');
  });
});

describe('indexOf', () => {
  const graph = walkOrder([at('a', 0, 0), at('b', 260, 0)]);

  it('reports the position, for "step 2 of 3"', () => {
    expect(indexOf(graph, 'b')).toBe(1);
  });

  it('reports nothing selected, and an unknown id, the same way', () => {
    expect(indexOf(graph, null)).toBe(-1);
    expect(indexOf(graph, 'gone')).toBe(-1);
  });
});
