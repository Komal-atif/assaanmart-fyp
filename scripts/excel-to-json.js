// Converts the Excel product sheet into src/data/generated/products.json
// Run:  npm run data
// Only your real data is converted. Empty stock stays null (= "not set"), image paths are kept as written.
import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const SRC_DIR = path.resolve('src/data/source')
const OUT_DIR = path.resolve('src/data/generated')

const file = fs.readdirSync(SRC_DIR).find((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
if (!file) throw new Error('No .xlsx file found in src/data/source')

const wb = XLSX.readFile(path.join(SRC_DIR, file))
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })

const clean = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null)
const num = (v) => (v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
// Accepts full URLs (https://...) and site paths (/products/Dairy/Milk/325.png). Broken Excel text becomes null.
const goodImage = (v) => typeof v === 'string' && /^(https?:\/\/|\/)/i.test(v.trim())

const report = { skippedRows: 0, badImageCells: [], noImage: 0, stockNotSet: 0 }
const products = []

for (const r of rows) {
  if (r.id == null || !clean(r.name)) { report.skippedRows++; continue }
  let imageUrl = null
  if (goodImage(r.image_url)) imageUrl = r.image_url.trim()
  else if (r.image_url) report.badImageCells.push(r.id)
  if (!imageUrl) report.noImage++
  const stockQuantity = num(r.stock_quantity)
  if (stockQuantity === null) report.stockNotSet++
  products.push({
    id: Number(r.id), name: clean(r.name), brand: clean(r.brand), brandUr: clean(r.brand_ur),
    category: clean(r.category), subcategory: clean(r.subcategory), productType: clean(r.product_type),
    packageSize: clean(String(r.package_size ?? '')), unit: clean(r.unit), price: num(r.price),
    stockQuantity, imageUrl,
    aliases: String(r.aliases ?? '').split(';').map((a) => a.trim()).filter(Boolean),
    isActive: Number(r.is_active) === 1,
  })
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'products.json'), JSON.stringify(products))
console.log(`products.json written: ${products.length} products`)
console.log('Skipped empty rows:', report.skippedRows, '| without image:', report.noImage, '| bad image cells:', report.badImageCells.join(', ') || 'none', '| stock not set:', report.stockNotSet)
