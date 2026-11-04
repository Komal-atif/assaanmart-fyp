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

export function imageCandidates(src) {
  if (!src) return []
  if (/^https?:\/\//i.test(src)) return [{ kind: 'url', url: src }]
  const path = src.startsWith('/') ? src : `/${src}`
  const base = imageBase()
  const list = []
  if (base) list.push({ kind: 'base', url: base + path })
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
