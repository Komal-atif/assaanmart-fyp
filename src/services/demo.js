// DEMO DATA. Your Excel sheet has no orders and only 18 stock numbers, so a finished-looking dashboard
// needs sample values. They are built from YOUR products (real names, real prices), are always the same
// (seeded) and can be switched off in Settings -> "Demo data". Real values from your Excel file are NEVER
// overwritten (a stock of 0 or any real number stays as it is).
import { readSetting } from './dataStore'

export const isDemoOn = () => readSetting('demoMode', true) !== false

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ~6% out of stock, ~14% low (1-10), the rest well stocked
export function demoStock(id) {
  const r = rng(id * 7919 + 13)
  const x = r()
  if (x < 0.06) return 0
  if (x < 0.2) return 1 + Math.floor(r() * 10)
  return 11 + Math.floor(r() * 150)
}
