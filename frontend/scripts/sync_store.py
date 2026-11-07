"""
Keeps the store and the voice backend on ONE dataset.

Run from the project root:   py scripts/sync_store.py

What it does
  1. Reads  src/data/assanmart_dataset.xlsx
  2. Looks in  public/products  and finds the picture of every product (file name = product id, e.g. 96.png).
     It tolerates  155.png.png , 243,png.webp , different upper/lower case and different folder names.
  3. Writes the correct image_url back into the xlsx (so the backend shows the same pictures)
  4. Re-creates  src/data/groceryData.ts  from the xlsx (inactive products are left out)
  5. Prints every product that still has no picture, so you know exactly what to fix.
"""
import json, os, re, sys
from urllib.parse import quote, unquote

import openpyxl

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
XLSX = os.path.join(ROOT, "src", "data", "assanmart_dataset.xlsx")
TS = os.path.join(ROOT, "src", "data", "groceryData.ts")
PUBLIC = os.path.join(ROOT, "public")
PICS = os.path.join(PUBLIC, "products")
EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg")


def norm(x):
    return re.sub(r"[^a-z0-9]+", "", str(x or "").lower())


def clean(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("nan", "none") else s


# ---------- 1. pictures on disk: id -> [relative url paths] ----------
found = {}
on_disk = {}   # lower-case path -> real path (so upper/lower case in the dataset does not matter)
if not os.path.isdir(PICS):
    sys.exit(f"Folder not found: {PICS}")
for root, _d, files in os.walk(PICS):
    for f in files:
        if not f.lower().endswith(EXT):
            continue
        m = re.match(r"^\s*(\d+)", f)
        if not m:
            print(f"   (no id in file name, skipped) {os.path.relpath(os.path.join(root, f), PUBLIC)}")
            continue
        rel = "/" + os.path.relpath(os.path.join(root, f), PUBLIC).replace(os.sep, "/")
        found.setdefault(m.group(1), []).append(rel)
        on_disk[rel.lower()] = rel

# ---------- 2. read the dataset ----------
wb = openpyxl.load_workbook(XLSX)
ws = wb["Sheet1"] if "Sheet1" in wb.sheetnames else wb.worksheets[0]
head = [clean(c.value) for c in ws[1]]
col = {h: i + 1 for i, h in enumerate(head)}
for need in ("id", "name", "category", "subcategory", "price", "image_url"):
    if need not in col:
        sys.exit(f"Column '{need}' is missing in the dataset")
rows = []
for r in range(2, ws.max_row + 1):
    rec = {h: ws.cell(r, col[h]).value for h in col}
    if clean(rec["id"]) == "":
        continue
    rec["_row"] = r
    rows.append(rec)

# ---------- 3. choose the picture of every product ----------
def pick(rec):
    # 1) the path already written in the dataset, if that picture really exists
    old = unquote(clean(rec["image_url"])).lower()
    if old in on_disk:
        return on_disk[old]
    # 2) otherwise the file that is named after the product id
    pid = str(int(float(rec["id"])))
    cands = found.get(pid, [])
    if not cands:
        return None
    if len(cands) == 1:
        return cands[0]
    sub, cat = norm(rec["subcategory"]), norm(rec["category"])
    def score(p):
        parts = [norm(x) for x in p.split("/")[2:-1]]
        return (sum(1 for x in parts if x and (x in sub or sub in x)) * 2 + sum(1 for x in parts if x and (x in cat or cat in x)))
    return sorted(cands, key=score, reverse=True)[0]


no_pic, changed = [], 0
for rec in rows:
    new = pick(rec)
    old = clean(rec["image_url"])
    if new:
        url = quote(new, safe="/&")
        if url != old:
            ws.cell(rec["_row"], col["image_url"]).value = url
            changed += 1
        rec["image_url"] = url
    else:
        if clean(rec.get("is_active")) not in ("0", "0.0"):
            no_pic.append((int(float(rec["id"])), clean(rec["name"]), old))
        rec["image_url"] = old
wb.save(XLSX)

# ---------- 4. groceryData.ts ----------
old_ts = open(TS, encoding="utf-8").read() if os.path.exists(TS) else ""
icons_by_sub, cat_icons = {}, {}
for line in old_ts.splitlines():
    s = line.strip()
    if s.startswith('{"id"'):
        try:
            p = json.loads(s.rstrip(","))
            icons_by_sub.setdefault(p["subcategory"], p["icon"])
        except Exception:
            pass
m = re.search(r"export const categories: Category\[\] = (\[.*?\n\]);", old_ts, re.S)
if m:
    try:
        for c in json.loads(m.group(1)):
            cat_icons[c["name"]] = c["icon"]
    except Exception:
        pass
DEFAULT_ICON = {"Fruits & Vegetables": "🥦", "Dairy": "🥛", "Snacks & Biscuits": "🍪", "Beverages": "🥤",
                "Commodities": "🌾", "Bakery & Breakfast": "🥖", "Meat & Chicken": "🍗", "Meat and Sea Food": "🍗", "Personal Care": "🧴",
                "Spices & Sauces": "🌶️"}


def strip_size(name, size):
    n = clean(name)
    for cand in {size, size.replace(" ", "")}:
        if cand and n.lower().endswith(cand.lower()):
            return n[: -len(cand)].strip()
    return n


def num(v):
    s = clean(v)
    if s == "":
        return None
    f = float(s)
    return int(f) if f == int(f) else round(f, 2)


products, cats = [], {}
for rec in rows:
    if clean(rec.get("is_active")) in ("0", "0.0"):
        continue
    cat, sub = clean(rec["category"]), clean(rec["subcategory"])
    cats.setdefault(cat, [])
    if sub not in cats[cat]:
        cats[cat].append(sub)
    size = clean(rec.get("package_size"))
    price = num(rec["price"])
    if price == 0:
        price = None
    stock = num(rec.get("stock_quantity"))
    full = clean(rec["name"])
    search = " ".join(x for x in [full.lower(), clean(rec.get("brand")).lower(), clean(rec.get("brand_ur")),
                                  clean(rec.get("aliases")).lower(), sub.lower(), clean(rec.get("product_type")).lower()] if x)
    products.append({
        "id": str(int(float(rec["id"]))), "name": strip_size(full, size), "category": cat, "subcategory": sub,
        "size": size, "price": price, "stock": stock,
        "icon": icons_by_sub.get(sub) or cat_icons.get(cat) or DEFAULT_ICON.get(cat, "🛒"),
        "image": rec["image_url"], "search": search})

ORDER = ["Fruits & Vegetables", "Dairy", "Snacks & Biscuits", "Beverages", "Commodities", "Bakery & Breakfast",
         "Meat and Sea Food", "Personal Care", "Spices & Sauces"]
names = sorted(cats, key=lambda c: ORDER.index(c) if c in ORDER else len(ORDER))
categories = [{"name": c, "icon": cat_icons.get(c) or DEFAULT_ICON.get(c, "🛒"), "subcategories": cats[c]} for c in names]
header = f"""// Auto-generated from assanmart_dataset.xlsx by scripts/sync_store.py — {len(products)} products.
// Fields: id, name, category, subcategory, size, price (null = unavailable), stock (0 = out of stock,
// null = unknown/available), icon (emoji fallback), image (public path), search (lowercase text incl. brand,
// Urdu brand and aliases so English + Urdu search both work).

export interface Category {{
  name: string;
  icon: string;
  subcategories: string[];
}}

export interface Product {{
  id: string;
  name: string;
  category: string;
  subcategory: string;
  size: string;
  price: number | null;
  stock: number | null;
  icon: string;
  image: string;
  search: string;
}}

export const categories: Category[] = {json.dumps(categories, ensure_ascii=False, indent=2)};

export const products: Product[] = [
"""
body = ",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in products)
open(TS, "w", encoding="utf-8").write(header + body + ",\n];\n")

print(f"\n✅ {len(products)} products written to src/data/groceryData.ts")
print(f"✅ {changed} picture paths fixed in the dataset")
if no_pic:
    print(f"\n⚠️ {len(no_pic)} products still have NO picture file in public/products:")
    for pid, name, old in no_pic:
        print(f"   id {pid:>4}  {name}   (dataset said: {old or '-'})")
    print("   Put a file named <id>.png (for example 96.png) in any folder under public/products and run this script again.")
else:
    print("✅ every product has a picture")