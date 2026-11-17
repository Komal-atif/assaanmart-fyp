// Products come from the backend (same database the store reads). Same exported functions as before.

// Talks to the backend with the admin's login token (found automatically; works with supabase-js or a saved session).
const BACKEND = String(import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '')

function findAccessToken() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!/auth|session|supabase|sb-/i.test(key)) continue
    try {
      const v = JSON.parse(localStorage.getItem(key))
      const t = v?.access_token || v?.token || v?.currentSession?.access_token || v?.session?.access_token
      if (t) return t
    } catch { /* not JSON */ }
  }
  return null
}

async function api(path, { method = 'GET', body } = {}) {
  const token = findAccessToken()
  if (!token) throw new Error('Please log in again, then retry.')
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${res.status}).`)
  return data
}
import { isDemoOn, demoStock } from './demo'

const text = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === '' ? null : s }
const toNumber = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const pick = (r, ...keys) => { for (const k of keys) if (r[k] !== undefined) return r[k]; return undefined }

// "\products\Personal Care\x.jpg" (Windows) -> "/products/Personal Care/x.jpg"; "products/..." -> "/products/..."
export function cleanImagePath(v) {
  let s = text(v)
  if (!s) return null
  s = s.replace(/\\/g, '/').replace(/^"+|"+$/g, '')
  if (/^https?:\/\//i.test(s)) return s
  return s.startsWith('/') ? s : '/' + s
}

function normalizeProduct(r) {
  const active = pick(r, 'isActive', 'is_active')
  const al = pick(r, 'aliases')
  return {
    id: Number(r.id),
    name: text(r.name), brand: text(r.brand), brandUr: text(pick(r, 'brandUr', 'brand_ur')),
    category: text(r.category), subcategory: text(r.subcategory),
    productType: text(pick(r, 'productType', 'product_type')),
    packageSize: text(pick(r, 'packageSize', 'package_size')), unit: text(r.unit),
    price: toNumber(r.price),
    stockQuantity: toNumber(pick(r, 'stockQuantity', 'stock_quantity')),
    imageUrl: cleanImagePath(pick(r, 'imageUrl', 'image_url')),
    aliases: (Array.isArray(al) ? al : String(al ?? '').split(';')).map((a) => String(a).trim()).filter(Boolean),
    isActive: active === undefined ? true : (active === true || active === 1 || active === '1' || String(active).toLowerCase() === 'true'),
  }
}

const toApi = (p) => ({
  name: p.name, brand: p.brand || 'Generic', brand_ur: p.brandUr, category: p.category,
  subcategory: p.subcategory || p.category, package_size: p.packageSize, unit: p.unit, price: p.price,
  stock_quantity: p.stockQuantity, image_url: p.imageUrl, aliases: p.aliases.join(';'), is_active: p.isActive ? 1 : 0,
})

const copy = (p) => ({ ...p, aliases: [...p.aliases] })
const withDemo = (p) => (isDemoOn() && p.stockQuantity === null && p.isActive ? { ...copy(p), stockQuantity: demoStock(p.id), stockIsDemo: true } : copy(p))

function validate(p) {
  if (!p.name) throw new Error('Product name is required.')
  if (!p.category) throw new Error('Category is required.')
  if (p.price === null || p.price < 0) throw new Error('Enter a valid price.')
  if (p.stockQuantity !== null && (!Number.isInteger(p.stockQuantity) || p.stockQuantity < 0)) throw new Error('Stock must be a whole number, 0 or more.')
}

// Cache: the product list is downloaded once and reused for 60 s, so moving between pages is instant.
// Any add / edit / delete clears it so you always see your own changes.
let cache = null
let cacheAt = 0
const clearCache = () => { cache = null; cacheAt = 0 }

async function table() {
  if (cache && Date.now() - cacheAt < 60000) return cache
  const load = api('/admin/products').then(({ products }) =>
    products.map(normalizeProduct).filter((p) => Number.isFinite(p.id) && p.name))
  cache = load                      // share one in-flight request between pages that ask at the same time
  cacheAt = Date.now()
  try { return await load } catch (e) { clearCache(); throw e }
}

export async function getProducts() { return (await table()).map(withDemo).sort((a, b) => a.id - b.id) }
export async function getProduct(id) { const f = (await table()).find((p) => p.id === Number(id)); return f ? withDemo(f) : null }
export async function getCategories() { return [...new Set((await table()).map((p) => p.category).filter(Boolean))].sort() }
export async function getSubcategories(category) {
  return [...new Set((await table()).filter((p) => !category || p.category === category).map((p) => p.subcategory).filter(Boolean))].sort()
}

export async function addProduct(data) {
  const product = normalizeProduct({ isActive: true, ...data, id: 0 })
  validate(product)
  clearCache()
  const { product: out } = await api('/admin/products', { method: 'POST', body: toApi(product) })
  return normalizeProduct(out)
}

export async function updateProduct(id, patch = {}) {
  const current = (await table()).find((p) => p.id === Number(id))
  if (!current) throw new Error('Product not found.')
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const updated = normalizeProduct({ ...current, ...clean, id: current.id })
  validate(updated)
  clearCache()
  const { product: out } = await api(`/admin/products/${current.id}`, { method: 'PUT', body: toApi(updated) })
  return normalizeProduct(out)
}

export async function setActive(id, isActive) { return updateProduct(id, { isActive: !!isActive }) }

export async function deleteProduct(id) {
  clearCache()
  await api(`/admin/products/${Number(id)}`, { method: 'DELETE' })
  return true
}