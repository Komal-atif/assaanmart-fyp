"""
Speech-to-text writes English words in Urdu letters ("apple" -> "ایپل"). The dataset only had the Urdu words
(سیب), so "ایپل" was matched to 'Apple Jam' instead of the fruit.
This adds the Urdu spelling of the English words in the product names to the products' aliases (and to the
Families sheet), so fruit and vegetable names are understood in Urdu AND English.

Run once from the project root, then run sync_store.py:
    py scripts/add_urdu_spellings.py
    py scripts/sync_store.py
You can add more lines to SPELLINGS yourself: "word in the product name": "urdu spelling; another spelling"
"""
import os, sys
import openpyxl

XLSX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "assanmart_dataset.xlsx")

SPELLINGS = {
    # Fruits
    "apple": "ایپل; ایپلز", "banana": "بنانا", "grapes": "گریپس", "papaya": "پپایا", "melon": "میلن; سویٹ میلن",
    "sweet lime": "سویٹ لائم",
    # Vegetables
    "tomato": "ٹماٹو", "potato": "پوٹیٹو; پوٹاٹو", "cucumber": "کیوکمبر", "onion": "اونین", "mint": "منٹ",
    "lemon": "لیمن", "chili": "چلی; گرین چلی", "cabbage": "کیبج", "capsicum": "کیپسیکم", "spinach": "سپینچ",
    "ginger": "جنجر", "carrot": "کیرٹ", "brinjal": "برنجل", "coriander": "کوریانڈر", "cauliflower": "کالی فلاور",
    "lady finger": "لیڈی فنگر", "garlic": "گارلک", "beans": "بینز",
}

wb = openpyxl.load_workbook(XLSX)
ws = wb["Sheet1"] if "Sheet1" in wb.sheetnames else wb.worksheets[0]
head = {str(c.value).strip(): i + 1 for i, c in enumerate(ws[1])}
n_alias, fam_words = 0, {}
for r in range(2, ws.max_row + 1):
    name = str(ws.cell(r, head["name"]).value or "").lower()
    sub = str(ws.cell(r, head["subcategory"]).value or "")
    if sub not in ("Fruits", "Vegetables"):
        continue
    cell = ws.cell(r, head["aliases"])
    cur = str(cell.value or "")
    have = {a.strip() for a in cur.split(";")}
    add = []
    for key, urdu in SPELLINGS.items():
        if key in name:
            for w in (x.strip() for x in urdu.split(";")):
                if w and w not in have and w not in add:
                    add.append(w)
                    fam_words.setdefault(sub, []).append(w)
    if add:
        cell.value = (cur + "; " if cur else "") + "; ".join(add)
        n_alias += 1

if "Families" in wb.sheetnames:
    fw = wb["Families"]
    fh = {str(c.value).strip(): i + 1 for i, c in enumerate(fw[1])}
    for r in range(2, fw.max_row + 1):
        fam = str(fw.cell(r, fh["family"]).value or "")
        key = {"Fruits": "Fruits", "Vegetables": "Vegetables"}.get(fam)
        if key and key in fam_words:
            cell = fw.cell(r, fh["aliases_ur"])
            have = {a.strip() for a in str(cell.value or "").split(",")}
            extra = [w for w in dict.fromkeys(fam_words[key]) if w not in have]
            if extra:
                cell.value = (str(cell.value or "") + ", " if cell.value else "") + ", ".join(extra)
wb.save(XLSX)
print(f"✅ Urdu spellings added to {n_alias} products. Now run:  py scripts/sync_store.py")