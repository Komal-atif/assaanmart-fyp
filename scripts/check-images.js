// Lists which product images exist in public/images/products (or public/products). Run: npm run check-images
import fs from 'node:fs'
import path from 'node:path'
const products = JSON.parse(fs.readFileSync('src/data/generated/products.json', 'utf8'))
const roots = ['public/images', 'public'].map((r) => path.resolve(r))
let found = 0
const missing = []
for (const p of products) {
  if (!p.imageUrl || /^https?:/i.test(p.imageUrl)) continue
  const rel = decodeURIComponent(p.imageUrl)
  if (roots.some((r) => fs.existsSync(path.join(r, rel)))) found++
  else missing.push(`${p.id}  ${rel}`)
}
console.log(`Images found: ${found} / ${products.length}`)
if (missing.length) console.log('Missing (first 20):\n' + missing.slice(0, 20).join('\n'))
console.log('\nPut images in: public/images/products/<Category>/<Subcategory>/<id>.png   (same folders as the Excel image_url column)')
