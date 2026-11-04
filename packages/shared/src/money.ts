/**
 * Money helper utilities.
 * All monetary amounts in Milestone are stored internally as integer cents.
 * Conversion to decimal strings occurs strictly at external boundaries (PayPal API, UI presentation).
 */

export function centsToDecimal(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`centsToDecimal requires an integer, received: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, '0')}`;
}

/**
 * Format integer cents as a human-friendly USD currency string with thousand separators (e.g. 120000 -> "$1,200.00").
 */
export function formatCents(cents: number): string {
  const dec = centsToDecimal(cents);
  const isNegative = dec.startsWith('-');
  const unsigned = isNegative ? dec.slice(1) : dec;
  const [dollars, fraction] = unsigned.split('.');
  const formattedDollars = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}$${formattedDollars}.${fraction}`;
}

export function decimalToCents(amount: string | number): number {
  if (typeof amount === 'number') {
    return Math.round(amount * 100);
  }
  const clean = amount.trim().replace(/^\$/, '');
  const parsed = parseFloat(clean);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Cannot convert invalid monetary string to cents: "${amount}"`);
  }
  return Math.round(parsed * 100);
}

/**
 * Largest-Remainder Method (Hamilton method)
 * Allocates totalCents according to integer percentage weights such that
 * the sum of the resulting cents array EXACTLY equals totalCents, eliminating rounding drift.
 */
export function distributePercentages(totalCents: number, percentages: number[]): number[] {
  if (percentages.length === 0) return [];

  const sumPct = percentages.reduce((acc, p) => acc + p, 0);
  if (sumPct !== 100) {
    throw new Error(`Percentages must sum to 100, received sum: ${sumPct}`);
  }

  const rawValues = percentages.map((pct) => (totalCents * pct) / 100);
  const floors = rawValues.map((v) => Math.floor(v));
  const remainders = rawValues.map((v, i) => ({ index: i, remainder: v - floors[i] }));

  const centsDistributed = floors.reduce((acc, v) => acc + v, 0);
  const discrepancy = totalCents - centsDistributed;

  // Sort descending by largest remainder
  remainders.sort((a, b) => b.remainder - a.remainder);

  // Distribute remaining cents one by one to largest remainders
  for (let i = 0; i < discrepancy; i++) {
    const targetIdx = remainders[i % remainders.length].index;
    floors[targetIdx] += 1;
  }

  return floors;
}
