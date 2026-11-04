// Product data for the admin portal. Pages call ONLY these functions.
// Source: src/data/generated/products.json (made from the Excel file) + edits kept in localStorage.
// Later: replace the body of each function with fetch() to the FastAPI backend. Return shapes stay the same.
import { loadTable, saveTable, pick } from './dataStore'
import { isDemoOn, demoStock } from './demo'

const TABLE = 'products'

const text = (v) => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
const toNumber = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const toBool = (v) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'
const toAliases = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(';')).map((a) => String(a).trim()).filter(Boolean)

// Works for raw rows (snake_case) and for rows already saved in this format.
function normalizeProduct(r) {
  const image = text(pick(r, 'imageUrl', 'image_url'))
  const active = pick(r, 'isActive', 'is_active')
  return {
    id: Number(pick(r, 'id')),
    name: text(pick(r, 'name')),
    brand: text(pick(r, 'brand')),
    brandUr: text(pick(r, 'brandUr', 'brand_ur')),
    category: text(pick(r, 'category')),
    subcategory: text(pick(r, 'subcategory')),
    productType: text(pick(r, 'productType', 'product_type')),
    packageSize: text(pick(r, 'packageSize', 'package_size')),
    unit: text(pick(r, 'unit')),
    price: toNumber(pick(r, 'price')),
    stockQuantity: toNumber(pick(r, 'stockQuantity', 'stock_quantity')), // null = stock not set (NOT 0)
    imageUrl: image && /^(https?:\/\/|\/)/i.test(image) ? image : null,  // broken Excel text becomes null
    aliases: toAliases(pick(r, 'aliases')),
    isActive: active === undefined ? true : toBool(active),
  }
}

const isValid = (p) => Number.isFinite(p.id) && !!p.name
const copy = (p) => ({ ...p, aliases: [...p.aliases] })
// Products whose stock is empty in Excel get a demo number (flagged stockIsDemo) while Demo data is ON.
// Real numbers (including 0) are never replaced, and demo numbers are never written back to storage.
const withDemo = (p) => (isDemoOn() && p.stockQuantity === null && p.isActive
  ? { ...copy(p), stockQuantity: demoStock(p.id), stockIsDemo: true }
  : copy(p))

async function table() {
  const rows = await loadTable(TABLE, normalizeProduct)
  return rows.filter(isValid)
}

function validate(p) {
  if (!p.name) throw new Error('Product name is required.')
  if (!p.category) throw new Error('Category is required.')
  if (p.price === null || p.price < 0) throw new Error('Enter a valid price.')
  if (p.stockQuantity !== null && (!Number.isInteger(p.stockQuantity) || p.stockQuantity < 0)) {
    throw new Error('Stock must be a whole number, 0 or more.')
  }
}

export async function getProducts() {
  return (await table()).map(withDemo).sort((a, b) => a.id - b.id)
}

export async function getProduct(id) {
  const found = (await table()).find((p) => p.id === Number(id))
  return found ? withDemo(found) : null
}

export async function getCategories() {
  const rows = await table()
  return [...new Set(rows.map((p) => p.category).filter(Boolean))].sort()
}

export async function getSubcategories(category) {
  const rows = (await table()).filter((p) => !category || p.category === category)
  return [...new Set(rows.map((p) => p.subcategory).filter(Boolean))].sort()
}

export async function addProduct(data) {
  const rows = await table()
  const id = rows.reduce((max, p) => Math.max(max, p.id), 0) + 1
  const product = normalizeProduct({ isActive: true, ...data, id })
  validate(product)
  saveTable(TABLE, [...rows, product])
  return copy(product)
}

export async function updateProduct(id, patch = {}) {
  const rows = await table()
  const index = rows.findIndex((p) => p.id === Number(id))
  if (index === -1) throw new Error('Product not found.')
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const updated = normalizeProduct({ ...rows[index], ...clean, id: rows[index].id })
  validate(updated)
  const next = [...rows]
  next[index] = updated
  saveTable(TABLE, next)
  return copy(updated)
}

// Use this instead of deleting: inactive products are hidden from customers but keep their order history.
export async function setActive(id, isActive) {
  return updateProduct(id, { isActive: !!isActive })
}
