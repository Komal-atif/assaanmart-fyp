// One rule for the whole store: at most 10 of any item, and never more than what is in stock.
export const MAX_PER_ITEM = 10;
export const LIMIT_MSG = 'You have reached the limit for this item';

export const maxFor = (p: { stock?: number | null }): number => {
  const s = typeof p.stock === 'number' && p.stock >= 0 ? p.stock : MAX_PER_ITEM;
  return Math.max(0, Math.min(MAX_PER_ITEM, s));
};

export const clampQty = (p: { stock?: number | null }, q: number): number =>
  Math.max(0, Math.min(Math.floor(Number(q) || 0), maxFor(p)));