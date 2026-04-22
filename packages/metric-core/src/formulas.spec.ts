import { describe, expect, it } from 'vitest';
import { calculateAiOutputRate } from './formulas.js';

describe('calculateAiOutputRate', () => {
  it('returns accepted ai lines divided by commit total lines', () => {
    expect(calculateAiOutputRate(7, 10)).toBe(0.7);
  });

  it('returns 0 when commit total lines is 0', () => {
    expect(calculateAiOutputRate(7, 0)).toBe(0);
  });
});
