// Search used by Products, Inventory and the top search box: name, brand, Urdu brand, type, aliases.
export function matchesProduct(p, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  return [p.name, p.brand, p.brandUr, p.subcategory, p.productType, ...p.aliases]
    .filter(Boolean)
    .some((t) => t.toLowerCase().includes(q))
}
