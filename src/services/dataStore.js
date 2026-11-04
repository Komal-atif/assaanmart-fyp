// Shared loader for src/data/generated/*.json. Edits are kept in localStorage until the FastAPI backend replaces the services.
const loaders = import.meta.glob('../data/generated/*.json', { import: 'default' })
const cache = new Map()
const storageKey = (name) => `assanmart:${name}`

export const pick = (row, ...keys) => {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
  return undefined
}

// Excel date serials (e.g. 45000) or ISO strings -> ISO string
export function toIso(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export async function loadTable(name, normalize, ctx) {
  if (cache.has(name)) return cache.get(name)
  let rows
  const saved = localStorage.getItem(storageKey(name))
  if (saved) {
    rows = JSON.parse(saved)
  } else {
    const loader = loaders[`../data/generated/${name}.json`]
    rows = loader ? await loader() : []
  }
  const normalized = rows.map((r, i) => normalize(r, i, ctx))
  cache.set(name, normalized)
  return normalized
}

export function saveTable(name, rows) {
  cache.set(name, rows)
  localStorage.setItem(storageKey(name), JSON.stringify(rows))
}

export function readSetting(key, fallback) {
  try {
    const all = JSON.parse(localStorage.getItem(storageKey('settings')) || '{}')
    return all[key] ?? fallback
  } catch {
    return fallback
  }
}

export function writeSetting(key, value) {
  let all = {}
  try { all = JSON.parse(localStorage.getItem(storageKey('settings')) || '{}') } catch { /* reset */ }
  localStorage.setItem(storageKey('settings'), JSON.stringify({ ...all, [key]: value }))
}

export function removeSetting(key) {
  let all = {}
  try { all = JSON.parse(localStorage.getItem(storageKey('settings')) || '{}') } catch { /* reset */ }
  delete all[key]
  localStorage.setItem(storageKey('settings'), JSON.stringify(all))
}
