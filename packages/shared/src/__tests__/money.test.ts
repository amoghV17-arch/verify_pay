import { describe, it, expect } from 'vitest';
import { centsToDecimal, decimalToCents, distributePercentages } from '../money.js';

describe('money utilities', () => {
  it('converts integer cents to decimal strings properly', () => {
    expect(centsToDecimal(18000)).toBe('180.00');
    expect(centsToDecimal(50)).toBe('0.50');
    expect(centsToDecimal(0)).toBe('0.00');
    expect(centsToDecimal(105)).toBe('1.05');
  });

  it('converts decimal strings and numbers to integer cents', () => {
    expect(decimalToCents('180.00')).toBe(18000);
    expect(decimalToCents('$180.00')).toBe(18000);
    expect(decimalToCents(180)).toBe(18000);
    expect(decimalToCents('0.50')).toBe(50);
  });

  it('guarantees exact sum matching via largest-remainder method', () => {
    // $100 (10,000 cents) split into 33%, 33%, 34%
    const split = distributePercentages(10000, [33, 33, 34]);
    expect(split.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(split).toEqual([3300, 3300, 3400]);

    // $100 (10,000 cents) split into 3 equal 33%, 33%, 34% weights with remainder
    const split3 = distributePercentages(10001, [33, 33, 34]);
    expect(split3.reduce((a, b) => a + b, 0)).toBe(10001);
  });
});

