// Admin settings (low stock limit, store info) and a reset for the local test data.
import { readSetting, writeSetting } from './dataStore'
import { isDemoOn } from './demo'
import { DEFAULT_LOW_STOCK_LIMIT } from '../utils/stock'

export async function getLowStockLimit() {
  const v = Number(readSetting('lowStockLimit', DEFAULT_LOW_STOCK_LIMIT))
  return Number.isInteger(v) && v >= 0 ? v : DEFAULT_LOW_STOCK_LIMIT
}

export async function setLowStockLimit(limit) {
  const n = Number(limit)
  if (limit === '' || limit === null || !Number.isInteger(n) || n < 0) throw new Error('Low stock limit must be a whole number, 0 or more.')
  writeSetting('lowStockLimit', n)
  return n
}

export async function getStoreInfo() {
  return readSetting('storeInfo', { storeName: '', phone: '', address: '', openingHours: '' })
}

export async function saveStoreInfo(info) {
  const clean = {
    storeName: String(info.storeName ?? '').trim(),
    phone: String(info.phone ?? '').trim(),
    address: String(info.address ?? '').trim(),
    openingHours: String(info.openingHours ?? '').trim(),
  }
  if (!clean.storeName) throw new Error('Store name is required.')
  writeSetting('storeInfo', clean)
  return clean
}

// After you fix the Excel and run `npm run data`, call this once so the app reads the new JSON.
// It clears saved products/orders only (the admin account and settings are kept) and reloads the page.
export async function resetLocalData() {
  localStorage.removeItem('assanmart:products')
  localStorage.removeItem('assanmart:orders')
  window.location.reload()
}

export const getDemoMode = () => isDemoOn()

// Turning demo data on/off clears saved orders (sample orders are rebuilt or removed) and reloads the page.
export async function setDemoMode(on) {
  writeSetting('demoMode', !!on)
  localStorage.removeItem('assanmart:orders')
  window.location.reload()
}

// Where product pictures come from. Saved here (Settings page) or set once in .env (VITE_IMAGE_BASE_URL).
export const getImageBaseSetting = () => String(readSetting('imageBase', '') || '')
export async function setImageBase(url) {
  const clean = String(url ?? '').trim().replace(/\/+$/, '')
  if (clean && !/^https?:\/\//i.test(clean)) throw new Error('The link must start with http:// or https://')
  writeSetting('imageBase', clean)
  return clean
}
