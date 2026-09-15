import { describe, expect, it } from 'vitest';
import { isEdit } from '../src/store';

/**
 * Which React Flow changes make a project unsaved.
 *
 * A `dimensions` change is the library measuring a node it has just drawn. It arrives for every
 * node the moment a project opens, and again whenever a culled node scrolls back into view. It
 * used to count as an edit, so every opened project read as unsaved before anybody touched it —
 * which disabled Publish and made the unsaved-work prompt fire on a canvas nobody had edited.
 */
describe('what counts as editing the file', () => {
  it('measuring and selecting are not edits', () => {
    expect(isEdit('dimensions')).toBe(false);
    expect(isEdit('select')).toBe(false);
  });

  it('moving, adding, removing and replacing are', () => {
    for (const type of ['position', 'add', 'remove', 'replace']) {
      expect(isEdit(type)).toBe(true);
    }
  });
});
