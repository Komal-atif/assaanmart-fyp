// One place that decides stock meaning. Works the same for Excel/JSON data and for the database later.
//   stockQuantity === null  -> "Stock not set"  (unknown, NOT the same as 0)
//   stockQuantity === 0     -> "Out of stock"
//   stockQuantity <= limit  -> "Low stock"
//   isActive === false      -> "Inactive" (hidden from customers, separate from stock)
export const DEFAULT_LOW_STOCK_LIMIT = 10

export function getStockStatus(product, lowLimit = DEFAULT_LOW_STOCK_LIMIT) {
  if (!product.isActive) return 'inactive'
  const q = product.stockQuantity
  if (q === null || q === undefined) return 'unset'
  if (q <= 0) return 'out'
  if (q <= lowLimit) return 'low'
  return 'in'
}

export const STOCK_LABEL = { in: 'In Stock', low: 'Low Stock', out: 'Out of Stock', unset: 'Stock not set', inactive: 'Inactive' }

export function stockSummary(products, lowLimit = DEFAULT_LOW_STOCK_LIMIT) {
  const s = { total: products.length, in: 0, low: 0, out: 0, unset: 0, inactive: 0 }
  for (const p of products) s[getStockStatus(p, lowLimit)]++
  return s
}
