import { describe, expect, it } from 'vitest';
import { probe } from '../src/panels/RunPanel';

describe('probe', () => {
  it('imports', () => {
    expect(probe()).toBe(1);
  });
});
