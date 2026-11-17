// Builds the list of places to look for a product image (see src/config.js).
// The Excel sheet stores paths like  /products/Dairy/Milk/325.png
// Tried in this order until one loads:
//   1) image website (Settings page or .env)  ->  https://your-site.com/products/Dairy/Milk/325.png
//   2) /images + path                         ->  public/images/products/Dairy/Milk/325.png
//   3) the path itself                        ->  public/products/Dairy/Milk/325.png
import { IMAGE_BASE_URL } from '../config'
import { getImageBaseSetting } from '../services/settingsService'

let preferred = null // remember which place worked last, so the next images try it first

export const imageBase = () => (getImageBaseSetting() || IMAGE_BASE_URL || '').replace(/\/+$/, '')

const BACKEND = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '')
// Spaces, & etc. must be encoded to load; already-encoded text (%20) is left alone.
const enc = (p) => encodeURI(decodeURI(p))
const safeDecode = (p) => { try { return enc(p) } catch { return p } }

export function imageCandidates(src) {
  if (!src) return []
  src = String(src).trim().replace(/\\/g, '/')            // Windows path  \products\x.png  ->  /products/x.png
  if (/^https?:\/\//i.test(src)) return [{ kind: 'url', url: safeDecode(src) }]
  const path = safeDecode(src.startsWith('/') ? src : `/${src}`)
  const base = imageBase()
  const list = []
  if (base) list.push({ kind: 'base', url: base + path })
  if (BACKEND) list.push({ kind: 'backend', url: `${BACKEND}/pics${path}` })   // backend serves the store's pictures
  list.push({ kind: 'images', url: path.startsWith('/images/') ? path : `/images${path}` })
  list.push({ kind: 'public', url: path })
  const seen = new Set()
  const unique = list.filter((c) => (seen.has(c.url) ? false : seen.add(c.url)))
  return preferred ? [...unique.filter((c) => c.kind === preferred), ...unique.filter((c) => c.kind !== preferred)] : unique
}

export const rememberWorking = (kind) => { preferred = kind }

// Category -> emoji + colour for the "no image" tile
const CAT = {
  'fruits&vegetables': ['🥦', '#e3f3dc'], dairy: ['🥛', '#e8f1fa'], 'meat and sea food': ['🍗', '#fde9e2'],
  'bakery & breakfast': ['🍞', '#fbf0dc'], beverages: ['🥤', '#e4f4f6'], 'snacks&biscuits': ['🍪', '#f8ecd9'],
  'personal care': ['🧴', '#efe7f8'], commodities: ['🌾', '#f3f0d9'], 'spices & sauces': ['🌶️', '#fde6e0'],
}
export const categoryLook = (category) => CAT[String(category || '').toLowerCase()] || ['🛒', '#e6f4ea']