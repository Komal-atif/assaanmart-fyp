
import { IMAGE_BASE_URL } from '../config'
import { getImageBaseSetting } from '../services/settingsService'

let preferred = null

export const imageBase = () => {
  const setting = getImageBaseSetting() || IMAGE_BASE_URL || ''
  return String(setting).trim().replace(/\/+$/, '')
}

export function imageCandidates(src) {
  if (!src) return []

  const value = String(src).trim()

  if (!value) return []

  // External image URL
  if (/^https?:\/\//i.test(value)) {
    return [{ kind: 'url', url: value }]
  }

  // Normalize local image path
  const path = value.startsWith('/') ? value : `/${value}`
  const base = imageBase()

  const candidates = []

  // Configured image server
  if (base) {
    candidates.push({
      kind: 'base',
      url: `${base}${path}`,
    })
  }

  // Public images folder
  candidates.push({
    kind: 'images',
    url: path.startsWith('/images/')
      ? path
      : `/images${path}`,
  })

  // Direct public path
  candidates.push({
    kind: 'public',
    url: path,
  })

  // Remove duplicate URLs
  const unique = candidates.filter(
    (item, index, array) =>
      array.findIndex(
        (candidate) => candidate.url === item.url
      ) === index
  )

  // Try previously working source first
  if (!preferred) return unique

  return [
    ...unique.filter((item) => item.kind === preferred),
    ...unique.filter((item) => item.kind !== preferred),
  ]
}

export function rememberWorking(kind) {
  if (kind) {
    preferred = kind
  }
}

const CAT = {
  'fruits&vegetables': ['🥦', '#e3f3dc'],
  dairy: ['🥛', '#e8f1fa'],
  'meat and sea food': ['🍗', '#fde9e2'],
  'bakery & breakfast': ['🍞', '#fbf0dc'],
  beverages: ['🥤', '#e4f4f6'],
  'snacks&biscuits': ['🍪', '#f8ecd9'],
  'personal care': ['🧴', '#efe7f8'],
  commodities: ['🌾', '#f3f0d9'],
  'spices & sauces': ['🌶️', '#fde6e0'],
}

export const categoryLook = (category) => {
  const key = String(category || '')
    .toLowerCase()
    .trim()

  return CAT[key] || ['🛒', '#e6f4ea']
}
