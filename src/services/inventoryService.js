// Stock logic for the admin portal. Status is ALWAYS decided by utils/stock.js.
import { getProducts, updateProduct } from './productService'
import { getLowStockLimit } from './settingsService'
import { getStockStatus, stockSummary } from '../utils/stock'

const withStatus = (products, limit) => products.map((p) => ({ ...p, stockStatus: getStockStatus(p, limit) }))

// Every product with a `stockStatus`: 'in' | 'low' | 'out' | 'unset' | 'inactive'
export async function getInventory() {
  const [products, limit] = await Promise.all([getProducts(), getLowStockLimit()])
  return withStatus(products, limit)
}

// Low + out of stock only. Out of stock first, then the smallest quantity first.
export async function getLowStock() {
  const items = (await getInventory()).filter((p) => p.stockStatus === 'low' || p.stockStatus === 'out')
  return items.sort((a, b) => a.stockQuantity - b.stockQuantity)
}

// Products whose stock was never entered (empty in Excel). These are NOT counted as out of stock.
export async function getStockNotSet() {
  return (await getInventory()).filter((p) => p.stockStatus === 'unset')
}

export async function updateStock(id, quantity) {
  const q = Number(quantity)
  if (quantity === '' || quantity === null || !Number.isInteger(q) || q < 0) {
    throw new Error('Stock must be a whole number, 0 or more.')
  }
  const product = await updateProduct(id, { stockQuantity: q })
  const limit = await getLowStockLimit()
  return { ...product, stockStatus: getStockStatus(product, limit) }
}

export async function getStockSummary() {
  const [products, limit] = await Promise.all([getProducts(), getLowStockLimit()])
  return stockSummary(products, limit) // { total, in, low, out, unset, inactive }
}
