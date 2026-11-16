from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, text as sql_text, inspect as sql_inspect, func as sql_func
from sqlalchemy.orm import declarative_base, sessionmaker
import requests, os, uuid, json, asyncio, time, re, difflib, math
from datetime import datetime
import pandas as pd
from functools import lru_cache
from dataclasses import dataclass
from typing import Optional, Callable
import edge_tts
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
UPLIFT_KEY = os.getenv("UPLIFTAI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
CSV_PATH = os.getenv("CSV_PATH", "data/assanmart_dataset.xlsx")   # .xlsx or .csv both work
BRAND_READ_ALL = 8      # up to this many brands are read in one go
BRAND_PAGE = 6          # above that, brands are read 6 at a time ("next" for more)
READ_ALL_UP_TO = 4      # up to this many products are read in one go
VARIANT_PAGE = 3        # above that, products are read 3 at a time ("next" for more)

os.makedirs("temp_audio", exist_ok=True)

# Reused HTTP connections (saves a TLS handshake on every call)
http = requests.Session()

# ============================================================
# DATABASE + CSV DATASET
# ============================================================

# Local development: SQLite file. Online: set DATABASE_URL to your Supabase / PostgreSQL connection string.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./asanmart.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    brand = Column(String)
    category = Column(String)
    subcategory = Column(String)        # = "item family" (Flour, Sugar, Pulses, ...)
    package_size = Column(String)
    unit = Column(String)
    brand_ur = Column(String, nullable=True)   # brand in Urdu script ("ڈالڈا") -> matched without calling Gemini
    aliases = Column(String, nullable=True)    # spoken words for this product, comma separated
    price = Column(Float)               # price of ONE pack/unit as listed
    image_url = Column(String, nullable=True)
    stock_quantity = Column(Float, nullable=True)   # empty in CSV -> treated as "in stock"
    is_active = Column(Integer, default=1)          # 0 = hidden from the store and the agent (set by the admin)


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    items_json = Column(String)
    total_price = Column(Float)
    payment_method = Column(String, default="COD")
    status = Column(String, default="confirmed")
    user_id = Column(String, nullable=True)          # Supabase user id (None for guests)
    session_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String, nullable=True)            # "voice" (agent confirmed) or "web" (store checkout)
    customer_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    delivery_slot = Column(String, nullable=True)
    subtotal = Column(Float, nullable=True)
    delivery_fee = Column(Float, nullable=True)


class Customer(Base):
    """What a signed-in customer told us once (delivery details): remembered, only confirmed at the next order."""
    __tablename__ = "customers"
    user_id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer)
    product_id = Column(Integer)
    name = Column(String)
    brand = Column(String)
    quantity = Column(Float)
    unit_price = Column(Float)
    line_total = Column(Float)


def _num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if x != x else x        # NaN -> None


def _clean(v):
    """Excel blanks come in as NaN — turn them into '' instead of the string 'nan'."""
    try:
        if v is None or pd.isna(v):
            return ""
    except (TypeError, ValueError):
        pass
    return str(v).strip()


FAMILY_SHEET = {}      # family -> {"en": "...", "ur": "...", "name_ur": "..."} from the dataset's "Families" sheet


_HIDDEN = []        # rows switched off in the dataset (is_active = 0): known, but not for sale


def load_csv_into_db():
    base = os.path.dirname(os.path.abspath(__file__))
    path = CSV_PATH if os.path.exists(CSV_PATH) else os.path.join(base, CSV_PATH)
    if not os.path.exists(path):
        print(f"⚠️ Dataset not found at {CSV_PATH} — put the file there or set CSV_PATH")
        return

    try:
        if path.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(path, sheet_name=0)
            try:                                   # optional sheet "Families": spoken words + Urdu name for each item family
                fs = pd.read_excel(path, sheet_name="Families")
                fs.columns = [str(c).strip().lower() for c in fs.columns]
                FAMILY_SHEET.clear()
                for _, fr in fs.iterrows():
                    fam_ = _clean(fr.get("family"))
                    if fam_:
                        FAMILY_SHEET[fam_] = {"en": _clean(fr.get("aliases_en")), "ur": _clean(fr.get("aliases_ur")),
                                              "name_ur": _clean(fr.get("name_ur"))}
            except Exception:
                pass
        else:
            df = pd.read_csv(path, encoding="utf-8-sig")
    except Exception as e:
        print(f"❌ Error reading dataset: {e}")
        return
    df.columns = [str(c).strip().lower() for c in df.columns]

    missing = [c for c in ("name", "price", "subcategory") if c not in df.columns]
    if missing:
        print(f"❌ Dataset is missing columns: {missing}. Found: {list(df.columns)}")
        return

    try:
        _db0 = SessionLocal()
        have_n = _db0.query(Product).count()
        _db0.close()
    except Exception:
        have_n = 0
    if have_n > 0 and os.getenv("RELOAD_FROM_XLSX", "0") != "1":
        # the DATABASE is the catalogue now: whatever the admin added / changed stays. (RELOAD_FROM_XLSX=1 loads the Excel again once.)
        print(f"✅ Using the {have_n} products already in the database (admin changes are kept)")
        return

    Product.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)

    rows, used_ids = [], set()
    _HIDDEN.clear()
    for i, r in df.iterrows():
        price = _num(r.get("price"))
        subcategory = _clean(r.get("subcategory"))
        if price is None or not subcategory:
            continue
        act = _num(r.get("is_active"))
        if act is not None and act == 0:            # is_active = 0 -> hidden from the agent
            if _clean(r.get("name")) and subcategory:
                _HIDDEN.append({"name": _clean(r.get("name")), "brand": _clean(r.get("brand")) or "",
                                "brand_ur": _clean(r.get("brand_ur")) or "", "family": subcategory})
            continue
        pid = _num(r.get("id"))
        pid = int(pid) if pid is not None else i + 1
        if pid in used_ids:                         # same id twice: keep BOTH products, give the later one a new id
            new_id = max(used_ids | {int(v) for v in df["id"].dropna()}) + 1
            print(f"⚠️ Duplicate id {pid}: '{_clean(r.get('name'))}' got new id {new_id} (fix the id column in your Excel)")
            pid = new_id
        used_ids.add(pid)
        rows.append(Product(
            id=pid,
            name=_clean(r.get("name")),
            brand=_clean(r.get("brand")) or "Generic",
            category=_clean(r.get("category")),
            subcategory=subcategory,
            package_size=_clean(r.get("package_size")) or None,
            unit=_clean(r.get("unit")) or None,
            brand_ur=_clean(r.get("brand_ur")) or None,
            aliases=_clean(r.get("aliases")) or None,
            price=price,
            image_url=(_clean(r.get("image_url")) or _clean(r.get("image")) or _clean(r.get("picture")) or None),
            stock_quantity=_num(r.get("stock_quantity")),
            is_active=1,
        ))

    db = SessionLocal()
    db.add_all(rows)
    db.commit()
    db.close()
    print(f"✅ Loaded {len(rows)} products from {path}")


Base.metadata.create_all(bind=engine)


def ensure_columns():
    """An older asanmart.db has an orders table without the new columns: add them (no data is lost)."""
    try:
        have = {c["name"] for c in sql_inspect(engine).get_columns("orders")}
        with engine.begin() as con:
            for col, typ in (("user_id", "VARCHAR"), ("session_id", "VARCHAR"), ("created_at", "TIMESTAMP"), ("source", "VARCHAR"),
                             ("customer_name", "VARCHAR"), ("phone", "VARCHAR"), ("address", "VARCHAR"), ("city", "VARCHAR"),
                             ("delivery_slot", "VARCHAR"), ("subtotal", "FLOAT"), ("delivery_fee", "FLOAT")):
                if col not in have:
                    con.execute(sql_text(f"ALTER TABLE orders ADD COLUMN {col} {typ}"))
    except Exception as e:
        print(f"ℹ️ orders table check skipped: {e}")
    try:
        have_p = {c["name"] for c in sql_inspect(engine).get_columns("products")}
        if "is_active" not in have_p:
            with engine.begin() as con:
                con.execute(sql_text("ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1"))
    except Exception as e:
        print(f"ℹ️ products table check skipped: {e}")


ensure_columns()
load_csv_into_db()

# In-memory catalog (no DB query per turn -> faster)
PRODUCTS = {}       # id -> dict
BY_FAMILY = {}      # family -> [dict]
BRANDS = {}         # family -> [brand, ...] sorted by number of products desc
# ---- product pictures --------------------------------------------------------------------------------------
# The backend finds the picture of every product by itself and serves it, so the frontend only shows `image_url`.
# It looks inside frontend/public (or IMAGES_DIR) for  <id>.png/.jpg/.jpeg/.webp  or  <product-name-slug>.png.
API_BASE = os.getenv("API_BASE", "http://localhost:8000").rstrip("/")
_here = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = next((d_ for d_ in [os.getenv("IMAGES_DIR", ""), os.path.join(_here, "..", "frontend", "public"),
                                 os.path.join(_here, "public"), os.path.join(_here, "images")] if d_ and os.path.isdir(d_)), None)
_IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")
_IMG_INDEX = {}      # stem -> [relative paths]
if IMAGES_DIR:
    app.mount("/pics", StaticFiles(directory=IMAGES_DIR), name="pics")
    for _root, _dirs, _files in os.walk(IMAGES_DIR):
        for _f in _files:
            if _f.lower().endswith(_IMG_EXT):
                _rel = "/" + os.path.relpath(os.path.join(_root, _f), IMAGES_DIR).replace(os.sep, "/")
                _IMG_INDEX.setdefault(os.path.splitext(_f)[0].lower(), []).append(_rel)


def _slug(x):
    return re.sub(r"[^a-z0-9]+", "-", (x or "").lower()).strip("-")


# Pictures kept in Supabase Storage (or any CDN): set IMAGE_BASE_URL and run upload_images_to_supabase.py once,
# it writes image_map.json (product id -> file name in the bucket).
IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL", "").rstrip("/")
try:
    with open(os.path.join(_here, "image_map.json"), encoding="utf-8") as _f:
        IMAGE_MAP = json.load(_f)
except Exception:
    IMAGE_MAP = {}


def find_image(pid, name, subcategory, cell):
    """Storage URL (if IMAGE_BASE_URL is set) -> dataset path if the file exists -> <id>.ext (prefer the right folder)
    -> <name-slug>.ext -> None"""
    if IMAGE_BASE_URL and IMAGE_MAP.get(str(pid)):
        return f"{IMAGE_BASE_URL}/{IMAGE_MAP[str(pid)]}"
    cell = (cell or "").strip()
    if cell.startswith("="):                      # broken Excel formula, not a real path
        cell = ""
    if not IMAGES_DIR:
        return cell if cell.startswith(("/", "http")) else None   # let the frontend try the path itself
    cell = cell.replace("%20", " ")
    if cell.startswith("/") and os.path.isfile(os.path.join(IMAGES_DIR, cell.lstrip("/"))):
        return f"{API_BASE}/pics{cell.replace(' ', '%20')}"
    for stem in (str(pid), _slug(name)):
        paths = _IMG_INDEX.get(stem, [])
        if not paths:
            continue
        pref = [p_ for p_ in paths if _slug(subcategory).split("-")[0] in p_.lower()]
        return f"{API_BASE}/pics{(pref or paths)[0].replace(' ', '%20')}"
    return cell.replace(" ", "%20") if cell.startswith(("/", "http")) else None   # backend can't see the file: frontend may


@app.get("/debug/images")
def debug_images():
    """Open http://localhost:8000/debug/images to see why a picture is not found."""
    return {"images_dir": IMAGES_DIR, "files_found": sum(len(v) for v in _IMG_INDEX.values()),
            "sample_files": [v[0] for v in list(_IMG_INDEX.values())[:10]],
            "sample_products": [{"id": p_["id"], "name": p_["name"], "image_url": p_["image_url"]} for p_ in list(PRODUCTS.values())[:10]]}


# ---- the agent LEARNS from confirmed orders -----------------------------------------------------------------
# When an order is confirmed, the words the customer used for each item are remembered for that product
# (e.g. "لعل لوبیا" -> Red Kidney Beans). Next time those words find the product directly. Delete the file to reset.
LEARN_PATH = os.getenv("LEARN_PATH", os.path.join(_here, "learned_aliases.json"))
LOG_PATH = os.getenv("TURN_LOG", os.path.join(_here, "logs", "turns.jsonl"))
try:
    LEARNED = {int(k): v for k, v in json.load(open(LEARN_PATH, encoding="utf-8")).items()}
except Exception:
    LEARNED = {}


def learn_from_cart():
    changed = False
    skip = set(FILLER) | set(NUM_WORDS) | set(UNIT_CANON) | _UR_STOP | set(_ONES) | set(_TENS)
    for c in current_cart:
        pid, said = c["id"], c.get("said") or ""
        if pid not in PRODUCTS:
            continue
        own = {_tok_norm(w) for w in _tokens(PRODUCTS[pid]["name"] + " " + PRODUCTS[pid].get("aliases", ""))}
        for w in _tokens(said):
            if w in skip or w.isdigit() or _tok_norm(w) in own or len(w) < 3:
                continue
            bucket = LEARNED.setdefault(pid, {})
            if len(bucket) < 8:
                bucket[w] = bucket.get(w, 0) + 1
                changed = True
    if changed:
        try:
            json.dump({str(k): v for k, v in LEARNED.items()}, open(LEARN_PATH, "w", encoding="utf-8"), ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ could not save learned aliases: {e}")


def log_turn(stage, family, utt, reply):
    """Every turn is written to logs/turns.jsonl; turns where the agent said 'sorry' are the ones to study."""
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        failed = reply.strip().startswith(("Sorry", "معذرت"))
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps({"t": time.strftime("%Y-%m-%d %H:%M:%S"), "stage": stage, "family": family, "lang": utt.lang,
                                "said": utt.text, "reply": reply[:300], "failed": failed}, ensure_ascii=False) + "\n")
    except Exception:
        pass


@app.get("/debug/failures")
def debug_failures():
    """Open http://localhost:8000/debug/failures — the last turns the agent did not understand."""
    try:
        rows = [json.loads(l) for l in open(LOG_PATH, encoding="utf-8")]
    except Exception:
        rows = []
    return [r for r in rows if r["failed"]][-50:]


BRAND_FAMS = {}     # brand (lower case, English and Urdu) -> set of families it sells in
BRAND_UR = {}       # brand -> Urdu-script name (from the brand_ur column)
DATA_ALIASES = {}   # family -> spoken words collected from the aliases column


def canonical_families(names):
    """One dataset often spells the same family several ways ("BodyWash" / "Bodywash", "Spread" / "Spreads" /
    "Spreads & Honey"). They are merged into the most used spelling (preferring a name the agent already has words for)."""
    def key(n):
        k = re.split(r"\s*(?:&|,| and )\s*", (n or "").lower())[0]
        k = re.sub(r"[^a-z\u0600-\u06ff]", "", k)
        return k[:-1] if k.endswith("s") and len(k) > 3 else k
    groups = {}
    for n in names:
        if n:
            groups.setdefault(key(n), {}).setdefault(n, 0)
            groups[key(n)][n] += 1
    canon = {}
    for variants in groups.values():
        if len(variants) > 1:
            known = globals().get("FAMILY_ALIASES", {})
            best = max(variants, key=lambda v: (v in known, variants[v]))
            canon.update({v: best for v in variants})
            print(f"ℹ️ Same family written differently in your dataset, merged into '{best}': {', '.join(v for v in variants if v != best)}")
    return canon


def nice_size(package_size, unit):
    """'200.0' + 'g' -> '200 g', '6' + 'Pieces' -> '6 pcs' (so the agent can compare sizes by unit)."""
    size, unit = (package_size or "").strip(), (unit or "").strip()
    if size and re.fullmatch(r"\d+(?:\.\d+)?", size) and unit:
        num = float(size)
        u = {"pieces": "pcs", "piece": "pcs", "gm": "g", "ltr": "L", "l": "L"}.get(unit.lower(), unit)
        return f"{int(num) if num.is_integer() else num} {u}"
    return size or unit or "pack"


def build_catalog():
    PRODUCTS.clear(); BY_FAMILY.clear(); BRANDS.clear(); BRAND_UR.clear(); DATA_ALIASES.clear(); BRAND_FAMS.clear()
    db = SessionLocal()
    every_row = db.query(Product).all()
    all_rows = [p for p in every_row if p.is_active != 0]
    _HIDDEN[:] = [h for h in _HIDDEN if not h.get("db")] + [
        {"name": p.name, "brand": p.brand or "", "brand_ur": p.brand_ur or "", "family": p.subcategory, "db": True}
        for p in every_row if p.is_active == 0 and p.name and p.subcategory]
    canon = canonical_families([p.subcategory for p in all_rows])
    for p in all_rows:
        p.subcategory = canon.get(p.subcategory, p.subcategory)
        d = {"id": p.id, "name": p.name, "brand": p.brand, "family": p.subcategory,
             "aliases": p.aliases or "", "brand_ur": p.brand_ur or "", "ptype": "",
             "size": nice_size(p.package_size, p.unit), "price": float(int(p.price + 0.5)), "image_url": find_image(p.id, p.name, p.subcategory, p.image_url), "stock": p.stock_quantity}
        PRODUCTS[p.id] = d
        if p.brand_ur:
            BRAND_UR[p.brand] = p.brand_ur
        if p.brand and p.brand != "Generic":
            for key_ in (p.brand.lower(), p.brand_ur):
                if key_:
                    BRAND_FAMS.setdefault(key_, set()).add(p.subcategory)
        for a in re.split(r"[;,،]", p.aliases or ""):
            a = a.strip()
            # short spoken words only: no digits, max 3 words, no brand inside (brands are matched separately)
            if (a and len(a.split()) <= 3 and not re.search(r"\d", a)
                    and (p.brand or "").lower() not in a.lower() and (p.brand_ur or "\0") not in a):
                DATA_ALIASES.setdefault(p.subcategory, set()).add(a)
        BY_FAMILY.setdefault(p.subcategory, []).append(d)
    db.close()
    for fam, items in BY_FAMILY.items():
        counts = {}
        for it in items:
            counts[it["brand"]] = counts.get(it["brand"], 0) + 1
        BRANDS[fam] = sorted(counts, key=lambda b: (-counts[b], b.lower()))


build_catalog()
print("📦 Families in your dataset:", ", ".join(sorted(BY_FAMILY)))
_no_pic = [p_["id"] for p_ in PRODUCTS.values() if not p_["image_url"]]
print(f"🖼️ Pictures: folder = {IMAGES_DIR or 'NOT FOUND (set IMAGES_DIR)'} | {len(PRODUCTS) - len(_no_pic)}/{len(PRODUCTS)} products have a picture"
      + (f" | missing ids: {_no_pic[:40]}{'...' if len(_no_pic) > 40 else ''}" if _no_pic else ""))

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None   # no key -> rules only

# ============================================================
# ALIASES — how people actually say each item family
# ============================================================

FAMILY_ALIASES = {
    "Flour": ["atta", "aata", "flour", "maida", "besan", "آٹا", "آٹے", "میدہ", "بیسن"],
    "Rice": ["rice", "chawal", "chaawal", "chaval", "چاول"],
    "Sugar": ["sugar", "cheeni", "chini", "چینی"],
    "Pulses": ["daal", "dal", "dals", "lentil", "lentils", "pulses", "chana", "masoor", "moong", "mash", "lobia",
               "دال", "چنا", "مسور", "مونگ", "ماش", "لوبیا"],
    "Salt": ["salt", "namak", "نمک"],
    "Oil & Ghee": ["cooking oil", "oil", "tel", "تیل", "آئل", "آیل"],
    "Cooking Oil": ["cooking oil", "oil", "tel", "canola", "sunflower", "sun flower", "سن فلاور", "تیل", "آئل", "آیل", "ائل", "ایل", "کوکنگ", "ککنگ", "کینولا"],
    "Olive Oil": ["olive oil", "olive", "زیتون"],
    "Ghee": ["ghee", "desi ghee", "گھی", "گی"],
    "Eggs": ["egg", "eggs", "anda", "ande", "انڈا", "انڈے", "انڈہ"],
    "Breads, Buns & Rolls": ["bread", "buns", "bun", "rolls", "double roti", "ڈبل روٹی", "بریڈ"],
    "Butter & Margarine": ["butter", "margarine", "makhan", "مکھن", "بٹر"],
    "Spreads & Honey": ["honey", "shahad", "jam", "spread", "nutella", "peanut butter", "شہد", "جیم"],
    "Instant Oats": ["oats", "oatmeal", "اوٹس"],
    "Nestle Breakfast": ["cereal", "cornflakes", "corn flakes", "nesquik", "سیریل"],
    "Fresh Chicken": ["chicken", "murghi", "murgi", "چکن", "مرغی"],
    "Frozen Chicken": ["frozen chicken", "nuggets", "فروزن چکن"],
    "Fresh Beef": ["beef", "bara gosht", "گائے کا گوشت", "بیف"],
    "Fresh Mutton": ["mutton", "chota gosht", "مٹن"],
    "Lip Care": ["lip balm", "lip care", "lip", "لپ بام"],
    "Oral Care": ["toothpaste", "toothbrush", "mouthwash", "oral care", "ٹوتھ پیسٹ", "ٹوتھ برش", "منجن"],
    "Bath & Body": ["soap", "bodywash", "body wash", "shower gel", "lotion", "body lotion", "صابن", "باڈی واش"],
    "Shampoo & Conditioner": ["shampoo", "conditioner", "شیمپو", "کنڈیشنر"],
    "Feminine Care": ["pads", "pad", "sanitary", "feminine", "پیڈز", "سینیٹری"],
    "Tissues": ["tissue", "tissues", "tissue paper", "napkin", "napkins", "ٹشو"],
    "Cotton & Swabs": ["cotton", "swabs", "ear buds", "earbuds", "روئی"],
    "Veet": ["veet", "hair removal", "ویٹ"],
}
# when both of these match, the more specific one wins
SPECIFIC_OVER = {"Olive Oil": "Oil & Ghee", "Frozen Chicken": "Fresh Chicken", "Ghee": "Oil & Ghee"}
SPECIFIC_OVER_MORE = {"Olive Oil": "Cooking Oil", "Ghee": "Cooking Oil"}
SPECIFIC_OVER_MORE_2 = {"Tea Whitener": "Tea", "Milk Powder": "Milk", "Instant Drinks": "Soft Drinks", "Juices": "Fruits",
                        "Soft Drinks": "Fruits", "Biscuits": "Chocolate", "Wafers": "Chocolate", "Milk": "Cream"}

FAMILY_UR = {
    "Cooking Oil": "کوکنگ آئل", "Flour": "آٹا", "Rice": "چاول", "Sugar": "چینی", "Pulses": "دال", "Salt": "نمک", "Oil & Ghee": "تیل", "Olive Oil": "زیتون کا تیل",
    "Ghee": "گھی", "Eggs": "انڈے", "Breads, Buns & Rolls": "ڈبل روٹی", "Butter & Margarine": "مکھن",
    "Spreads & Honey": "شہد اور سپریڈ", "Instant Oats": "اوٹس", "Fresh Chicken": "تازہ چکن",
    "Frozen Chicken": "فروزن چکن", "Fresh Beef": "بیف", "Fresh Mutton": "مٹن", "Oral Care": "ٹوتھ پیسٹ اور برش",
    "Bath & Body": "صابن اور باڈی واش", "Shampoo & Conditioner": "شیمپو", "Tissues": "ٹشو",
}

for _fam, _cfg in FAMILY_SHEET.items():            # spoken words kept in the dataset itself (no code change needed)
    _have = FAMILY_ALIASES.setdefault(_fam, [])
    for _w in re.split(r"[,،]", _cfg["en"] + "," + _cfg["ur"]):
        _w = _w.strip()
        if _w and _w.lower() not in (x.lower() for x in _have):
            _have.append(_w.lower() if _w.isascii() else _w)
    if _cfg["name_ur"]:
        FAMILY_UR[_fam] = _cfg["name_ur"]

for _fam, _items in BY_FAMILY.items():              # Urdu name of a family the code doesn't know: its most common plain Urdu alias
    if _fam not in FAMILY_UR:
        _cnt = {}
        _brands_ur = {q.get("brand_ur") for q in _items}
        for _q in _items:
            for _a in {x.strip() for x in re.split(r"[;,،]", _q.get("aliases", ""))}:
                if (_a and re.search(r"[\u0600-\u06FF]", _a) and not re.search(r"[\d a-zA-Z]", _a.replace(" ", ""))
                        and len(_a.split()) <= 2 and not any(b_ and b_ in _a for b_ in _brands_ur)):
                    _cnt[_a] = _cnt.get(_a, 0) + 1
        if _cnt:
            FAMILY_UR[_fam] = max(_cnt, key=lambda a_: (_cnt[a_], -len(a_)))

for _fam in BY_FAMILY:
    if _fam not in FAMILY_ALIASES:
        # still reachable: people can at least say the family's own name
        FAMILY_ALIASES[_fam] = [_fam.lower()]
        print(f"ℹ️ No spoken aliases for '{_fam}' — using its own name. Add it to FAMILY_ALIASES for Urdu/Roman words")


# extra spoken words, so "toothbrush" / "toilet paper" / "hand wash" can be recognised directly
for _fam, _extra in {
    "Oral Care": ["tooth paste", "tooth brush", "brush", "mouth wash", "ماؤتھ واش"],
    "Bath & Body": ["hand wash", "handwash", "body mist", "mist", "ہینڈ واش"],
    "Feminine Care": ["liner", "liners", "tampon", "tampons"],
    "Tissues": ["toilet paper", "toilet roll", "tissue roll", "kitchen roll", "paper towel", "tissue box",
                "facial tissue", "face tissue"],
    "Spreads & Honey": ["cheese spread", "cream cheese", "topping", "toppings", "ہنی"],
    "Sugar": ["شوگر"],
    "Eggs": ["ایگ", "ایگز"],
    "Breads, Buns & Rolls": ["rusk", "tortilla", "wrap", "wraps"],
}.items():
    FAMILY_ALIASES[_fam] += _extra

# words from the dataset's `aliases` column (e.g. "masoor", "کینولا") -> added to their family.
# A word that belongs to two families (e.g. "spread" / "chicken") is ambiguous, so it is dropped.
_owner = {}
for _fam, _words in DATA_ALIASES.items():
    for _w in _words:
        _owner.setdefault(_w.lower(), set()).add(_fam)
for _fam, _words in DATA_ALIASES.items():
    _words = {w for w in _words if len(_owner[w.lower()]) == 1 and len(w) > 2}
    _have = FAMILY_ALIASES.setdefault(_fam, [_fam.lower()])
    for _w in sorted(_words):
        if _w.lower() not in (x.lower() for x in _have):
            _have.append(_w.lower() if _w.isascii() else _w)

# spoken word -> product type inside the family (must match labels in TYPE_KEYWORDS)
ALIAS_TYPE = {
    "Oral Care": {"toothpaste": "toothpaste", "tooth paste": "toothpaste", "ٹوتھ پیسٹ": "toothpaste", "منجن": "toothpaste",
                  "toothbrush": "toothbrush", "tooth brush": "toothbrush", "brush": "toothbrush", "ٹوتھ برش": "toothbrush",
                  "mouthwash": "mouthwash", "mouth wash": "mouthwash", "ماؤتھ واش": "mouthwash"},
    "Bath & Body": {"soap": "soap", "صابن": "soap", "bodywash": "body wash", "body wash": "body wash",
                    "shower gel": "body wash", "باڈی واش": "body wash", "hand wash": "hand wash", "handwash": "hand wash",
                    "ہینڈ واش": "hand wash", "body mist": "body mist", "mist": "body mist",
                    "lotion": "lotion", "body lotion": "lotion", "لوشن": "lotion"},
    "Shampoo & Conditioner": {"shampoo": "shampoo", "شیمپو": "shampoo", "conditioner": "conditioner", "کنڈیشنر": "conditioner"},
    "Feminine Care": {"pads": "pads", "pad": "pads", "پیڈز": "pads", "liner": "liners", "liners": "liners",
                      "tampon": "tampons", "tampons": "tampons"},
    "Tissues": {"napkin": "napkins", "napkins": "napkins", "kitchen roll": "kitchen roll", "paper towel": "kitchen roll",
                "toilet paper": "toilet roll", "toilet roll": "toilet roll", "tissue roll": "toilet roll",
                "tissue box": "tissue box", "facial tissue": "tissue box", "face tissue": "tissue box"},
    "Cooking Oil": {"canola": "canola oil", "کینولا": "canola oil", "sunflower": "sunflower oil",
                    "cooking oil": "cooking oil", "tel": "cooking oil", "سن فلاور": "sunflower oil", "sun flower": "sunflower oil"},
    "Flour": {"atta": "atta", "aata": "atta", "آٹا": "atta", "آٹے": "atta", "maida": "maida", "میدہ": "maida",
              "besan": "besan", "بیسن": "besan"},
    "Spreads & Honey": {"honey": "honey", "shahad": "honey", "شہد": "honey", "ہنی": "honey", "jam": "jam", "جیم": "jam",
                        "peanut butter": "peanut butter", "nutella": "chocolate spread",
                        "cheese spread": "cheese", "cream cheese": "cheese", "topping": "toppings", "toppings": "toppings"},
    "Breads, Buns & Rolls": {"bread": "bread", "بریڈ": "bread", "double roti": "bread", "ڈبل روٹی": "bread",
                             "bun": "buns", "buns": "buns", "rolls": "rolls", "rusk": "rusk",
                             "tortilla": "wraps", "wrap": "wraps", "wraps": "wraps"},
}


# Everyday items that may sit under any family name in the dataset (or have no family of their own, e.g. rice).
# "say" = how people ask for it (English / Roman Urdu / Urdu script), "find" = words to look for in product names.
# To support a new item, just add a line here.
EXTRA_ITEMS = {
    "rice":     {"say": ["rice", "chawal", "chaawal", "chaval", "چاول"], "find": ["rice", "basmati", "sella", "chawal"], "ur": "چاول"},
    "milk":     {"say": ["milk", "doodh", "dudh", "دودھ"], "find": ["milk"], "ur": "دودھ"},
    "tea":      {"say": ["tea", "chai", "چائے", "چاے"], "find": ["tea", "chai"], "ur": "چائے"},
    "biscuit":  {"say": ["biscuit", "biscuits", "بسکٹ"], "find": ["biscuit", "cookie"], "ur": "بسکٹ"},
    "onion":    {"say": ["onion", "pyaaz", "pyaz", "piyaz", "پیاز"], "find": ["onion"], "ur": "پیاز"},
    "potato":   {"say": ["potato", "aloo", "alu", "آلو"], "find": ["potato"], "ur": "آلو"},
    "tomato":   {"say": ["tomato", "tamatar", "ٹماٹر"], "find": ["tomato"], "ur": "ٹماٹر"},
    "yogurt":   {"say": ["yogurt", "yoghurt", "dahi", "curd", "دہی"], "find": ["yogurt", "yoghurt", "dahi"], "ur": "دہی"},
    "juice":    {"say": ["juice", "jus", "jooce", "جوس"], "find": ["juice"], "ur": "جوس"},
    "water":    {"say": ["water", "pani", "پانی"], "find": ["water"], "ur": "پانی"},
    "noodles":  {"say": ["noodles", "noodle", "nodles", "نوڈلز"], "find": ["noodle"], "ur": "نوڈلز"},
    "coffee":   {"say": ["coffee", "kofi", "کافی"], "find": ["coffee"], "ur": "کافی"},
    "detergent": {"say": ["detergent", "surf", "washing powder", "سرف"], "find": ["detergent", "washing powder", "surf"], "ur": "سرف"},
}
_KW_FAMILY = {}


def _name_has(name, words):
    low = name.lower()
    return any(re.search(rf"(?<![a-z]){re.escape(w)}", low) for w in words)


def kw_family(term):
    """Which dataset family holds most of the products whose NAME mentions this item (None if there are none)."""
    if term not in _KW_FAMILY:
        counts = {}
        for fam, items in BY_FAMILY.items():
            n = sum(1 for p in items if _name_has(p["name"], EXTRA_ITEMS[term]["find"]))
            if n:
                counts[fam] = n
        _KW_FAMILY[term] = max(counts, key=counts.get) if counts else None
    return _KW_FAMILY[term]


def detect_extra(text, found):
    out = []
    low = text.lower()
    for term, cfg in EXTRA_ITEMS.items():
        if any(term in f.lower() for f, _ in found):       # the dataset already has a family with this name
            continue
        at = -1
        for a in cfg["say"]:
            if a.isascii():
                m = re.search(rf"(?<![a-z]){re.escape(a)}(?:s|es)?(?![a-z])", low)
                at_a = m.start() if m else -1
            else:
                at_a = text.find(a)
            if at_a >= 0 and (at < 0 or at_a < at):
                at = at_a
        fam = kw_family(term) if at >= 0 else None
        if fam and (fam, None) in found:         # the family already covers this word (onion -> Vegetables)
            continue
        if fam:
            out.append(((fam, "kw:" + term), at))
    return out


def find_native(text, a):
    """Position of an Urdu word; very short words (2-3 letters) must be a whole word, not part of another word."""
    if len(a) > 3:
        return text.find(a)
    m = re.search(rf"(?<![\u0600-\u06FF]){re.escape(a)}(?![\u0600-\u06FF])", text)
    return m.start() if m else -1


def _drop_explained(text, found):
    """"apple jam": 'apple' alone would start Fruits, but the dataset has a product 'Apple Jam' that explains BOTH words,
    so only its family counts. Same for 'tea whitener', 'chicken spread' ... (no word list needed)."""
    allp = list(PRODUCTS.values())
    scores = rank_products(allp, text)
    if not scores or max(scores) <= 0:
        return found
    best = max(scores)
    tops = [p for p, sc in zip(allp, scores) if sc >= best - 1e-9]
    fams_top = {p["family"] for p in tops}
    if len(fams_top) != 1:
        return found
    g = next(iter(fams_top))
    if g not in {f for f, _ in found}:
        return found
    low = text.lower()
    toks = set(_product_tokens(tops[0]))
    keep = []
    for fam, pt in found:
        if fam == g:
            keep.append((fam, pt))
            continue
        words = []
        for a in FAMILY_ALIASES.get(fam, []):
            hit = (re.search(r"(?<!\w)" + re.escape(a) + r"(?!\w)", low) if a.isascii() else find_native(text, a) >= 0)
            if hit:
                words += _tokens(a)
        explained = bool(words) and all(any(_tok_strength(w, t_) >= 0.8 for t_ in toks) for w in words)
        if not explained:
            keep.append((fam, pt))
    return keep


def detect_families(text: str):
    """Returns [(family, product_type_or_None)] in the ORDER the user said them.
    'toothbrush' -> ('Oral Care', 'toothbrush')."""
    low = text.lower()
    pos = {}                                  # (family, type) -> position of first mention
    for fam, aliases in FAMILY_ALIASES.items():
        if fam not in BY_FAMILY:
            continue
        amap = ALIAS_TYPE.get(fam, {})
        for a in aliases:
            if a.isascii():
                m = re.search(rf"(?<![a-z]){re.escape(a)}(?:s|es)?(?![a-z])", low)
                at = m.start() if m else -1
            else:
                at = find_native(text, a)
            if at < 0:
                continue
            key = (fam, amap.get(a))
            pos[key] = min(at, pos.get(key, at))
        # a typed mention ("toothbrush") makes the generic family mention redundant
        if any(k[0] == fam and k[1] for k in pos):
            pos.pop((fam, None), None)
    answering = False
    if current is not None and current.get("stage") in ("brand", "type", "variant", "quantity"):
        skip_ = set(FILLER) | set(NUM_WORDS) | set(UNIT_CANON) | _UR_STOP | set(_ONES) | set(_TENS) | _SAU
        said_ = [w for w in _tokens(text) if w not in skip_ and not w.isdigit()]
        ctx_ = set().union(*[_product_tokens(p_) for p_ in (current.get("all_variants") or current.get("pool") or [])]) \
            if (current.get("all_variants") or current.get("pool")) else set()
        answering = any(_tok_strength(w, t_) >= 0.8 for w in said_ for t_ in ctx_)   # the words fit the item we are asking about
    for fam_, at_ in ([] if answering else infer_families(text, {f for f, _ in pos})):      # words learned from the dataset itself
        pos.setdefault((fam_, None), at_)
    found = [k for k, _ in sorted(pos.items(), key=lambda kv: kv[1])]
    present = {f for f, _ in found}
    for specific, general in {**SPECIFIC_OVER, **SPECIFIC_OVER_MORE, **SPECIFIC_OVER_MORE_2}.items():
        if specific in present and general in present:
            found = [(f, pt) for f, pt in found if f != general]
    if "peanut butter" in low and low.count("butter") == low.count("peanut butter"):
        found = [(f, pt) for f, pt in found if f != "Butter & Margarine"]
    if not found:                              # only a brand was said ("Pepsi chahiye") and it sells in ONE family
        hits = []
        for key_, fams_ in BRAND_FAMS.items():
            if len(fams_) != 1 or len(key_) < 3:
                continue
            at_ = (re.search(rf"(?<![a-z]){re.escape(key_)}(?![a-z])", low) or None) if key_.isascii() else None
            pos_ = at_.start() if at_ else text.find(key_)
            if pos_ >= 0:
                hits.append(((next(iter(fams_)), None), pos_))
        found = [k for k, _ in sorted(hits, key=lambda kv: kv[1])]
    extra = detect_extra(text, found)
    if extra:                                  # keep everything in the order it was spoken
        placed = [(k, pos.get(k, 0)) for k in found] + extra
        found = [k for k, _ in sorted(placed, key=lambda kv: kv[1])]
    if len(found) >= 2:
        found = _drop_explained(text, found)
    if found and not answering:
        found = _rescue_by_catalogue(text, found)
    return found


_RESCUE_CACHE = {}


def _rescue_by_catalogue(text, found):
    """"Lays / leis in french cheese flavor": the word 'cheese' points to the Cheese family, but the rare words together
    ('french' + 'cheese') belong to Lay's chips. When one product of ANOTHER family matches the sentence clearly better than
    anything in the family we found, that family is the right one. Only for the clear single-family case."""
    fams = {f for f, _ in found}
    if len(fams) != 1 or len(PRODUCTS) < 20 or len(tokens(text)) < 2:
        return found
    key = (text.lower(), tuple(sorted(fams)))
    if key in _RESCUE_CACHE:
        return _RESCUE_CACHE[key]
    result = found
    try:
        allp = list(PRODUCTS.values())
        scores = rank_products(allp, text)
        if scores:
            best = max(scores)
            bp = allp[scores.index(best)]
            mine = max((sc for p, sc in zip(allp, scores) if p["family"] in fams), default=0.0)
            if best >= 3.0 and bp["family"] not in fams and best >= mine + 1.5 and bp["family"] in BY_FAMILY:
                print(f"🔁 family corrected by product words: {sorted(fams)} -> {bp['family']}  ({bp['name']})")
                result = [(bp["family"], None)]
    except Exception as e:
        print(f"⚠️ family check skipped: {e}")
    if len(_RESCUE_CACHE) > 500:
        _RESCUE_CACHE.clear()
    _RESCUE_CACHE[key] = result
    return result


def detect_for_utt(utt):
    """Run detection on each transcript separately (so the spoken order is kept) and merge."""
    a, b = detect_families(utt.en), detect_families(utt.ur)
    base, other = (a, b) if len(a) >= len(b) else (b, a)
    return base + [p for p in other if p not in base]


_POOL_CACHE = {}


def pool_for(fam, ptype):
    """Products to choose from: the whole family, or only the chosen type (e.g. only toothbrushes)."""
    key = (fam, ptype)
    if key not in _POOL_CACHE:
        items = BY_FAMILY.get(fam, [])
        if ptype and ptype.startswith("kw:"):
            items = [p for p in items if _name_has(p["name"], EXTRA_ITEMS[ptype[3:]]["find"])] or items
        elif ptype:
            items = [p for p in items if product_type(fam, p["name"]) == ptype] or items
        _POOL_CACHE[key] = items
    return _POOL_CACHE[key]


def brands_in(pool):
    counts = {}
    for it in pool:
        counts[it["brand"]] = counts.get(it["brand"], 0) + 1
    return sorted(counts, key=lambda b: (-counts[b], b.lower()))


# ============================================================
# SESSION STATE
# ============================================================

current_cart = []     # [{id, name, brand, family, quantity, unit_price, size}]
queue = []            # item families still to be handled
current = None        # {"family", "stage": brand|variant|quantity, "brand", "variants", "product"}
order_pending_confirmation = False
checkout_ready = False    # CHECKOUT_MODE=store: the customer said "confirm" -> the website opens its own checkout
session_language = None
language_chosen = False   # the agent asks "English or Urdu?" first; true once the user has answered
SLOTS_EXTRA = {}      # (family, type) -> more slots when the SAME family is asked twice ("white chana and moong daal")
SLOTS = {}            # (family, type) -> {"clause": what the user said about it, "qty": "2 kilo" or None}


CURRENT_USER = None   # Supabase user id of the customer whose turn is being processed (None = guest)
CURRENT_SID = None


def reset_session_state():
    global current_cart, queue, current, order_pending_confirmation, checkout_ready, session_language, language_chosen, SLOTS, SLOTS_EXTRA
    current_cart, queue, current = [], [], None
    order_pending_confirmation = False
    checkout_ready = False
    session_language = None
    language_chosen = False
    SLOTS, SLOTS_EXTRA = {}, {}


# ============================================================
# MANY CUSTOMERS AT ONCE
# ============================================================
# Every customer (browser tab / logged-in user) has its own SessionState: cart, queue, current question, language.
# The code above works on the module variables, so before a turn the customer's state is switched in and afterwards
# it is saved back. Only the "thinking" part of a turn is serialised (it takes milliseconds); the slow parts
# (speech-to-text, text-to-speech) of different customers run in parallel.
# REDIS_URL (optional) keeps the states in Redis, so they survive a restart and work with several server processes.

STATE_FIELDS = ("current_cart", "queue", "current", "order_pending_confirmation", "checkout_ready", "session_language", "language_chosen",
                "SLOTS", "SLOTS_EXTRA")
SESSION_TTL = int(os.getenv("SESSION_TTL_SECONDS", "7200"))
SESSIONS = {}              # session id -> SessionState (memory)
_STATE_LOCK = None
REDIS_URL = os.getenv("REDIS_URL", "")
_redis = None
if REDIS_URL:
    try:
        import redis as _redis_lib
        _redis = _redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis.ping()
        print("✅ Redis connected: conversations survive restarts")
    except Exception as e:
        print(f"⚠️ Redis not used ({e}) — conversations are kept in memory")
        _redis = None


class SessionState:
    def __init__(self, sid, user_id=None):
        self.sid, self.user_id, self.touched = sid, user_id, time.time()
        self.current_cart, self.queue, self.current = [], [], None
        self.order_pending_confirmation, self.checkout_ready = False, False
        self.session_language, self.language_chosen = None, False
        self.SLOTS, self.SLOTS_EXTRA = {}, {}


def _dehyd(o):
    """State -> plain JSON (catalogue products are stored by id, tuples / tuple-keyed dicts are tagged)."""
    if isinstance(o, dict):
        if "id" in o and "family" in o and "price" in o and "brand" in o and PRODUCTS.get(o["id"]) is o:
            return {"__pid": o["id"]}
        if any(not isinstance(k, str) for k in o):
            return {"__kd": [[_dehyd(k), _dehyd(v)] for k, v in o.items()]}
        return {k: _dehyd(v) for k, v in o.items()}
    if isinstance(o, tuple):
        return {"__t": [_dehyd(x) for x in o]}
    if isinstance(o, (list, set)):
        return {"__s": [_dehyd(x) for x in o]} if isinstance(o, set) else [_dehyd(x) for x in o]
    return o


def _hyd(o):
    if isinstance(o, dict):
        if "__pid" in o:
            return PRODUCTS[o["__pid"]]
        if "__t" in o:
            return tuple(_hyd(x) for x in o["__t"])
        if "__s" in o:
            return set(_hyd(x) for x in o["__s"])
        if "__kd" in o:
            return {_hyd(k): _hyd(v) for k, v in o["__kd"]}
        return {k: _hyd(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_hyd(x) for x in o]
    return o


def _state_to_json(st):
    return json.dumps({"user_id": st.user_id, **{f: _dehyd(getattr(st, f)) for f in STATE_FIELDS}})


def _state_from_json(sid, raw):
    data = json.loads(raw)
    st = SessionState(sid, data.get("user_id"))
    for f in STATE_FIELDS:
        if f in data:
            setattr(st, f, _hyd(data[f]))
    return st


def _fetch_state(sid, user_id):
    if _redis is not None:
        try:
            raw = _redis.get(f"asanmart:session:{sid}")
            if raw:
                st = _state_from_json(sid, raw)
                st.user_id = user_id or st.user_id
                return st
        except Exception as e:
            print(f"⚠️ Redis read failed: {e}")
    st = SESSIONS.get(sid)
    if st is None:
        st = SessionState(sid, user_id)
        SESSIONS[sid] = st
    st.user_id = user_id or st.user_id
    return st


def peek_session(sid):
    """(language, language_chosen) of a customer without switching state in — used before speech-to-text."""
    st = SESSIONS.get(sid)
    if st is None and _redis is not None:
        try:
            raw = _redis.get(f"asanmart:session:{sid}")
            st = _state_from_json(sid, raw) if raw else None
        except Exception:
            st = None
    return (st.session_language or "english", st.language_chosen) if st else ("english", False)


def _purge_sessions():
    if len(SESSIONS) < 200:
        return
    cutoff = time.time() - SESSION_TTL
    for k in [k for k, v in SESSIONS.items() if v.touched < cutoff]:
        SESSIONS.pop(k, None)


class use_session:
    """async with use_session(sid, user_id): ...  -> the module variables hold THIS customer's state inside the block."""
    def __init__(self, sid, user_id=None):
        self.sid, self.user_id = sid or "default", user_id

    async def __aenter__(self):
        global _STATE_LOCK
        if _STATE_LOCK is None:
            _STATE_LOCK = asyncio.Lock()
        await _STATE_LOCK.acquire()
        try:
            self.st = _fetch_state(self.sid, self.user_id)
            g = globals()
            for f in STATE_FIELDS:
                g[f] = getattr(self.st, f)
            g["CURRENT_USER"], g["CURRENT_SID"] = self.st.user_id, self.sid
        except BaseException:
            _STATE_LOCK.release()
            raise
        return self.st

    async def __aexit__(self, *exc):
        try:
            g = globals()
            for f in STATE_FIELDS:
                setattr(self.st, f, g[f])
            self.st.touched = time.time()
            if _redis is not None:
                try:
                    _redis.set(f"asanmart:session:{self.sid}", _state_to_json(self.st), ex=SESSION_TTL)
                except Exception as e:
                    print(f"⚠️ Redis write failed: {e}")
            _purge_sessions()
        finally:
            _STATE_LOCK.release()
        return False


# ---- who is calling? (Supabase login is optional) -------------------------------------------------------------
def _env_any(*names):
    for n in names:
        v = (os.getenv(n) or "").strip().strip('"').strip("'")
        if v:
            return v
    return ""


# the same values the frontends use are accepted too (VITE_ prefix), so copying them over as they are also works
SUPABASE_URL = _env_any("SUPABASE_URL", "VITE_SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _env_any("SUPABASE_ANON_KEY", "SUPABASE_KEY", "VITE_SUPABASE_ANON_KEY")
print(f"🔐 Supabase login check: {'ON  (' + SUPABASE_URL + ')' if SUPABASE_URL and SUPABASE_ANON_KEY else 'OFF - SUPABASE_URL / SUPABASE_ANON_KEY not found in backend/.env'}")
REQUIRE_LOGIN = os.getenv("REQUIRE_LOGIN", "0") == "1"
ORDER_REQUIRES_LOGIN = os.getenv("ORDER_REQUIRES_LOGIN", "1") == "1"   # guests may browse / fill the cart, but must sign in to order
LOGIN_PROMPT = {}                                                        # session id -> True when a guest just tried to order by voice
_TOKEN_CACHE = {}          # token -> (expires_at, user dict)


def _verify_token_sync(token):
    hit = _TOKEN_CACHE.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("⚠️ SUPABASE_URL / SUPABASE_ANON_KEY are missing in backend/.env -> nobody can be recognised as signed in")
        return None
    try:
        r = http.get(f"{SUPABASE_URL}/auth/v1/user", headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}, timeout=4)
        if r.status_code != 200:
            print(f"⚠️ Supabase rejected the login token ({r.status_code}): {r.text[:160]} — check that SUPABASE_URL / SUPABASE_ANON_KEY in backend/.env are the SAME project as the frontend")
        if r.status_code == 200:
            u = r.json()
            user = {"id": u.get("id"), "email": u.get("email"), "name": (u.get("user_metadata") or {}).get("full_name"),
                    "role": (u.get("app_metadata") or {}).get("role")}
            _TOKEN_CACHE[token] = (time.time() + 300, user)
            if len(_TOKEN_CACHE) > 2000:
                _TOKEN_CACHE.clear()
            return user
    except Exception as e:
        print(f"⚠️ token check failed: {e}")
        if hit:                                   # network hiccup: the customer is still the same person -> keep their session
            _TOKEN_CACHE[token] = (time.time() + 60, hit[1])
            return hit[1]
        return "UNREACHABLE"                      # never seen this token and Supabase did not answer: do NOT pretend to be a guest
    return None


async def identify(request):
    """-> (session id, user dict or None). The browser sends X-Session-Id (a random id it keeps) and, when logged in,
    Authorization: Bearer <Supabase token>. A logged-in customer keeps ONE conversation across devices."""
    auth = request.headers.get("authorization", "")
    user = None
    if auth.lower().startswith("bearer "):
        user = await asyncio.to_thread(_verify_token_sync, auth[7:].strip())
        if user == "UNREACHABLE":                 # a guest session would look like an empty basket: ask the browser to retry instead
            raise HTTPException(status_code=503, detail="Sign-in check is slow right now, please try again.")
    if REQUIRE_LOGIN and user is None:
        raise HTTPException(status_code=401, detail="login required")
    sid = f"user:{user['id']}" if user else (request.headers.get("x-session-id") or "default")
    return sid[:80], user


def t(lang, en, ur):
    return ur if lang == "urdu" else en


def money(x, lang):
    """Always 'rupees' in English and 'روپے' in Urdu — never 'Rs'."""
    n = round(x)
    return f"{n} روپے" if lang == "urdu" else f"{n} rupees"


def fam_label(fam, lang):
    return FAMILY_UR.get(fam, fam) if lang == "urdu" else fam


def cap_join(items, cap, lang):
    s = t(lang, ", ", "، ").join(items[:cap])
    if len(items) > cap:
        s += t(lang, f" and {len(items) - cap} more", " اور مزید")
    return s


# ============================================================
# NUMBERS / SMALL HELPERS
# ============================================================

ARABIC_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

NUM_WORDS = {
    "one": 1, "ek": 1, "aik": 1, "ایک": 1, "two": 2, "do": 2, "دو": 2, "three": 3, "teen": 3, "تین": 3,
    "four": 4, "char": 4, "chaar": 4, "چار": 4, "five": 5, "panch": 5, "paanch": 5, "پانچ": 5,
    "six": 6, "chay": 6, "cheh": 6, "چھ": 6, "seven": 7, "saat": 7, "سات": 7, "eight": 8, "aath": 8, "آٹھ": 8,
    "nine": 9, "nau": 9, "نو": 9, "ten": 10, "das": 10, "دس": 10, "dozen": 12, "darjan": 12, "درجن": 12,
    "half": 0.5, "aadha": 0.5, "adha": 0.5, "آدھا": 0.5,
}

YES = {"yes", "yeah", "yep", "confirm", "confirmed", "ok", "okay", "sure", "haan", "han", "ji", "jee", "theek",
       "thik", "bilkul", "ہاں", "جی", "کنفرم", "ٹھیک", "بالکل", "اوکے"}
NO = {"no", "nope", "nahi", "nahin", "نہیں", "نہ"}
DONE = {"bas", "بس", "nothing", "enough", "done", "that's all", "thats all", "that is all", "nothing else", "no more", "bas itna", "bas yehi", "بس یہی", "بس اتنا", "بس اتنا ہی"}
CANCEL = {"cancel", "منسوخ", "کینسل"}
MORE = {"next", "more", "aur", "agla", "agli", "mazeed", "mazid", "aage", "اور", "اگلا", "اگلی", "مزید", "آگے", "نیکسٹ", "ہور"}
SET_WORDS = ["kar do", "kardo", "change", "update", "badal", "کر دو", "کردو", "بدل"]
ORDINALS = [(["first", "pehla", "pehli", "1st", "پہلا", "پہلی"], 0), (["second", "doosra", "doosri", "2nd", "دوسرا", "دوسری"], 1),
            (["third", "teesra", "teesri", "3rd", "تیسرا", "تیسری"], 2)]
CHEAP = ["sasta", "sasti", "saste", "sastay", "sasta wala", "cheap", "cheaper", "cheapest", "budget", "low price", "lowest price",
         "kam qeemat", "kam price", "kam rate", "kam daam", "کم قیمت", "کم ریٹ", "کم دام", "سستا", "سستی", "سستے", "سستی والا", "سستا والا"]
EXPENSIVE = ["mehenga", "mehnga", "mehngi", "mehnge", "premium", "expensive", "best", "acha", "highest price", "top quality",
             "مہنگا", "مہنگی", "مہنگے", "اچھا", "اعلیٰ", "بہترین"]
NO_PREFERENCE = ["any", "anything", "any brand", "whatever", "you choose", "you pick", "your choice", "doesnt matter",
                 "dont care", "dont know", "no idea", "koi bhi", "koi bhi chalega", "jo bhi", "jo bhi ho", "aap chun lo",
                 "aap bata do", "pata nahi", "pata nahin", "farq nahi", "فرق نہیں", "کوئی بھی", "جو بھی", "آپ چن لیں", "آپ بتا دیں",
                 "پتا نہیں", "معلوم نہیں", "کوئی بھی چلے گا"]


def tokens(text):
    return re.findall(r"[\w']+", text.lower().translate(ARABIC_DIGITS), flags=re.UNICODE)


def wants_more(text):
    """'next' / 'more' — but only in a SHORT sentence. 'aur' / 'اور' also means 'and', so in a long sentence
    ("...aur kuch order nahi karna...") it must not be read as 'show me the next page'."""
    return has_any(text, MORE) and len(tokens(text)) <= 6


def has_any(text, words):
    low = text.lower()
    toks = set(tokens(text))
    return any((w in toks) if " " not in w else (w in low) for w in words)


def parse_quantity_rules(text: str):
    text = text.translate(ARABIC_DIGITS)
    m = re.search(r"\d+(\.\d+)?", text)
    if m:
        return float(m.group())
    for tok in tokens(text):
        if tok in NUM_WORDS:
            return float(NUM_WORDS[tok])
    return None


def fmt_qty(q):
    return str(int(q)) if float(q).is_integer() else str(q)


# ============================================================
# LLM HELPERS (only used when the rules above can't decide)
# ============================================================

def _gemini_sync(prompt, max_tokens, system=None, json_mode=False, history=None):
    if gemini_client is None:
        raise RuntimeError("GEMINI_API_KEY is not set")
    cfg = types.GenerateContentConfig(max_output_tokens=max_tokens, system_instruction=system,
                                      response_mime_type="application/json" if json_mode else None)
    contents = (history or []) + [types.Content(role="user", parts=[types.Part(text=prompt)])]
    return gemini_client.models.generate_content(model=GEMINI_MODEL, contents=contents, config=cfg).text.strip()


GEMINI_TIMEOUT = float(os.getenv("GEMINI_TIMEOUT", "3.5"))     # seconds: a slow Gemini call must never freeze the agent


async def _agem(*args):
    """Gemini call that gives up after GEMINI_TIMEOUT seconds (the caller then uses its normal fallback)."""
    return await asyncio.wait_for(asyncio.to_thread(_gemini_sync, *args), GEMINI_TIMEOUT)


async def _aextract(text, language, history):
    try:
        return await asyncio.wait_for(asyncio.to_thread(understand_and_extract, text, language, history), GEMINI_TIMEOUT + 1.5)
    except Exception as e:
        print(f"⚠️ Gemini timeout/failed: {e!r}")
        return {"intent": "chat", "items": [], "reply_text": ""}


async def llm_pick(user_text: str, options: list, what: str):
    """Returns the index of the option the user meant, or None."""
    listing = "\n".join(f"{i + 1}. {o}" for i, o in enumerate(options))
    prompt = (f'The user was asked to choose {what} from:\n{listing}\nUser said (may be Urdu script / Roman Urdu / English): '
              f'"{user_text}"\nReply with ONLY the number of the best match, or NONE if unclear.')
    try:
        out = await _agem(prompt, 8)
    except Exception as e:
        print(f"⚠️ llm_pick failed: {e}")
        return None
    m = re.search(r"\d+", out)
    if m and 1 <= int(m.group()) <= len(options):
        return int(m.group()) - 1
    return None


async def llm_quantity(user_text: str):
    prompt = f'Extract the numeric quantity from: "{user_text}". Reply with ONLY a number (decimals ok) or NONE.'
    try:
        out = await _agem(prompt, 8)
        return float(out)
    except Exception:
        return None


# ============================================================
# FLOW:  item -> brands -> (pack size) -> quantity -> price -> next item
# ============================================================

TYPE_KEYWORDS = {   # (label, urdu label, strong keywords found in product names)
    "Oral Care": [("toothpaste", "ٹوتھ پیسٹ", ["toothpaste", "tooth paste", "paste", "ٹوتھ پیسٹ", "پیسٹ"]),
                  ("toothbrush", "ٹوتھ برش", ["toothbrush", "tooth brush", "brush", "ٹوتھ برش", "برش"]),
                  ("mouthwash", "ماؤتھ واش", ["mouthwash", "mouth wash", "ماؤتھ واش"])],
    "Bath & Body": [("body wash", "باڈی واش", ["body wash", "bodywash", "shower", "باڈی واش"]),
                    ("hand wash", "ہینڈ واش", ["hand wash", "handwash", "ہینڈ واش"]),
                    ("body mist", "باڈی مسٹ", ["mist"]),
                    ("soap", "صابن", ["soap", "bar", "صابن"]),
                    ("lotion", "لوشن", ["lotion", "cream", "لوشن"])],
    "Shampoo & Conditioner": [("shampoo", "شیمپو", ["shampoo", "شیمپو"]), ("conditioner", "کنڈیشنر", ["conditioner", "کنڈیشنر"])],
    "Feminine Care": [("pads", "پیڈز", ["pad", "پیڈ"]), ("tampons", "ٹیمپونز", ["tampon", "tampax"]),
                      ("liners", "لائنرز", ["liner"])],
    "Tissues": [("napkins", "نیپکن", ["napkin"]), ("kitchen roll", "کچن رول", ["kitchen", "paper towel"]),
                ("toilet roll", "ٹوائلٹ رول", ["toilet", "tissue roll", "roll"]),
                ("tissue box", "ٹشو باکس", ["box", "pop up", "pop-up", "hop up", "facial", "soft pack", "party pack",
                                           "dispenser", "sheets", "pieces", "pouch"])],
    "Cooking Oil": [("canola oil", "کینولا آئل", ["canola"]), ("sunflower oil", "سن فلاور آئل", ["sunflower"]),
                    ("cooking oil", "کوکنگ آئل", ["cooking", "gold oil", "oil"])],
    "Flour": [("atta", "آٹا", ["atta", "aata", "chakki", "آٹا"]), ("maida", "میدہ", ["maida", "میدہ"]),
              ("besan", "بیسن", ["besan", "بیسن"]),
              ("other flours", "دوسرے آٹے", ["rice flour", "barley", "bajra", "makai", "cornflour"])],
    "Spreads & Honey": [("honey", "شہد", ["honey", "شہد"]), ("jam", "جیم", ["jam", "jelly", "marmalade", "جیم"]),
                        ("peanut butter", "پیننٹ بٹر", ["peanut"]),
                        ("chocolate spread", "چاکلیٹ سپریڈ", ["chocolate", "nutella", "hazelnut", "biscoff", "cocoa"]),
                        ("cheese", "چیز", ["cheese"]), ("butter", "مکھن", ["butter"]),
                        ("toppings", "ٹاپنگز", ["topping"]),
                        ("sandwich spread", "سینڈوچ سپریڈ", ["chicken spread", "sandwich", "bar b que", "young's", "maska"])],
    "Breads, Buns & Rolls": [("bread", "ڈبل روٹی", ["bread"]), ("buns", "بنز", ["bun"]), ("rolls", "رولز", ["roll"]),
                             ("rusk", "رس", ["rusk", "toast"]), ("wraps", "ریپس", ["wrap"]),
                             ("bakery items", "بیکری آئٹمز", ["croissant", "sheermal", "papay", "combo"])],
}

TYPE_WEAK = {       # used only when no strong keyword matched (dataset names that don't say what they are)
    "Oral Care": {"toothpaste": ["gel", "fluoride", "whitening", "sensitive", "caries", "dentifrice", "crystals",
                                 "mineral", "red hot", "icy"],
                  "toothbrush": ["miswak", "multi colour", "morning fresh"], "mouthwash": ["listerine"]},
    "Bath & Body": {"soap": ["lux", "bouncy"], "lotion": ["nivea"], "body wash": ["washing gel"]},
    "Shampoo & Conditioner": {"shampoo": ["elvive", "tresemme", "sunsilk", "ogx"]},
    "Feminine Care": {"pads": ["maxi", "thin", "xxl", "long", "dreamy", "soft pack", "essentials", "sensitives",
                               "breathables", "regular", "tulip"]},
    "Tissues": {"tissue box": ["tissue", "hankies", "fay", "tux", "papila"]},
    "Flour": {"atta": ["fine", "wheat", "gandum", "flour"]},
    "Breads, Buns & Rolls": {"bread": ["dawn", "plain", "golden", "bran", "packet"]},
}


def product_type(fam, name):
    low = name.lower()
    for label, _, kws in TYPE_KEYWORDS.get(fam, []):
        if any(k in low for k in kws if k.isascii()):
            return label
    for label, _, _k in TYPE_KEYWORDS.get(fam, []):
        if any(k in low for k in TYPE_WEAK.get(fam, {}).get(label, [])):
            return label
    return None


def type_label(fam, label, lang):
    if label and label.startswith("kw:"):
        cfg = EXTRA_ITEMS.get(label[3:], {})
        return cfg.get("ur", label[3:]) if lang == "urdu" else label[3:]
    if lang != "urdu":
        return label
    return next((ur for l, ur, _ in TYPE_KEYWORDS.get(fam, []) if l == label), label)


def short_name(p):
    """Drop the brand prefix and dataset truncation so spoken names are short."""
    n = p["name"]
    if p["brand"] and n.lower().startswith(p["brand"].lower()):
        n = n[len(p["brand"]):].lstrip(" -:")
    return (n.rstrip(". ") or p["name"])


def start_next(lang):
    """Pops the next family from the queue and asks about its brands."""
    global current
    if current is not None:
        return None
    while queue:
        fam, ptype = queue.pop(0)
        if fam not in BY_FAMILY:
            continue
        pool = pool_for(fam, ptype)
        slot = SLOTS.pop((fam, ptype), None)       # what the user already told us about this item
        if slot is None and SLOTS_EXTRA.get((fam, ptype)):
            slot = SLOTS_EXTRA[(fam, ptype)].pop(0)
        if slot and slot.get("clause"):
            pool = narrow_products(pool, slot["clause"])   # "Dalda cooking oil" -> only Dalda cooking oils
            cp = count_as_pack(slot["clause"], pool)
            if cp:                                         # "six eggs" -> only the packs of 6
                pool = cp[1]
        brands = brands_in(pool)
        current = {"family": fam, "ptype": ptype, "pool": pool, "brands": brands, "stage": "brand", "brand": None,
                   "said": [slot["clause"]] if slot else [], "variants": [], "product": None, "page": 0, "brand_page": 0, "types": [], "shown": [], "slot": slot}
        if len(brands) == 1:
            return after_brand(lang, brands[0])
        if slot:
            said = match_brand_rules(slot["clause"], brands, strict=True)
            if said:                               # brand already given and it exists -> don't read the brands again
                d, s_ = after_brand(lang, said)
                pre = t(lang, f"{said}. ", f"{said}۔ ")
                return pre + d, pre + s_
        return ask_brand(lang)
    return None


# ---- brand ----------------------------------------------------------------

def ask_brand(lang, page=0):
    fam, ptype = current["family"], current["ptype"]
    brands = current["brands"]
    lbl = type_label(fam, ptype, lang) if ptype else fam_label(fam, lang)
    current["stage"] = "brand"
    full = t(lang, ", ", "، ").join(brands)
    if len(brands) <= BRAND_READ_ALL:
        d = t(lang, f"For {lbl}, we have: {full}. Which brand would you like?",
              f"{lbl}: یہ برانڈز دستیاب ہیں: {full}۔ کونسا برانڈ چاہیے؟")
        return d, d
    start = page * BRAND_PAGE
    if start >= len(brands):
        page, start = 0, 0
    current["brand_page"] = page
    chunk = t(lang, ", ", "، ").join(brands[start:start + BRAND_PAGE])
    text = t(lang, f"For {lbl}, we have {len(brands)} brands, like {chunk}. Say next for more, or tell me the brand you want.",
             f"{lbl} کے {len(brands)} برانڈز ہیں، جیسے {chunk}۔ مزید کے لیے اگلا کہیں، یا برانڈ کا نام بتائیں۔")
    return text, text


def _ur_skeleton(w):
    """Consonants only — STT writes the same brand with different vowels/ع/ئ ("معیز" / "موئز")."""
    return re.sub("[اآوىیيےئءعہۃھٰ\u064B-\u0652]", "", w)


def match_brand_rules(text: str, brands: list, strict: bool = False, words_only: bool = False):
    """strict=True is used on a sentence the user said earlier ("2 kilo Sunridge atta"): only a real brand
    mention counts, so words like "acha" or "best" never choose a brand by accident."""
    low = text.lower()
    for b in sorted(brands, key=len, reverse=True):
        if b.lower() in low:
            return b
    for b in brands:                         # brand said in Urdu script ("ڈالڈا") — no Gemini call needed
        ur = BRAND_UR.get(b)
        if ur and ur in text:
            return b
        if ur:                                # STT spells Urdu brands differently ("معیز" vs "موئز")
            for w in re.findall(r"[\u0600-\u06FF]+", text):
                if w in _UR_STOP or w in FILLER:
                    continue
                if len(w) >= 3 and (difflib.SequenceMatcher(None, w, ur).ratio() >= 0.75
                                    or (_ur_skeleton(w) == _ur_skeleton(ur) and len(_ur_skeleton(ur)) >= 2)):
                    return b
    words = re.findall(r"[a-z0-9]+", low)
    for b in brands:
        for tok in b.lower().split():
            if len(tok) >= 4 and tok in words:
                return b
    lowmap = {b.lower(): b for b in brands}
    for w in words:
        if len(w) < 4 or (strict and w in FILLER):
            continue
        m = difflib.get_close_matches(w, list(lowmap), n=1, cutoff=0.85 if strict else 0.78)
        if m:
            return lowmap[m[0]]
    if words_only:                           # only a brand NAME counts (no "cheap"/"expensive")
        return None
    if not strict and has_any(text.replace("'", ""), NO_PREFERENCE):
        return next((b for b in brands if b != "Generic"), brands[0])      # "any brand" -> the most common real brand
    prices = {b: min(p["price"] for p in current["pool"] if p["brand"] == b) for b in brands}
    if has_any(text, CHEAP):
        return min(prices, key=prices.get)
    if has_any(text, EXPENSIVE) and not strict:
        return max(prices, key=prices.get)
    return None


async def handle_brand(utt, lang):
    brands = current["brands"]
    brand = match_brand_rules(utt.both, brands)
    if not brand and wants_more(utt.both):
        return ask_brand(lang, current["brand_page"] + 1)
    if not brand:
        cf = await contextual_fallback(utt, lang)
        if cf:
            return cf
        i = await llm_pick(utt.both, brands, f"a brand of {current['ptype'] or current['family']}")
        brand = brands[i] if i is not None else None
    if not brand:
        d, s_ = ask_brand(lang, current["brand_page"])
        pre = t(lang, "Sorry, I didn't catch the brand. ", "معذرت، برانڈ سمجھ نہیں آیا۔ ")
        return pre + d, pre + s_
    d, s_ = after_brand(lang, brand)
    pre = t(lang, f"{brand}. ", f"{brand}۔ ")
    return pre + d, pre + s_


_UR_MAP = str.maketrans({"ك": "ک", "ي": "ی", "ى": "ی", "ے": "ی", "ۓ": "ی", "ئ": "ی", "آ": "ا", "ؤ": "و", "ۃ": "ہ", "ھ": "", "ٔ": ""})
_UR_STOP = {"مجھے", "چاہیے", "چاہئے", "چاہیں", "کا", "کی", "کے", "کو", "ایک", "دو", "تین", "چار", "پانچ", "اور", "والا", "والی",
            "والے", "دیں", "دیجیے", "کر", "ہے", "ہیں", "میں", "سے", "ہی", "بھی", "ذرا", "plz", "mujhe", "chahiye", "chahie", "aur", "ka", "ki", "ke"}


_PHON = str.maketrans({"ٹ": "ت", "ط": "ت", "ث": "س", "ص": "س", "ذ": "ز", "ض": "ز", "ظ": "ز", "ڈ": "د", "ڑ": "ر", "ق": "ک", "غ": "گ", "ں": "ن"})


def _tok_norm(w):
    return re.sub("[\u064B-\u0652\u0670]", "", w.lower().translate(_UR_MAP))


def _tok_skel(w):
    """Consonant skeleton with look-alike letters merged: 'ٹوتھ' and 'طوت' both become 'تت'."""
    return re.sub("[اویعہءھ]", "", _tok_norm(w).translate(_PHON))


def _tokens(text):
    return [w for w in re.findall(r"[\w]+", text.lower().translate(ARABIC_DIGITS)) if len(w) >= 2]


_TIGHT = str.maketrans({"ز": "س", "ذ": "س", "ض": "س", "ظ": "س", "ث": "س", "ص": "س", "ط": "ت", "ٹ": "ت", "ق": "ک", "غ": "گ",
                        "ں": "ن", "ڈ": "د", "ڑ": "ر", "ھ": None})


def _tok_tight(w):
    """Urdu spelling folded to how it SOUNDS: "کیلے" = "کیلا", "پیاس" = "پیاز" (z/s/zwad are one sound to the STT)."""
    n = _tok_norm(w).translate(_TIGHT)
    return re.sub("[ےیہۃ]$", "ا", n)


@lru_cache(maxsize=200000)
def _tok_strength(a, b):
    """How well two words match: 1.0 same word, 0.8 same consonants, 0.6 same short consonants, 0.7 very similar spelling."""
    na, nb = _tok_norm(a), _tok_norm(b)
    if na == nb:
        return 1.0
    if not (na.isascii() and nb.isascii()):                       # Urdu spellings differ a lot between STT runs
        if len(na) >= 3 and _tok_tight(a) == _tok_tight(b):
            return 0.9
        sa, sb = _tok_skel(a), _tok_skel(b)
        if sa == sb and len(sa) >= 3:
            return 0.8
        if sa == sb and len(sa) == 2 and na[:1] == nb[:1]:
            return 0.6
        if len(na) >= 3 and len(nb) >= 3 and min(len(na), len(nb)) >= max(len(na), len(nb)) - 1 \
                and (na.startswith(nb) or na.endswith(nb) or nb.startswith(na) or nb.endswith(na)):
            return 0.7                                         # "کلال" = "ک" + "لال" (STT glued two words)
    if len(na) >= 4 and len(nb) >= 4 and difflib.SequenceMatcher(None, na, nb).ratio() >= 0.85:
        return 0.7
    return 0.0


def _tok_match(a, b):
    return _tok_strength(a, b) > 0


_PTOK_CACHE = {}


def _product_tokens(p):
    key = (p["id"], len(LEARNED.get(p["id"], {})))
    if key not in _PTOK_CACHE:
        blob = " ".join([p["name"], p.get("aliases", ""), p.get("brand_ur", ""), p["brand"], " ".join(LEARNED.get(p["id"], {}))])
        _PTOK_CACHE[key] = frozenset(_tokens(blob))
    return _PTOK_CACHE[key]


def rank_products(pool, clause):
    """Score every product of `pool` against what the customer said (names, Urdu names, brands, the aliases column,
    learned words). Rare words count more, exact words count more than look-alike spellings. -> list of scores or None."""
    if not clause or not pool:
        return None
    skip = set(FILLER) | set(NUM_WORDS) | set(UNIT_CANON) | _UR_STOP | set(_ONES) | set(_TENS) | _SAU | GENERIC_DESCRIBERS | CHATTER
    said = [w for w in dict.fromkeys(_tokens(clause)) if w not in skip and not w.isdigit()]
    if not said:
        return None
    ptoks = [_product_tokens(p) for p in pool]
    n = len(pool)
    strength = [{w: max((_tok_strength(w, t_) for t_ in ts), default=0.0) for w in said} for ts in ptoks]
    weight = {}
    for w in said:
        df = sum(1 for st in strength if st[w] >= 0.9) or sum(1 for st in strength if st[w] > 0)
        weight[w] = 0.0 if df == 0 or df == n else math.log((n + 1) / df)
    return [sum(weight[w] * st[w] for w in said) for st in strength]


def narrow_products(pool, clause):
    """Understands what the customer said about ONE item by comparing it with every product. Returns the
    best-matching products (or the whole pool when nothing stands out)."""
    if len(pool) < 2:
        return pool
    scores = rank_products(pool, clause)
    if not scores or max(scores) <= 0:
        return pool
    best = max(scores)
    return [p for p, sc in zip(pool, scores) if sc >= best - 1e-9]


# ---- the agent's index of the WHOLE dataset: which words belong to which item family --------------------------
TOKEN_INDEX = {}          # phonetic word key -> {family: count}
_INDEX_READY = False


def _tok_key(w):
    return _tok_skel(w) if not w.isascii() else w.lower()


def _tok_keys(w):
    """Index keys of a word: the sound-alike spelling first (precise), then the consonant skeleton."""
    if w.isascii():
        return [w.lower()]
    tight = _tok_tight(w)
    return ([("T", tight)] if len(tight) >= 3 else []) + [_tok_skel(w)]


def build_token_index():
    global _INDEX_READY
    TOKEN_INDEX.clear()
    for p in PRODUCTS.values():
        blob = " ".join([p["name"], p.get("aliases", ""), p.get("brand_ur", ""), p["brand"], " ".join(LEARNED.get(p["id"], {}))])
        words_ = set(_tokens(blob))
        for phrase in [p.get("brand_ur", "")] + re.split(r"[;,،]", p.get("aliases", "")):     # "کوکا کولا" is also said as one word
            tk_ = [w for w in _tokens(phrase) if not w.isascii()]
            words_ |= {tk_[i] + tk_[i + 1] for i in range(len(tk_) - 1)}
        for w in words_:
            if (w.isascii() and len(w) < 3) or w.isdigit():
                continue
            for k in _tok_keys(w):
                if len(k if isinstance(k, str) else k[1]) >= 2:
                    TOKEN_INDEX.setdefault(k, {})
                    TOKEN_INDEX[k][p["family"]] = TOKEN_INDEX[k].get(p["family"], 0) + 1
    for fam, words in FAMILY_ALIASES.items():           # the agent also knows each family's own spoken words
        if fam in BY_FAMILY:
            for a in words:
                for w in _tokens(a):
                    for k in _tok_keys(w):
                        if len(k if isinstance(k, str) else k[1]) >= 2 and not (w.isascii() and len(w) < 3):
                            TOKEN_INDEX.setdefault(k, {})
                            TOKEN_INDEX[k][fam] = TOKEN_INDEX[k].get(fam, 0) + 1
    _INDEX_READY = True


# Describing words that happen to occur in only ONE family of the dataset (e.g. "flavor" only in a kids' toothpaste name)
# must never decide the family: "Lay's in french cheese flavor" is chips, not toothpaste.
GENERIC_DESCRIBERS = {"flavor", "flavors", "flavour", "flavours", "flavored", "flavoured", "taste", "tasty", "type", "types",
                      "kind", "kinds", "variety", "original", "classic", "regular", "special", "extra", "new", "kids",
                      "فلیور", "فلیورز", "ذائقہ", "ٹیسٹ", "ٹائپ", "قسم", "کلاسک", "اوریجنل", "ریگولر"}


# conversation words that are not product words ("Yes. I want ... The offer price seventy")
CHATTER = {"yes", "yeah", "no", "nope", "offer", "price", "prices", "rate", "cost", "rupees", "rupee", "rs", "pkr", "rupay", "want",
           "need", "give", "show", "please", "okay", "ok", "hello", "hi", "sorry", "actually", "only", "just", "too", "also", "its", "it",
           "this", "that", "those", "these", "my", "your", "in", "on", "at", "is", "are", "was", "am", "do", "does", "did", "have", "has",
           "can", "will", "would", "like", "get", "put", "add", "take", "buy", "order", "item", "items", "thing", "things", "one", "ones"}


def infer_families(text, known):
    """Finds item families from words that only (or mostly) occur in ONE family of the dataset, even when the speech
    to text spelled them differently ("پیش" / "پیسٹ", "کال گیٹ" = Colgate). -> [(family, position)] for NEW families."""
    if not _INDEX_READY:
        build_token_index()
    skip = set(FILLER) | set(NUM_WORDS) | set(UNIT_CANON) | _UR_STOP | set(_ONES) | set(_TENS) | _SAU | GENERIC_DESCRIBERS
    toks = [(m_.group(), m_.start()) for m_ in re.finditer(r"[\w]+", text.lower().translate(ARABIC_DIGITS)) if len(m_.group()) >= 2]
    score, first, sure = {}, {}, set()

    def add(fam, pts, at):
        score[fam] = score.get(fam, 0.0) + pts
        first[fam] = min(at, first.get(fam, at))
    skip_sound = {_tok_tight(x) for x in (skip | {"ملی", "ملیلیٹر", "لیٹرز", "گرامز", "کلوگرام"}) if not x.isascii()}
    for i, (w, at) in enumerate(toks):
        if w in skip or w.isdigit() or (not w.isascii() and _tok_tight(w) in skip_sound):
            continue
        # a brand said as two words ("کال گیٹ"): try the pair joined together as well
        variants = [(w, 1)]
        if i + 1 < len(toks) and not w.isascii() and not toks[i + 1][0].isascii():
            variants.append((w + toks[i + 1][0], 2))
        for cand, span in variants:
            fams = None
            for k in _tok_keys(cand):                      # exact sound first, then the loose consonant skeleton
                f_ = TOKEN_INDEX.get(k)
                if f_ and len(f_) <= 2 and (isinstance(k, tuple) or cand.isascii() or len(k) >= 3):
                    fams = f_
                    break
            if not fams:
                continue
            for fam in fams:
                add(fam, (1.0 if len(fams) == 1 else 0.5) * (1.0 if span == 1 else 1.2), at)
                if len(fams) == 1:
                    sure.add(fam)                          # at least one word that belongs to this family ONLY
    for fam in list(score):
        if fam in known or fam not in BY_FAMILY:
            score.pop(fam)
    return [(f, first[f]) for f, sc in sorted(score.items(), key=lambda kv: first[kv[0]]) if sc >= 1.0 and f in sure]


def narrow_by_clause(variants, clause, brand):
    """Keep the variants whose name shares the most words with what the customer already said
    (ignoring the brand, numbers and filler). Returns all variants when nothing matches."""
    skip = set(re.findall(r"[a-z]+", brand.lower())) | set(FILLER)
    for al in FAMILY_ALIASES.get(current["family"], []):
        skip |= set(re.findall(r"[a-z]+", al.lower()))
    words = [w for w in re.findall(r"[a-z]{3,}", clause.lower()) if w not in skip]
    if not words:
        return variants
    scored = []
    for v in variants:
        toks = set(re.findall(r"[a-z]+", v["name"].lower()))
        scored.append((sum(1 for w in words if w in toks), v))
    best = max(sc for sc, _ in scored)
    return [v for sc, v in scored if sc == best] if best else variants


def after_brand(lang, brand):
    current["brand"] = brand
    fam = current["family"]
    variants = sorted([p for p in current["pool"] if p["brand"] == brand], key=lambda p: p["price"])
    current["variants"] = variants
    current["all_variants"] = variants              # kept in full, even after the list is narrowed down
    if len(variants) == 1:
        return select_product(lang, variants[0])
    said = (current.get("slot") or {}).get("qty")
    if said:                                       # "1 kg rice": jump straight to the 1 kg pack if there is one
        want = size_pairs(numwords_to_digits(said))
        hits = [v for v in variants if same_size(want, size_pairs(v["name"] + " " + v["size"]))] if want else []
        if len(hits) == 1:
            return select_product(lang, hits[0])
        if 1 < len(hits) < len(variants):
            return ask_variant(lang, hits)
    if said or (current.get("slot") or {}).get("clause"):   # "Dawn plain bread large": use the other words he already said
        narrowed = narrow_by_clause(variants, (current.get("slot") or {}).get("clause", ""), brand)
        if len(narrowed) == 1:
            return select_product(lang, narrowed[0])
        if 1 < len(narrowed) < len(variants):
            return ask_variant(lang, narrowed)
    if len(variants) > READ_ALL_UP_TO:
        labels = []
        for v in variants:
            lab = product_type(fam, v["name"])
            if lab and lab not in labels:
                labels.append(lab)
        if len(labels) >= 2:       # first narrow by product type: "toothpaste, toothbrush or mouthwash?"
            current["stage"] = "type"
            current["types"] = labels
            names = t(lang, ", ", "، ").join(type_label(fam, l, lang) for l in labels)
            text = t(lang, f"{brand} has {len(variants)} products: {names}. Which do you need?",
                     f"{brand} کی {len(variants)} مصنوعات ہیں: {names}۔ کونسی چاہیے؟")
            return text, text
    return ask_variant(lang, variants)


# ---- type -----------------------------------------------------------------

async def handle_type(utt, lang):
    fam = current["family"]
    labels = current["types"]
    low = utt.both.lower()
    chosen = next((l for l, _, kws in TYPE_KEYWORDS.get(fam, [])
                   if l in labels and any((k in low) if k.isascii() else (k in utt.both) for k in kws)), None)
    if not chosen:
        i = await llm_pick(utt.both, labels, "a product type")
        chosen = labels[i] if i is not None else None
    if not chosen:
        names = t(lang, ", ", "، ").join(type_label(fam, l, lang) for l in labels)
        m = t(lang, f"Sorry, which one: {names}?", f"معذرت، کونسی: {names}؟")
        return m, m
    return apply_type(lang, chosen)


def apply_type(lang, chosen):
    fam = current["family"]
    filtered = [v for v in current["variants"] if product_type(fam, v["name"]) in (chosen, None)]
    if len(filtered) == 1:
        return select_product(lang, filtered[0])
    return ask_variant(lang, filtered)


def item_view(v, lang, spoken=False):
    return {"id": v["id"], "label": short_name(v), "name": v["name"], "brand": v["brand"], "size": v["size"],
            "price": v["price"], "price_text": money(v["price"], lang), "image_url": v.get("image_url"),
            "value": f"pid:{v['id']}", "spoken": spoken}


def ui_options(lang):
    """Data for the pop-up: ALL choices for the current question; 'spoken' marks the ones being read aloud now."""
    if current is None or current["stage"] not in ("brand", "type", "variant", "quantity"):
        return None
    lang = "english"          # on-screen text is always English; Urdu is voice-only
    st, fam, ptype = current["stage"], current["family"], current["ptype"]
    label = type_label(fam, ptype, lang) if ptype else fam_label(fam, lang)
    out = {"stage": st, "modal": True, "title": label, "items": [], "total": 0, "paged": False,
           "next_value": None, "product": None, "up_next": [pair_label(pr) for pr in queue]}
    if st == "brand":
        brands = current["brands"]
        paged = len(brands) > BRAND_READ_ALL
        start = current["brand_page"] * BRAND_PAGE if paged else 0
        spoken = set(brands[start:start + BRAND_PAGE]) if paged else set(brands)
        out.update(items=[{"label": b, "value": b, "spoken": b in spoken} for b in brands],
                   total=len(brands), paged=paged, next_value="next" if paged else None)
    elif st == "type":
        out.update(title=current["brand"] or label, total=len(current["types"]),
                   items=[{"label": type_label(fam, l, lang), "value": l, "spoken": True} for l in current["types"]])
    elif st == "variant":
        shown = {v["id"] for v in current["shown"]}
        paged = len(current["variants"]) > READ_ALL_UP_TO
        out.update(title=f"{current['brand']} {label}", total=len(current["variants"]), paged=paged,
                   next_value="next" if paged else None,
                   items=[item_view(v, lang, v["id"] in shown) for v in current["variants"]])
    else:
        out.update(title=current["product"]["name"], product=item_view(current["product"], lang, True),
                   suggested_qty=current.get("suggested") or 1)
    return out


def cart_snapshot():
    items = [{"id": c["id"], "item_family": c["family"], "name": c["name"], "brand": c["brand"], "quantity": c["quantity"],
              "unit": c["size"], "price_per_unit": c["unit_price"], "line_total": c["unit_price"] * c["quantity"],
              "image_url": (PRODUCTS.get(c["id"]) or {}).get("image_url")} for c in current_cart]
    pending = []
    if current is not None:
        pending.append({"label": pair_label((current["family"], current["ptype"])), "status": current["stage"]})
    pending += [{"label": pair_label(pr), "status": "waiting"} for pr in queue]
    return {"items": items, "total": sum(i["line_total"] for i in items), "count": len(items),
            "pending": pending, "awaiting_confirmation": order_pending_confirmation, "checkout": checkout_ready,
            "need_login": bool(LOGIN_PROMPT.pop(CURRENT_SID, False))}


# ---- variant (pack size / product) ---------------------------------------------

def ask_variant(lang, variants, page=0):
    current["stage"] = "variant"
    current["variants"] = variants
    brand, n = current["brand"], len(variants)
    start = 0
    if n > READ_ALL_UP_TO:
        start = page * VARIANT_PAGE
        if start >= n:
            page, start = 0, 0
        chunk = variants[start:start + VARIANT_PAGE]
    else:
        page, chunk = 0, variants
    current["page"], current["shown"] = page, chunk
    lines = t(lang, "; ", "؛ ").join(f"{start + i + 1}: {short_name(p)} — {money(p['price'], lang)}" for i, p in enumerate(chunk))
    if n <= READ_ALL_UP_TO:
        d = t(lang, f"{brand} options: {lines}. Which one would you like?", f"{brand} کی اقسام: {lines}۔ کونسی چاہیے؟")
        return d, d
    more = start + VARIANT_PAGE < n
    head = t(lang, f"{brand}, {n} options, here are {start + 1} to {start + len(chunk)}: ",
             f"{brand} کی {n} اقسام، یہ {start + 1} سے {start + len(chunk)} ہیں: ")
    if more:
        tail = t(lang, ". Say next for more, or tell me a size or a word from the name.",
                 "۔ مزید کے لیے اگلا کہیں، یا سائز یا نام کا کوئی لفظ بتائیں۔")
    else:
        tail = t(lang, ". That's the last. Say next to hear from the start, or tell me what you want.",
                 "۔ بس یہی تھیں۔ شروع سے سننے کے لیے اگلا کہیں، یا بتائیں کیا چاہیے۔")
    text = head + lines + tail
    return text, text


UNIT_CANON = {"kg": "kg", "kilo": "kg", "kilogram": "kg", "kgs": "kg", "کلو": "kg", "کیلو": "kg", "کلوگرام": "kg", "کیلوگرام": "kg",
              "g": "g", "gm": "g", "gram": "g", "grams": "g", "گرام": "g",
              "l": "l", "ltr": "l", "litre": "l", "liter": "l", "lit": "l", "لیٹر": "l",
              "ml": "ml", "pieces": "pc", "piece": "pc", "pcs": "pc", "pack": "pc"}

STOP = {"the", "one", "want", "need", "please", "with", "and", "give", "for", "wala", "wali", "dena", "chahiye",
        "karo", "hai", "next", "more", "aur", "bhi", "any", "koi", "yes", "okay"}


_ONES = {"one": 1, "ek": 1, "aik": 1, "ایک": 1, "ون": 1, "two": 2, "do": 2, "دو": 2, "ٹو": 2, "three": 3, "teen": 3, "تین": 3,
         "تھری": 3, "four": 4, "char": 4, "chaar": 4, "چار": 4, "فور": 4, "five": 5, "panch": 5, "paanch": 5, "پانچ": 5,
         "فائیو": 5, "six": 6, "cheh": 6, "چھ": 6, "سکس": 6, "seven": 7, "saat": 7, "سات": 7, "سیون": 7, "eight": 8,
         "aath": 8, "آٹھ": 8, "ایٹ": 8, "nine": 9, "nau": 9, "نو": 9, "نائن": 9}
_TENS = {"ten": 10, "das": 10, "دس": 10, "twenty": 20, "bees": 20, "بیس": 20, "ٹوئنٹی": 20, "thirty": 30, "tees": 30,
         "تیس": 30, "تھرٹی": 30, "forty": 40, "chalis": 40, "چالیس": 40, "فورٹی": 40, "fifty": 50, "pachas": 50,
         "پچاس": 50, "ففٹی": 50, "sixty": 60, "saath": 60, "ساٹھ": 60, "سکسٹی": 60, "seventy": 70, "sattar": 70,
         "ستر": 70, "سیونٹی": 70, "eighty": 80, "assi": 80, "اسی": 80, "ایٹی": 80, "ninety": 90, "nabbe": 90, "نوے": 90,
         "نائنٹی": 90}
_SAU = {"sau", "سو", "hundred", "ہنڈرڈ"}


def spoken_to_digits(text):
    """'one sixty gram' -> '160 gram', 'پانچ سو گرام' -> '500 گرام', 'ek kilo' -> '1 kilo' (used on what the user SAID)."""
    clean = lambda w: w.lower().strip(".,،؟?!")
    FRAC = {"آدھا": "0.5", "آدھی": "0.5", "ادھا": "0.5", "aadha": "0.5", "adha": "0.5", "aadhi": "0.5", "half": "0.5",
            "ڈیڑھ": "1.5", "derh": "1.5", "dedh": "1.5", "ڈھائی": "2.5", "dhai": "2.5", "dhaai": "2.5", "سوا": "1.25", "sawa": "1.25"}
    toks, out, i = [FRAC.get(clean(w), w) for w in text.split()], [], 0
    isnum = lambda w: clean(w) in _ONES or clean(w) in _TENS or clean(w) in _SAU
    while i < len(toks):
        if not isnum(toks[i]):
            out.append(toks[i]); i += 1
            continue
        j = i
        while j < len(toks) and isnum(toks[j]):
            j += 1
        run = [clean(w) for w in toks[i:j]]
        total, k = 0, 0
        if run[0] in _ONES and len(run) > 1 and run[1] in _SAU:
            total, k = _ONES[run[0]] * 100, 2
        elif run[0] in _SAU:
            total, k = 100, 1
        elif run[0] in _ONES and len(run) > 1 and run[1] in _TENS:        # "one sixty" = 160
            total, k = _ONES[run[0]] * 100, 1
        total += sum(_ONES.get(w) or _TENS.get(w) or 0 for w in run[k:])
        out.append(str(total))
        i = j
    return " ".join(out)


def size_pairs(text, spoken=False):
    if spoken:
        text = spoken_to_digits(text.translate(ARABIC_DIGITS))
    text = text.translate(ARABIC_DIGITS).lower()
    return {(float(n), UNIT_CANON[u]) for n, u in re.findall(r"(\d+(?:\.\d+)?)\s*([a-z\u0600-\u06ff]+)", text) if u in UNIT_CANON}


def keyword_hits(text, variants, brand):
    """'herbal', 'charcoal', 'kids' ... -> products whose names contain those words."""
    toks = [w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in STOP and w not in brand.lower().split()]
    if not toks:
        return []
    scored = []
    for v in variants:
        name_toks = set(re.findall(r"[a-z]+", v["name"].lower()))
        sc = sum(1 for w in toks if any(n.startswith(w) or (len(n) >= 4 and w.startswith(n)) for n in name_toks))
        scored.append((sc, v))
    best = max(sc for sc, _ in scored)
    return [v for sc, v in scored if sc == best] if best > 0 else []


def _variant_hits(text, variants, shown, brand):
    want = size_pairs(text, spoken=True)
    if want:
        hits = [v for v in variants if same_size(want, size_pairs(v["name"] + " " + v["size"]))]
        if hits:
            return hits
    base = variants.index(shown[0]) if shown and shown[0] in variants else 0     # the options are read out with their number
    for words_, idx in ORDINALS:
        if has_any(text, words_) and idx < len(shown):
            return [shown[idx]]
    t2 = numwords_to_digits(spoken_to_digits(text.translate(ARABIC_DIGITS))).lower()
    m_no = re.search(r"(?:number|no|option|num|nambar|آپشن|نمبر|نمبَر)\.?\s*(\d{1,2})\b", t2)
    if m_no and 0 <= int(m_no.group(1)) - 1 - base < len(shown):                 # "number 2" / "نمبر دو"
        return [shown[int(m_no.group(1)) - 1 - base]]
    n = parse_quantity_rules(text)      # bare "5" / "two" -> the pack whose size is 5 / 2
    if n:
        hits = [v for v in variants if n in {p[0] for p in size_pairs(v["name"] + " " + v["size"])}]
        if hits:
            return hits
        if float(n).is_integer() and len(tokens(text)) <= 2 and 0 <= int(n) - 1 - base < len(shown):   # just "2": option number 2
            return [shown[int(n) - 1 - base]]
    if has_any(text, CHEAP):
        return [min(variants, key=lambda v: v["price"])]
    if has_any(text, EXPENSIVE):
        return [max(variants, key=lambda v: v["price"])]
    low = text.lower()
    hits = [v for v in variants if v["name"].lower() in low or short_name(v).lower() in low]
    if hits:
        return hits
    return keyword_hits(text, variants, brand)


def match_variant_rules(text, variants, shown, brand):
    hits = _variant_hits(text, variants, shown, brand)
    if len(hits) > 1 and len(hits) == len(variants):    # didn't narrow anything
        return []
    return hits


def brand_change(utt, lang):
    """"Don't you have Dawn bread?" while choosing a pack of another brand -> switch to that brand."""
    b = match_brand_rules(utt.both, current["brands"], strict=True, words_only=True)
    if b and b != current.get("brand"):
        d, s_ = after_brand(lang, b)
        pre = t(lang, f"{b}. ", f"{b}۔ ")
        return pre + d, pre + s_
    return None


_COMPARATIVE = re.compile(r"cheap|expensive|big|small|large|bigger|smaller|first|second|third|last|cheapest|biggest|sasta|saste|mehnga|bara|chota|pehla|doosra|dusra|سستا|سستی|مہنگا|بڑا|بڑی|چھوٹا|چھوٹی|پہلا|دوسرا|تیسرا|آخری|سب سے|\d")


def _words_point_to(p, options, text):
    """A short answer like just "lobia" fits several options: an LLM must not guess one of them. True when the words
    contain something that only THIS option has (its colour / flavour / size ...), or the answer is a comparison."""
    if len(options) < 2 or p not in options or _COMPARATIVE.search(text.lower()) or len(tokens(text)) > 6:
        return True
    heard = set(tokens(text))
    mine = {w for w in tokens(_product_blob(p)) if len(w) >= 3}
    others = set()
    for o in options:
        if o is not p:
            others |= {w for w in tokens(_product_blob(o)) if len(w) >= 3}
    return bool((mine - others) & heard)


QR_RUPEE = re.compile(r"\brs\.?(?![a-z])|\brupee|\brupay|\brupiy|\bpkr\b|روپ|ریال", re.I)


def match_by_price(text, options):
    """"fifty rupees pack" / "50 rupay wala" / "پچاس روپے والا" = the option that costs 50 (or is named 'Rs 50 Pack').
    Only used when the customer says a money word, so a plain '50' is never taken for a price."""
    money_word = bool(QR_RUPEE.search(text.lower()))
    am = parse_amount(text)
    if am is None or am.has_unit or am.value <= 0:
        return []
    n = am.value
    named = [v for v in options if re.search(rf"\brs\.?\s*{int(n)}(?!\d)", v["name"], re.I)]
    if money_word:
        return [v for v in options if abs(float(v["price"]) - n) < 0.5 or v in named]
    # no money word ("the seventy pack", or STT wrote "seventy two piece pack"): only for options named by their price ("Rs 70 Pack")
    if n >= 5 and any(re.search(r"\brs\.?\s*\d+", v["name"], re.I) for v in options):
        return named
    return []


async def handle_variant(utt, lang):
    bc = brand_change(utt, lang)
    if bc:
        return bc
    variants, shown = current["variants"], current["shown"] or current["variants"]
    full = current.get("all_variants") or variants
    ph = match_by_price(utt.both, variants) or match_by_price(utt.both, full)      # "I want the fifty rupees pack"
    if ph and len(ph) < len(full):
        return select_product(lang, ph[0]) if len(ph) == 1 else ask_variant(lang, ph)
    grp = item_groups(utt.both, full)                  # "I want both the potato and the tomato" -> take them one after another
    if len(grp) >= 2:
        first = narrow_products(full, grp[0]["text"])
        queue_more_items((current["family"], current["ptype"]), grp[1:])
        if len(first) == 1:
            return select_product(lang, first[0])
        return ask_variant(lang, first)
    hits = match_variant_rules(utt.both, variants, shown, current["brand"])
    want = size_pairs(utt.both, spoken=True)
    if full is not variants and (len(hits) != 1 or (want and not any(same_size(want, size_pairs(h["name"] + " " + h["size"])) for h in hits))):
        h2 = match_variant_rules(utt.both, full, full, current["brand"])      # "no, the 1 kg mince" -> search ALL packs
        if h2 and len(h2) < len(full):
            hits = h2
    word_hits = narrow_products(full, utt.both)               # size AND name words together ("karahi cut 1kg")
    if len(word_hits) < len(full):
        both = [h for h in hits if h in word_hits]
        hits = both or (hits if hits else word_hits)
    if len(hits) == 1:
        return select_product(lang, hits[0])
    if len(hits) > 1:
        return ask_variant(lang, hits)
    if wants_more(utt.both):
        return ask_variant(lang, variants, current["page"] + 1)
    near = narrow_products(full, utt.both)             # compares with names + the aliases column (Urdu too)
    if len(near) == 1:
        return select_product(lang, near[0])
    if 1 < len(near) < len(full):
        return ask_variant(lang, near)
    n_said = parse_quantity_rules(utt.both)
    if n_said and 0 < n_said <= 100 and not size_pairs(utt.both, spoken=True):
        slot = dict(current.get("slot") or {})            # "I only want one" while choosing a pack = HOW MANY, remember it
        slot["qty"] = utt.both
        current["slot"] = slot
        d, s_ = ask_variant(lang, variants, current["page"])
        pre = t(lang, f"Okay, {fmt_qty(n_said)}. ", f"ٹھیک ہے، {fmt_qty(n_said)}۔ ")
        return pre + d, pre + s_
    cf = await contextual_fallback(utt, lang)
    if cf:
        return cf
    i = await llm_pick(utt.both, [short_name(v) for v in variants[:30]], "a product")
    if i is not None and _words_point_to(variants[i], variants, utt.both):
        return select_product(lang, variants[i])
    d, s_ = ask_variant(lang, variants, current["page"])
    pre = t(lang, "Sorry, I didn't catch which one. ", "معذرت، سمجھ نہیں آیا۔ ")
    return pre + d, pre + s_


def select_product(lang, p):
    """A product was chosen: ALWAYS ask how many. If the customer already said an amount ("2 kg chawal") the question
    proposes the converted number of packs (2 kg of a 5 kg bag = 1 pack) and "yes" / "next" / "ji" keeps it."""
    current["product"] = p
    current["stage"] = "quantity"
    said = (current.get("slot") or {}).get("qty")
    asked = parse_amount(said) if said else None
    d, s_, suggested = quantity_prompt(lang, p, money, asked)
    current["suggested"] = suggested
    return d, s_


# ====================================================================================================
# UNIT-AWARE QUANTITIES  ("2 kg chawal" of a 5 kg bag = 1 pack, not 2 bags)
#   parse_amount / packs_for / quantity_prompt / interpret_reply / key_info   (names prefixed QR_/_qr_ never clash)
# ====================================================================================================
QR_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

QR_NUM_WORDS = {
    "one": 1, "ek": 1, "aik": 1, "ایک": 1, "two": 2, "do": 2, "دو": 2, "three": 3, "teen": 3, "تین": 3,
    "four": 4, "char": 4, "chaar": 4, "چار": 4, "five": 5, "panch": 5, "paanch": 5, "پانچ": 5,
    "six": 6, "chay": 6, "cheh": 6, "chhe": 6, "چھ": 6, "seven": 7, "saat": 7, "سات": 7,
    "eight": 8, "aath": 8, "آٹھ": 8, "nine": 9, "nau": 9, "نو": 9, "ten": 10, "das": 10, "دس": 10,
    "half": 0.5, "aadha": 0.5, "adha": 0.5, "aadhi": 0.5, "adhi": 0.5, "آدھا": 0.5, "آدھی": 0.5,
    "dedh": 1.5, "derh": 1.5, "ڈیڑھ": 1.5, "dhai": 2.5, "dhaai": 2.5, "ڈھائی": 2.5,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "saath": 60, "sattar": 70, "assi": 80, "nabbay": 90, "ninety": 90,
    "بیس": 20, "تیس": 30, "چالیس": 40, "ساٹھ": 60, "ستر": 70, "اسی": 80, "نوے": 90,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "pachas": 50, "pachaas": 50, "پچاس": 50, "bees": 20, "bis": 20, "tees": 30, "chalis": 40,
    "sawa": 1.25, "سوا": 1.25, "paune": 0.75, "pauna": 0.75, "پونے": 0.75,
}

# unit word -> (canonical unit, dimension, multiplier to the base of that dimension)
#   mass base = gram, volume base = ml, count base = 1 piece
QR_UNITS = {
    "kg": ("kg", "mass", 1000), "kgs": ("kg", "mass", 1000), "kilo": ("kg", "mass", 1000), "kilos": ("kg", "mass", 1000),
    "kilogram": ("kg", "mass", 1000), "kilograms": ("kg", "mass", 1000), "کلو": ("kg", "mass", 1000),
    "کلوگرام": ("kg", "mass", 1000), "کلو گرام": ("kg", "mass", 1000),
    "g": ("g", "mass", 1), "gm": ("g", "mass", 1), "gms": ("g", "mass", 1), "gram": ("g", "mass", 1),
    "grams": ("g", "mass", 1), "gramme": ("g", "mass", 1), "گرام": ("g", "mass", 1),
    "l": ("l", "vol", 1000), "lt": ("l", "vol", 1000), "ltr": ("l", "vol", 1000), "litre": ("l", "vol", 1000),
    "litres": ("l", "vol", 1000), "liter": ("l", "vol", 1000), "liters": ("l", "vol", 1000), "لیٹر": ("l", "vol", 1000),
    "ml": ("ml", "vol", 1), "mls": ("ml", "vol", 1),
    "dozen": ("dozen", "count", 12), "darjan": ("dozen", "count", 12), "درجن": ("dozen", "count", 12),
    "pc": ("pc", "count", 1), "pcs": ("pc", "count", 1), "piece": ("pc", "count", 1), "pieces": ("pc", "count", 1),
    "عدد": ("pc", "count", 1),
}
# these words mean "packs" (a plain count of what the shop sells)
QR_PACK_WORDS = {"pack", "packs", "packet", "packets", "bag", "bags", "box", "boxes", "bottle", "bottles", "tin", "tins",
              "can", "cans", "carton", "cartons", "پیک", "پیکٹ", "ڈبہ", "ڈبے", "بوتل"}

# answers that mean "keep what you proposed, go on"
QR_KEEP = {"yes", "yeah", "yep", "ok", "okay", "sure", "fine", "same", "next", "continue", "proceed", "done", "right",
        "correct", "haan", "han", "ji", "jee", "theek", "thik", "sahi", "bilkul", "wohi", "wahi", "bas", "aage", "agla",
        "agli", "chalo", "ہاں", "جی", "ٹھیک", "صحیح", "بالکل", "وہی", "بس", "آگے", "اگلا", "اگلی", "اوکے", "چلو"}
QR_KEEP_PHRASES = ("ek hi", "aik hi", "ایک ہی", "one only", "just one", "only one", "same one", "that's it", "thats it",
                "that is fine", "keep it", "keep one", "keep 1")


@dataclass
class QRAmount:
    value: float
    unit: Optional[str] = None      # 'kg' | 'g' | 'l' | 'ml' | 'dozen' | 'pc' | None (plain number)
    dim: Optional[str] = None       # 'mass' | 'vol' | 'count' | None
    base: Optional[float] = None    # value in grams / ml / pieces

    @property
    def has_unit(self) -> bool:
        return self.unit is not None


def _qr_fmt(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else (f"{n:.2f}".rstrip("0").rstrip("."))


QR_MULT = {"hundred": 100, "sau": 100, "سو": 100, "thousand": 1000, "hazar": 1000, "hazaar": 1000, "ہزار": 1000}


def _qr_words(text: str) -> list[str]:
    text = text.translate(QR_DIGITS).lower()
    text = re.sub(r"کے\s*جی|کی\s*جی|کے\.جی", " kg ", text)            # "پانچ کے جی" = 5 kg
    text = re.sub(r"\bk\.?g\.?\b", " kg ", text)
    text = re.sub(r"(\d)([a-z؀-ۿ])", r"\1 \2", text)      # 2kg -> 2 kg
    text = re.sub(r"([a-z؀-ۿ])(\d)", r"\1 \2", text)
    return re.findall(r"\d+(?:\.\d+)?|[a-z؀-ۿ']+", text)


def _qr_number(tok: str) -> Optional[float]:
    if re.fullmatch(r"\d+(?:\.\d+)?", tok):
        return float(tok)
    return float(QR_NUM_WORDS[tok]) if tok in QR_NUM_WORDS else None


def parse_amount(text: str) -> Optional[QRAmount]:
    """First amount in the sentence.  '2 kg' / 'do kilo' / 'dedh kilo' / 'aadha kilo' / '500 gram' / '3' / 'teen packet'.
    A bare unit ('kilo chawal') counts as 1 of that unit."""
    toks = _qr_words(text)
    for i, tok in enumerate(toks):
        n = _qr_number(tok)
        if n is None:
            continue
        # "five hundred" / "paanch sau" / "two hundred fifty" / "ek hazar"
        j = i + 1
        if j < len(toks) and toks[j] in QR_MULT:
            n *= QR_MULT[toks[j]]
            j += 1
            if j < len(toks):
                extra = _qr_number(toks[j])
                if extra is not None and 0 < extra < 100 and extra == int(extra):
                    n += extra
                    j += 1
        nxt = toks[j] if j < len(toks) else ""
        if nxt in QR_UNITS:
            u, dim, mult = QR_UNITS[nxt]
            return QRAmount(n, u, dim, n * mult)
        return QRAmount(n)                                       # plain number = number of packs
    for tok in toks:                                           # "kilo chawal", "litre doodh" = one of that unit
        if tok in ("kilo", "kg", "کلو", "litre", "liter", "لیٹر"):
            u, dim, mult = QR_UNITS[tok]
            return QRAmount(1.0, u, dim, float(mult))
    return None


def qr_pack_size(product: dict) -> Optional[tuple[str, float]]:
    """(dimension, size of ONE pack in grams / ml / pieces) from the product's size or name.
    Handles '5 kg', '500g', '1 L', '12 pcs', '1 dozen' and multipacks like '6 x 250 ml'."""
    for field in (product.get("size") or "", product.get("name") or ""):
        txt = field.translate(QR_DIGITS).lower()
        m = re.search(r"(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-z]+)", txt)
        if m and m.group(3) in QR_UNITS:                                      # 6 x 250 ml
            _, dim, mult = QR_UNITS[m.group(3)]
            return dim, int(m.group(1)) * float(m.group(2)) * mult
        for n, u in re.findall(r"(\d+(?:\.\d+)?)\s*([a-z؀-ۿ]+)", txt):
            if u in QR_UNITS:
                _, dim, mult = QR_UNITS[u]
                return dim, float(n) * mult
    return None


def packs_for(amount: QRAmount, product: dict) -> Optional[dict]:
    """How many packs of `product` the spoken amount means.
         2 kg  of a 5 kg bag  -> 1 pack, rounded up      10 kg -> 2 packs      500 g of a 1 kg pack -> 1 pack, rounded up
         '3' (no unit)        -> 3 packs                  1.5 kg of a 1 kg pack -> 2 packs, rounded up
    Returns None when the unit cannot be compared with the pack (e.g. '2 kg' of eggs)."""
    if not amount.has_unit:
        n = max(1.0, amount.value)
        return {"packs": n, "rounded": False, "pack_text": None}
    ps = qr_pack_size(product)
    if not ps or ps[0] != amount.dim or ps[1] <= 0:
        return None
    ratio = amount.base / ps[1]
    packs = float(max(1, math.ceil(ratio - 1e-9)))
    return {"packs": packs, "rounded": abs(ratio - packs) > 1e-6, "pack_text": product.get("size") or ""}


def _qr_amount_text(a: QRAmount) -> str:
    names = {"kg": "kg", "g": "g", "l": "L", "ml": "ml", "dozen": "dozen", "pc": "pcs"}
    return f"{_qr_fmt(a.value)} {names.get(a.unit, a.unit)}" if a.has_unit else _qr_fmt(a.value)


def quantity_prompt(lang: str, product: dict, money: Callable[[float, str], str],
                    asked: Optional[QRAmount] = None) -> tuple[str, str, Optional[float]]:
    """The question asked every time a product has been chosen.  Returns (display, speech, suggested_packs).
    `asked` = what the customer already said for this item ('2 kg'), if anything."""
    name, price = product["name"], money(product["price"], lang)
    en = lang != "urdu"
    sug = packs_for(asked, product) if asked else None

    if asked and asked.has_unit and sug:
        packs = sug["packs"]
        pk = product.get("size") or "one pack"
        if en:
            if sug["rounded"]:
                t = (f"You asked for {_qr_amount_text(asked)}. {name} comes in {pk} packs at {price} each, "
                     f"so that is {_qr_fmt(packs)} pack{'s' if packs != 1 else ''}. Say yes to keep {_qr_fmt(packs)}, or tell me how many.")
            else:
                t = (f"{_qr_amount_text(asked)} of {name} is {_qr_fmt(packs)} pack{'s' if packs != 1 else ''} of {pk} at {price} each. "
                     f"Say yes to keep it, or tell me how many.")
        else:
            t = (f"آپ نے {_qr_amount_text(asked)} کہا۔ {name} {pk} کے پیک میں ملتا ہے، قیمت {price} فی پیک، "
                 f"یعنی {_qr_fmt(packs)} پیک۔ ٹھیک ہے تو ہاں کہیں، یا بتائیں کتنے چاہیے۔")
        return t, t, packs

    if asked and not asked.has_unit:                       # "3" -> propose 3 packs
        packs = max(1.0, asked.value)
        t = (f"{name} is {price} each. You said {_qr_fmt(packs)}. Say yes to keep {_qr_fmt(packs)}, or tell me how many."
             if en else f"{name} کی قیمت {price} ہے۔ آپ نے {_qr_fmt(packs)} کہا۔ ٹھیک ہے تو ہاں کہیں، یا بتائیں کتنے چاہیے۔")
        return t, t, packs

    # nothing said yet (or a unit that does not fit this pack, e.g. "2 kg" of eggs): ask, and offer "1 / next"
    t = (f"{name} is {price} each. How many would you like? Say 1 or next to keep one and move on."
         if en else f"{name} کی قیمت {price} ہے۔ کتنے چاہیے؟ ایک رکھنا ہو تو ایک یا اگلا کہیں۔")
    return t, t, 1.0


def interpret_reply(text: str, product: dict, suggested: Optional[float] = 1.0) -> dict:
    """What the customer answered to the quantity question.
        {'kind': 'keep',     'packs': suggested}              yes / next / ji / wohi / ek hi / bas
        {'kind': 'quantity', 'packs': n, 'rounded': bool}     '3', 'teen', '2 kg' (converted to packs)
        {'kind': 'unclear'}                                   nothing usable: ask again"""
    low = text.translate(QR_DIGITS).lower()
    amt = parse_amount(low)
    if amt is not None:
        conv = packs_for(amt, product)
        if conv is None:                                   # unit does not fit this product: treat the number as packs
            conv = {"packs": max(1.0, amt.value), "rounded": False}
        if conv["packs"] > 100:
            return {"kind": "unclear"}
        return {"kind": "quantity", "packs": conv["packs"], "rounded": conv["rounded"]}
    toks = set(_qr_words(low))
    if toks & QR_KEEP or any(p in low for p in QR_KEEP_PHRASES):
        return {"kind": "keep", "packs": suggested if suggested else 1.0}
    return {"kind": "unclear"}


# ---------------------------------------------------------------------------------------------------------------
# Key-information extraction: shrink a long, noisy sentence to what the agent needs
# ---------------------------------------------------------------------------------------------------------------
QR_FILLERS = {
    "um", "uh", "umm", "hmm", "ok", "okay", "so", "well", "please", "pls", "kindly", "like", "actually", "basically",
    "mujhe", "mujhay", "mjhe", "mera", "meri", "hamein", "humein", "chahiye", "chahie", "chahiyen", "chaiye", "dena", "dedo",
    "de", "do", "dijiye", "dijiy", "karo", "kar", "karna", "hai", "hain", "hy", "ho", "toh", "to", "bhi", "ji", "aap", "ap",
    "can", "could", "you", "i", "want", "need", "would", "give", "me", "some", "get", "the", "a", "an", "and", "also", "and",
    "اور", "مجھے", "چاہیے", "چاہئے", "دیں", "دیجیے", "کر", "دو", "ہے", "ہیں", "بھی", "تو", "پلیز", "جی",
}
QR_KEEP_ALWAYS = QR_KEEP | {"no", "nahi", "nahin", "cancel", "confirm", "next", "more", "skip", "remove", "hata", "نہیں", "منسوخ", "کنفرم"}


def key_info(text: str, max_words: int = 18) -> dict:
    """Pulls out the important part of what the customer said, so the agent works on a short clean phrase:
        'um mujhe do kilo chawal chahiye please aur ek dozen anday'
          -> {'clean': 'kilo chawal dozen anday', 'amount': QRAmount(2, 'kg'), 'amounts': [...], 'is_keep': False}
    * amounts keep their numbers and units (they are the heart of the sentence)
    * fillers / politeness words are dropped; the first `max_words` words that matter are kept
    * yes / no / next / cancel style answers are never dropped."""
    toks = _qr_words(text)
    keep: list[str] = []
    amounts: list[QRAmount] = []
    i = 0
    while i < len(toks):
        tok = toks[i]
        n = _qr_number(tok)
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if n is not None and nxt in QR_UNITS:                      # "2 kg" stays together
            u, dim, mult = QR_UNITS[nxt]
            amounts.append(QRAmount(n, u, dim, n * mult))
            keep.append(f"{_qr_fmt(n)} {nxt}")
            i += 2
            continue
        if n is not None and re.fullmatch(r"\d+(?:\.\d+)?", tok):
            amounts.append(QRAmount(n))
            keep.append(tok)
        elif n is not None and tok not in QR_FILLERS:              # number words (teen, paanch ...)
            amounts.append(QRAmount(n))
            keep.append(tok)
        elif tok in QR_KEEP_ALWAYS or tok not in QR_FILLERS:
            keep.append(tok)
        i += 1
    seen_adj = [w for k, w in enumerate(keep) if k == 0 or w != keep[k - 1]]   # drop stutters ("chawal chawal")
    clean = " ".join(seen_adj[:max_words])
    toks_set = set(toks)
    return {"clean": clean, "amount": amounts[0] if amounts else None, "amounts": amounts,
            "is_keep": bool(toks_set & QR_KEEP) or any(p in text.lower() for p in QR_KEEP_PHRASES)}


# ---- quantity -------------------------------------------------------------

BASE_UNITS = {"kg": ("mass", 1000), "g": ("mass", 1), "l": ("vol", 1000), "ml": ("vol", 1)}


HUNDRED_WORDS = {"hundred", "sau", "so", "سو", "سَو"}


def numwords_to_digits(text):
    out = []
    for w in text.split():
        v = NUM_WORDS.get(w.lower())
        out.append((str(int(v)) if float(v).is_integer() else str(v)) if v is not None else w)
    # "5 hundred" / "پانچ سو" = 500, "2 سو 50" = 250   (a number followed by a "hundred" word)
    merged, i = [], 0
    while i < len(out):
        w = out[i]
        if i + 1 < len(out) and out[i + 1].lower() in HUNDRED_WORDS and re.fullmatch(r"\d+(\.\d+)?", w):
            n = float(w) * 100
            i += 2
            if i < len(out) and re.fullmatch(r"\d{1,2}", out[i]):     # "two hundred fifty"
                n += float(out[i])
                i += 1
            merged.append(str(int(n)))
            continue
        merged.append(w)
        i += 1
    return " ".join(merged)


def same_size(want, have):
    """True when a requested size equals a pack size, in any unit ("half kilo" == 500 g, "1000 ml" == 1 L)."""
    if want & have:
        return True
    for n, u in want:
        for m_, v in have:
            if u in BASE_UNITS and v in BASE_UNITS and BASE_UNITS[u][0] == BASE_UNITS[v][0] \
                    and abs(n * BASE_UNITS[u][1] - m_ * BASE_UNITS[v][1]) < 1e-6:
                return True
    return False


def base_amount(pairs):
    for n, u in sorted(pairs):
        if u in BASE_UNITS:
            dim, mult = BASE_UNITS[u]
            return dim, n * mult
    return None


def packs_from_text(text, product):
    """'3 kg' of a 1 kg pack -> 3 packs; '10 kg' of a 5 kg pack -> 2; '2 kg' of a 5 kg pack -> 1 (rounded up).
    Returns (packs, was_rounded) or (None, False) if the user didn't give an amount with a unit."""
    up = base_amount(size_pairs(text, spoken=True))
    pp = base_amount(size_pairs(product["name"] + " " + product["size"]))
    if not up or not pp or up[0] != pp[0] or pp[1] <= 0:
        return None, False
    ratio = up[1] / pp[1]
    qty = float(max(1, math.ceil(ratio - 1e-9)))
    return qty, abs(ratio - qty) > 1e-6


MAX_PER_ITEM = 10
LIMIT_EN = "You have reached the limit for this item."
LIMIT_UR = "اس آئٹم کی حد پوری ہو چکی ہے۔"


def item_cap(p):
    """Most the customer can buy of one item: 10, and never more than what is in stock."""
    stock = PRODUCTS.get(p["id"], {}).get("stock") if isinstance(p, dict) and "id" in p else None
    if stock is None:
        stock = p.get("stock") if isinstance(p, dict) else None
    return MAX_PER_ITEM if stock is None else max(0, min(MAX_PER_ITEM, int(stock)))


def add_selected_to_cart(lang, qty, rounded=False):
    """Puts current['product'] x qty into the cart, moves on to the next queued item."""
    global current
    p = current["product"]
    existing = next((c for c in current_cart if c["id"] == p["id"]), None)
    cap = item_cap(p)
    have = existing["quantity"] if existing else 0
    limited = False
    if have + qty > cap:
        limited = True
        qty = max(0, cap - have)
    if limited and qty <= 0:                       # nothing more of this one can be added
        msg = t(lang, LIMIT_EN, LIMIT_UR)
        current = None
        return compose(msg, start_next(lang), lang)
    if existing:
        existing["quantity"] += qty
    else:
        current_cart.append({"id": p["id"], "name": p["name"], "brand": p["brand"], "family": p["family"],
                             "quantity": qty, "unit_price": p["price"], "size": p["size"],
                             "said": " ".join(current.get("said", []))})
    unit, line = money(p["price"], lang), money(p["price"] * qty, lang)
    confirm = t(lang, f"Confirmed: {fmt_qty(qty)} × {p['name']} at {unit} each — {line}.",
                f"کنفرم: {fmt_qty(qty)} × {p['name']}، {unit} فی عدد — کل {line}۔")
    if limited:
        confirm += " " + t(lang, LIMIT_EN, LIMIT_UR)
    if rounded:
        confirm += t(lang, f" It comes in {p['size']} packs, so I rounded up.", f" یہ {p['size']} کے پیک میں ملتا ہے، اس لیے اوپر round کیا۔")
    current = None
    return compose(confirm, start_next(lang), lang)


async def contextual_fallback(utt, lang):
    """When the word rules cannot place a sentence, give Gemini the WHOLE situation (what was asked, what the options
    are, what is in the cart) and let it choose one action. This covers mistakes nobody wrote a rule for."""
    if gemini_client is None or current is None:
        return None
    fam = current["family"]
    items = sorted(BY_FAMILY.get(fam, []), key=lambda p: (p["brand"], p["price"]))[:60]
    ids = {p["id"] for p in items}
    listing = "\n".join(f'{p["id"]}: {p["name"]} | brand {p["brand"]} | {p["size"]} | {int(p["price"])} rupees' for p in items)
    prompt = (
        "You are the brain of a voice grocery agent (customer speaks English / Urdu / Roman Urdu; the transcript may be "
        "misspelled or garbled by speech-to-text).\n"
        f"Current question stage: {current['stage']} for item family '{fam}'. Brand chosen so far: {current.get('brand')}. "
        f"Product chosen so far: {(current.get('product') or {}).get('name')}.\n"
        f"Brands available: {', '.join(current['brands'])}.\n"
        f"Products in this family:\n{listing}\n"
        f"The options just offered to the customer (he is choosing among THESE unless he clearly names something else): "
        f"{[p['id'] for p in (current.get('variants') or [])[:12]]}\n"
        f"Cart: {[(c['name'], c['quantity']) for c in current_cart]}\n"
        f'The customer just said: "{utt.both}"\n\n'
        "Choose exactly ONE action and reply with JSON only:\n"
        '{"action": "pick_product" | "pick_brand" | "cheapest_brand" | "any_brand" | "set_quantity" | "skip_item" | "finish" | "unclear", '
        '"product_id": number|null, "brand": string|null, "quantity": number|null}\n'
        "pick_product = he names/describes one specific product (even if he is changing his mind or asking whether a brand has it); "
        "pick_brand = he names a brand only; set_quantity = he gives how many; skip_item = he does not want this item; "
        "cheapest_brand = he wants whichever brand is cheapest (e.g. 'the brand with cheap prices'); "
        "any_brand = he has no preference; "
        "finish = he is done ordering; unclear = you cannot tell (never guess)."
    )
    try:
        out = await _agem(prompt, 120, None, True)
        act = json.loads(re.search(r"\{.*\}", out, re.S).group())
    except Exception as e:
        print(f"⚠️ contextual fallback failed: {e}")
        return None
    print(f"🧭 contextual: {act}")
    a = act.get("action")
    if a == "pick_product" and act.get("product_id") in ids:
        p = PRODUCTS[act["product_id"]]
        offered = current.get("variants") or []
        if offered and p not in offered and not _words_point_to(p, current.get("all_variants") or offered, utt.both):
            print("🛑 that product was not among the offered options and the words do not name it — asking again")
            return None
        if not _words_point_to(p, offered, utt.both):
            print("🛑 the words do not tell the options apart — asking again instead of guessing")
            return None
        current["brand"] = p["brand"]
        same = sorted([x for x in current["pool"] if x["brand"] == p["brand"]] or [p], key=lambda x: x["price"])
        current["variants"] = current["all_variants"] = same
        return select_product(lang, p)
    if a == "pick_brand" and act.get("brand") in current["brands"]:
        d, s_ = after_brand(lang, act["brand"])
        pre = t(lang, f"{act['brand']}. ", f"{act['brand']}۔ ")
        return pre + d, pre + s_
    if a in ("cheapest_brand", "any_brand") and current["stage"] == "brand":
        pool = current["pool"]
        if a == "cheapest_brand":
            b = min(current["brands"], key=lambda x: min(p["price"] for p in pool if p["brand"] == x))
        else:
            b = next((x for x in current["brands"] if x != "Generic"), current["brands"][0])
        d, s_ = after_brand(lang, b)
        pre = t(lang, f"{b}. ", f"{b}۔ ")
        return pre + d, pre + s_
    if a == "set_quantity" and current.get("product"):
        q = act.get("quantity")
        if isinstance(q, (int, float)) and 0 < q <= 100:
            return add_selected_to_cart(lang, float(q))
    if a == "skip_item":
        return skip_current(lang)
    if a == "finish":
        return finish_now(lang)
    return None


NOT_THIS = ("نہیں", "نہی", "غلط", "نہیں چاہیے", "nahi", "nahin", "nai ", "not this", "wrong", "no ", "other", "دوسرا", "اور والا", "change", "تبدیل")


def switch_product(utt, lang):
    """While asked 'how many?', the customer says another product ("no, I want chicken mince") -> go back and pick it."""
    bc = brand_change(utt, lang)
    if bc:
        return bc
    variants = current.get("all_variants") or current.get("variants") or []
    if len(variants) < 2:
        return None
    near = narrow_products(variants, utt.both)
    said_no = any(w in utt.both.lower() + " " for w in NOT_THIS)
    chosen = [v for v in near if v is not current["product"]] if len(near) < len(variants) else []
    if len(chosen) == 1 and near != variants:
        return select_product(lang, chosen[0])
    if len(chosen) > 1:
        current["stage"] = "variant"
        return ask_variant(lang, chosen)
    if said_no and parse_quantity_rules(utt.both) is None and not size_pairs(utt.both, spoken=True):   # "I don't want this one"
        current["stage"] = "variant"
        return ask_variant(lang, [v for v in variants if v is not current["product"]] or variants)
    return None


QR_REFUSE = ("نہیں چاہیے", "نہیں چاہئے", "نہی چاہیے", "نہیں چاہیۓ", "nahi chahiye", "nahin chahiye", "nai chahiye", "nahi chahie",
             "nahi chaiye", "nai chaiye", "don't want", "do not want", "dont want", "not interested", "no thanks", "no thank you",
             "skip", "چھوڑو", "چھوڑ دو", "چھوڑیں", "ہٹا دو", "hata do", "chor do", "chhor do", "cancel this", "remove this")
QR_BARE_NO = {"no", "nope", "nahi", "nahin", "nai", "نہیں", "نہی"}


def refuses_item(text: str) -> bool:
    low = " ".join(re.sub(r"[.,!?؟،۔]", " ", text.lower()).split())
    if parse_amount(low) is not None and any(ch.isdigit() for ch in low.translate(QR_DIGITS)):
        return False
    return low in QR_BARE_NO or any(ph in low for ph in QR_REFUSE)


async def handle_quantity(utt, lang):
    p = current["product"]
    sw = switch_product(utt, lang)                 # "no, I want the chicken mince 1kg" -> go back and pick that one
    if sw:
        return sw
    if refuses_item(utt.both):                     # "I don't want this one" -> drop it and go to the next item
        return skip_current(lang)
    want = size_pairs(utt.both, spoken=True)           # "I want the two hundred gram one" = a pack size, NOT quantity 2
    if want and not same_size(want, size_pairs(p["name"] + " " + p["size"])):
        full = current.get("all_variants") or current.get("variants") or []
        other = [v for v in full if v is not p and same_size(want, size_pairs(v["name"] + " " + v["size"]))]
        if len(other) == 1:
            return select_product(lang, other[0])
    r = interpret_reply(utt.both, p, current.get("suggested") or 1.0)
    if r["kind"] == "keep":                        # "yes" / "next" / "ji" / "wohi": keep the proposed number and go on
        return add_selected_to_cart(lang, r["packs"], False)
    qty, rounded = packs_from_text(utt.both, p)
    if qty is None and r["kind"] == "quantity":
        am = parse_amount(utt.both)
        if am is not None and am.has_unit:         # "do kilo" / "dedh kilo" is a weight, not 2 packs
            qty, rounded = r["packs"], r["rounded"]
    if qty is None and not want:
        qty = parse_quantity_rules(utt.both)
    if qty is None:
        cf = await contextual_fallback(utt, lang)
        if cf:
            return cf
        qty = await llm_quantity(utt.both)
    if qty is None or qty <= 0 or qty > 100:
        text = t(lang, f"Sorry, I didn't catch the quantity. How many {p['name']} would you like?",
                 f"معذرت، مقدار سمجھ نہیں آئی۔ {p['name']} کتنے چاہیے؟")
        return text, text
    return add_selected_to_cart(lang, qty, rounded)


def compose(prefix, step, lang):
    if step:
        return prefix + " " + step[0], prefix + " " + step[1]
    d, s = build_cart_summary(lang)
    return prefix + " " + d, prefix + " " + s


# ============================================================
# CART SUMMARY / CONFIRMATION / ORDER
# ============================================================

def cart_total():
    return sum(c["unit_price"] * c["quantity"] for c in current_cart)


def cart_lines_text(lang, cap=6):
    """'2 × Dettol Cool Soap 160g, 1 × Guard Rice 1kg' — what the customer chose, read back so they can check it."""
    parts = [f"{fmt_qty(c['quantity'])} × {c['name']}" for c in current_cart]
    s = t(lang, ", ", "، ").join(parts[:cap])
    if len(parts) > cap:
        s += t(lang, f" and {len(parts) - cap} more", f" اور {len(parts) - cap} مزید")
    return s


def build_cart_summary(lang):
    if not current_cart:
        m = t(lang, "Your cart is empty right now.", "آپ کی ٹوکری ابھی خالی ہے۔")
        return m, m
    lines = [f"{fmt_qty(c['quantity'])} × {c['name']} ({money(c['unit_price'] * c['quantity'], lang)})" for c in current_cart]
    total = money(cart_total(), lang)
    display = t(lang, "Your cart: " + ", ".join(lines) + f". Total {total}. Anything else, or should I confirm?",
                "آپ کی ٹوکری: " + "، ".join(lines) + f"۔ کل {total}۔ کچھ اور چاہیے، یا کنفرم کر دوں؟")
    speech = t(lang, f"You have {len(current_cart)} item{'' if len(current_cart) == 1 else 's'}, total {total}. Anything else, or confirm?",
               f"ٹوکری میں {len(current_cart)} چیزیں ہیں، کل {total}۔ کچھ اور چاہیے، یا کنفرم کر دوں؟")
    return display, speech


def load_profile(user_id):
    if not user_id:
        return None
    db = SessionLocal()
    try:
        c = db.get(Customer, user_id)
        if not c:
            return None
        return {"name": c.name or "", "phone": c.phone or "", "address": c.address or "", "city": c.city or "",
                "lat": c.lat, "lng": c.lng}
    except Exception as e:
        print(f"⚠️ profile not read: {e}")
        return None
    finally:
        db.close()


def save_profile(user_id, data):
    if not user_id:
        return
    db = SessionLocal()
    try:
        c = db.get(Customer, user_id) or Customer(user_id=user_id)
        for k, mx in (("name", 120), ("phone", 40), ("address", 300), ("city", 60)):
            v = str(data.get(k) or "").strip()[:mx]
            if v:
                setattr(c, k, v)
        for k in ("lat", "lng"):
            try:
                if data.get(k) is not None:
                    setattr(c, k, float(data[k]))
            except (TypeError, ValueError):
                pass
        c.updated_at = datetime.utcnow()
        db.add(c)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️ profile not saved: {e}")
    finally:
        db.close()


def request_confirmation(lang):
    global order_pending_confirmation, checkout_ready
    checkout_ready = False
    if not current_cart:
        m = t(lang, "Your cart is empty.", "ٹوکری خالی ہے۔")
        return m, m
    order_pending_confirmation = True
    prof = load_profile(CURRENT_USER)
    where = ""
    if prof and prof.get("address"):
        where = t(lang, f" It will be delivered to {prof['address']}, cash on delivery.",
                  f" یہ {prof['address']} پر پہنچے گا، کیش آن ڈیلیوری۔")
    m = t(lang, f"Your total is {money(cart_total(), lang)}.{where} Shall I confirm the order?",
          f"کل رقم {money(cart_total(), lang)} بنتی ہے۔{where} کیا آرڈر کنفرم کر دوں؟")
    return m, m


CHECKOUT_MODE = os.getenv("CHECKOUT_MODE", "backend").lower()   # "store": website checkout places the order | "backend": this server saves it


def confirm_and_place_order(lang):
    global current_cart, order_pending_confirmation, checkout_ready
    if CHECKOUT_MODE == "store":
        learn_from_cart()
        order_pending_confirmation = False
        checkout_ready = True
        m = t(lang, "Great! Opening checkout, please confirm your address and payment.",
              "بہت اچھا! چیک آؤٹ کھول رہا ہوں، براہِ کرم ایڈریس اور ادائیگی کنفرم کریں۔")
        return m, m
    if ORDER_REQUIRES_LOGIN and not CURRENT_USER:      # browsing and filling the basket is free; ordering needs an account
        order_pending_confirmation = False
        LOGIN_PROMPT[CURRENT_SID] = True
        m = t(lang, "Please sign in first to place your order. Your basket is saved — after signing in, just say confirm.",
              "آرڈر دینے کے لیے پہلے سائن اِن کریں۔ آپ کی ٹوکری محفوظ ہے، سائن اِن کے بعد بس کنفرم کہیں۔")
        return m, m
    learn_from_cart()                              # remember the customer's words for these products
    prof = load_profile(CURRENT_USER) or {}
    db = SessionLocal()
    confirmed, unavailable, total = [], [], 0.0
    for c in current_cart:
        p = PRODUCTS.get(c["id"])
        if p and p["stock"] is not None and p["stock"] < c["quantity"]:
            unavailable.append(c["name"])
            continue
        if p and p["stock"] is not None:
            p["stock"] -= c["quantity"]
            row = db.get(Product, p["id"])
            if row:
                row.stock_quantity = p["stock"]
        line_total = c["unit_price"] * c["quantity"]
        total += line_total
        confirmed.append({"name": c["name"], "brand": c["brand"], "quantity": c["quantity"],
                          "unit_price": c["unit_price"], "line_total": line_total})
    if confirmed:
        order = Order(items_json=json.dumps(confirmed), total_price=total, status="confirmed",
                      user_id=CURRENT_USER, session_id=CURRENT_SID, created_at=datetime.utcnow(),
                      source="voice", subtotal=total, delivery_fee=0.0, payment_method="Cash on Delivery",
                      customer_name=prof.get("name") or None, phone=prof.get("phone") or None,
                      address=prof.get("address") or None, city=prof.get("city") or None)
        db.add(order)
        try:
            db.flush()                              # gives the order its id
            oid = getattr(order, "id", None)
            if oid is not None:
                by_name = {c["name"]: c["id"] for c in current_cart}
                db.add_all([OrderItem(order_id=oid, product_id=by_name.get(c["name"]), name=c["name"], brand=c["brand"],
                                      quantity=c["quantity"], unit_price=c["unit_price"], line_total=c["line_total"])
                            for c in confirmed])
        except Exception as e:
            print(f"⚠️ order items not saved: {e}")
    db.commit()
    db.close()

    current_cart = []
    order_pending_confirmation = False

    if not confirmed:
        m = t(lang, "Sorry, nothing was available.", "معذرت، کوئی چیز دستیاب نہیں تھی۔")
        return m, m

    lines = [f"{fmt_qty(c['quantity'])} × {c['name']} — {money(c['line_total'], lang)}" for c in confirmed]
    display = t(lang, "Your order is confirmed: " + ", ".join(lines) + f". Total {money(total, lang)}.",
                "آپ کا آرڈر کنفرم ہو گیا: " + "، ".join(lines) + f"۔ کل {money(total, lang)}۔")
    if unavailable:
        display += t(lang, " Unavailable: " + ", ".join(unavailable) + ".", " دستیاب نہیں: " + "، ".join(unavailable) + "۔")
    speech = t(lang, f"Your order is confirmed. Total {money(total, lang)}. Thank you!",
               f"آپ کا آرڈر کنفرم ہو گیا۔ کل {money(total, lang)}۔ شکریہ!")
    if not prof.get("address"):
        extra = t(lang, " Please add your delivery address in the checkout or your profile so we can deliver.",
                  " براہِ کرم ڈیلیوری کے لیے اپنا ایڈریس پروفائل میں شامل کریں۔")
        display += extra
        speech += extra
    return display, speech


def cancel_everything(lang):
    global current, order_pending_confirmation, checkout_ready
    checkout_ready = False
    current_cart.clear(); queue.clear()
    current = None
    order_pending_confirmation = False
    m = t(lang, "Okay, order cancelled.", "ٹھیک ہے، آرڈر منسوخ کر دیا گیا۔")
    return m, m


def add_families(pairs):
    global checkout_ready
    checkout_ready = False
    for pair in pairs:
        fam, pt = pair
        if pair in queue or (current and current["family"] == fam and current["ptype"] == pt):
            continue
        queue.append(pair)


# ============================================================
# REMEMBERING EVERYTHING SAID IN ONE SENTENCE
#   "mujhe aik kilo chawal aur 2 kilo cheeni chahiye"  ->  rice (1 kg) + sugar (2 kg), both remembered.
#   Quantity / pack size / brand said now are used later, so the agent doesn't ask for them again.
# ============================================================

FILLER = {
    "mujhe", "mujh", "mujhko", "mera", "meri", "mere", "hamein", "humein", "chahiye", "chahye", "chahie", "chaiye",
    "chahiyen", "chahiya", "chahiay", "i", "need", "want", "please", "plz", "give", "me", "us", "get", "kindly", "de",
    "dena", "dedo", "kar", "karo", "kardo", "karna", "hai", "hain", "ko", "ka", "ki", "ke", "se", "ye", "yeh", "woh",
    "wo", "bhi", "just", "also", "the", "a", "an", "some", "of", "for", "to", "ok", "okay", "ji", "haan", "han",
    "acha", "achha", "theek", "thik", "bas", "piece", "pieces", "pack", "packet", "packets", "kilo", "kilos", "kg",
    "kgs", "gram", "grams", "gm", "litre", "liter", "ltr", "l", "ml", "would", "like", "can", "could", "you", "and",
    "aur", "with", "mujhay", "mjhe", "lena", "lene", "hoga", "chahta", "chahti", "chahtay",
    "مجھے", "مجھ", "چاہیے", "چاہئے", "چاہیئے", "دیں", "دیجیے", "دیجئے", "کریں", "کر", "دے", "دو", "بھی", "ہے", "ہیں",
    "کو", "کا", "کی", "کے", "سے", "جی", "ہاں", "اچھا", "ٹھیک", "کلو", "گرام", "لیٹر", "پیک", "اور",
}
SPLIT_RE = re.compile(r"\s*(?:[,،&;]|(?<!\w)(?:and|aur|also|plus|then|phir|اور|پھر)(?!\w))\s*", re.I)
STRIP_CHARS = " .،,?!؟"


def split_clauses(text):
    """'1 kilo rice and 2 kilo sugar' -> ['1 kilo rice', '2 kilo sugar']"""
    text = (text or "").translate(ARABIC_DIGITS)
    return [c.strip(STRIP_CHARS) for c in SPLIT_RE.split(text) if c and c.strip(STRIP_CHARS)]


def has_content(clause):
    """True when a clause names something (not just 'chahiye' / 'please' / numbers / units)."""
    for tok in tokens(clause):
        if tok in FILLER or tok in NUM_WORDS or tok in UNIT_CANON or tok.isdigit() or len(tok) < 3:
            continue
        return True
    return False


PIECE_WORDS = {"egg", "eggs", "piece", "pieces", "pcs", "pc", "انڈے", "انڈا", "انڈہ", "عدد", "پیس", "پیسز"}


def piece_pack_size(p):
    m_ = re.match(r"\s*(\d+(?:\.\d+)?)\s*(?:pcs|pc|pieces|piece|عدد)\b", p.get("size", ""), re.I)
    return float(m_.group(1)) if m_ else None


def count_as_pack(clause, pool):
    """'six eggs' when eggs come in packs of 6 and 12 -> (6.0, [the 6-packs]): the customer named the PACK, not 6 packs."""
    text = (clause or "").translate(ARABIC_DIGITS).lower()
    text = re.sub(r"half\s+(?:a\s+)?dozen|آدھا\s+درجن", "6", text)
    text = re.sub(r"(?:\ba\s+)?\bdozen\b|درجن", "12", text)
    text = spoken_to_digits(text)
    for n_, w1, w2 in re.findall(r"(\d+(?:\.\d+)?)\s+([^\s\d]+)(?:\s+([^\s\d]+))?", text):
        if any(w.strip(".,،؟?!") in PIECE_WORDS for w in (w1, w2) if w):       # "6 eggs", "6 desi eggs"
            hits = [p for p in pool if piece_pack_size(p) == float(n_)]
            if hits:
                return float(n_), hits
    return None


def quantity_text(clause):
    """The clause if it states an amount ('2 kilo', 'aik', 'three'), else None.
    'de do' / 'kar do' (= 'please give') is not the number two."""
    c = (clause or "").translate(ARABIC_DIGITS)
    c = re.sub(r"(?<!\w)(?:de|kar|le|دے|کر|لے)\s*(?:do|دو)(?!\w)", " ", c, flags=re.I)
    if re.search(r"\d", c) or any(tok in NUM_WORDS for tok in tokens(c)):
        return c
    return None


SIZE_WORDS = {"small", "large", "medium", "big", "mini", "chota", "chhota", "bara", "بڑا", "بڑی", "چھوٹا", "چھوٹی",
              "درمیانہ", "درمیانی", "regular", "family", "jumbo"}


def item_groups(text, pool):
    """"aloo tamatar" (no 'and' between) = TWO items: every content word that points at its own products, where
    no product contains both words, is a separate item. -> [{"text": slice of the sentence, "n": products}] or [] / 1 item."""
    if len(pool) < 3 or not text:
        return []
    skip = set(FILLER) | set(NUM_WORDS) | set(UNIT_CANON) | _UR_STOP | set(_ONES) | set(_TENS) | _SAU | SIZE_WORDS
    ptoks = [_product_tokens(p) for p in pool]
    found = []                                     # (start, end, frozenset of product indexes)
    for m_ in re.finditer(r"[\w]+", text.translate(ARABIC_DIGITS)):
        w = m_.group().lower()
        if len(w) < 2 or w in skip or w.isdigit():
            continue
        hit = frozenset(i for i, ts in enumerate(ptoks) if any(_tok_strength(w, t_) >= 0.8 for t_ in ts))
        if 0 < len(hit) < len(pool):
            found.append((m_.start(), m_.end(), hit))
    # keep one word per distinct product set; words whose products overlap another word belong to ONE item
    groups = []
    for st, en, hit in found:
        for g in groups:
            if g["hit"] & hit:
                g["hit"] |= hit; g["end"] = en
                break
        else:
            groups.append({"start": st, "end": en, "hit": set(hit)})
    if len(groups) < 2:
        return []
    out, prev = [], 0
    for i, g in enumerate(groups):
        end = len(text) if i == len(groups) - 1 else g["end"]
        out.append({"text": text[prev:end].strip(), "n": len(g["hit"])})
        prev = g["end"]
    return out


def queue_more_items(pair, groups):
    """Items 2..n said in one breath ("potato and tomato"): they come next, in the order spoken."""
    extra = SLOTS_EXTRA.setdefault(pair, [])
    new = [{"clause": g["text"], "qty": quantity_text(g["text"])} for g in groups]
    extra[:0] = new
    for _ in groups:
        queue.insert(0, pair)


def extract_requests(utt):
    """Every item in the sentence, in the order spoken: [{"pair": (family, type) | None, "clause", "qty"}].
    English and Urdu transcripts are read separately (like detect_for_utt) and merged."""
    parsed = []
    for text in (utt.en, utt.ur):
        items = []
        for clause in split_clauses(text):
            fams = detect_families(clause)
            if fams:
                q = quantity_text(clause) if len(fams) == 1 else None
                if q and len(fams) == 1 and fams[0][0] in BY_FAMILY and count_as_pack(clause, BY_FAMILY[fams[0][0]]):
                    q = "1"                                    # "six eggs" = ONE pack of 6
                grp = item_groups(clause, BY_FAMILY[fams[0][0]]) if len(fams) == 1 and fams[0][0] in BY_FAMILY else []
                if grp:                                    # "aloo tamatar" = two items of the same family
                    items += [{"pair": fams[0], "clause": g["text"], "qty": quantity_text(g["text"])} for g in grp]
                else:
                    items += [{"pair": pr, "clause": clause, "qty": q} for pr in fams]
            elif has_content(clause):
                items.append({"pair": None, "clause": clause, "qty": None})     # something we don't recognise yet
        parsed.append(items)
    known = lambda items: sum(1 for i in items if i["pair"])
    en_items, ur_items = parsed
    # The item list comes from the transcript of the language the user is speaking. The other transcript is often
    # confident nonsense ("Oil of one sixty gram" for Urdu speech) and used to create items nobody asked for.
    # It is used only as a fallback when nothing is recognised, and to complete brand / quantity of the SAME item.
    main, other = (ur_items, en_items) if utt.lang == "urdu" else (en_items, ur_items)
    if known(main) == 0 and known(other) > 0:
        main, other = other, main
    merged = [dict(i) for i in main]
    for o in other:
        if not o["pair"]:
            continue
        hit = next((m for m in merged if m["pair"] == o["pair"]), None)
        if hit:
            hit["clause"] += " " + o["clause"]       # brand names are often only right in one transcript
            hit["qty"] = hit["qty"] or o["qty"]
    return merged


_UNKNOWN_CACHE = {}      # (clause, language) -> Gemini's answer


async def resolve_unknown(reqs, lang):
    """Items our word lists don't know (e.g. 'pyaaz') go to the LLM once, all in parallel. -> (reqs, missing names)"""
    unknown = [r for r in reqs if r["pair"] is None]
    if not unknown:
        return reqs, []
    todo = [r for r in unknown if (r["clause"].lower(), lang) not in _UNKNOWN_CACHE]
    fetched = await asyncio.gather(*[_aextract(r["clause"], lang, []) for r in todo])
    for r, ans in zip(todo, fetched):
        if ans.get("intent") == "add_items":          # only real answers are remembered, never a failed call
            _UNKNOWN_CACHE[(r["clause"].lower(), lang)] = ans
    fresh = {id(r): a for r, a in zip(todo, fetched)}
    parsed = [_UNKNOWN_CACHE.get((r["clause"].lower(), lang)) or fresh[id(r)] for r in unknown]
    missing = []
    for r, ans in zip(unknown, parsed):
        for x in (ans.get("items") or []):
            fam = x.get("catalog_name")
            if fam in BY_FAMILY:
                pt = next((p_ for f_, p_ in detect_families(x.get("mentioned_as") or "") if f_ == fam and p_), None)
                r["pair"], r["qty"] = (fam, pt), quantity_text(r["clause"])
                break
        if r["pair"] is None and ans.get("intent") == "add_items":
            missing.append(" ".join(tok for tok in tokens(r["clause"]) if tok not in FILLER and tok not in NUM_WORDS
                                    and tok not in UNIT_CANON and not tok.isdigit()))
    return [r for r in reqs if r["pair"]], [m for m in missing if m]


def register_requests(reqs):
    """Queue every new item and remember what was said about it. Returns the items that were newly added."""
    added, seen_now = [], set()
    for r in reqs:
        pair = r["pair"]
        if not pair:
            continue
        if pair in seen_now and pair in queue:
            queue.append(pair)                         # same family twice in ONE sentence = two different items
            SLOTS_EXTRA.setdefault(pair, []).append({"clause": r["clause"], "qty": r["qty"]})
            added.append(r)
            continue
        seen_now.add(pair)
        in_current = current and current["family"] == pair[0] and current["ptype"] == pair[1]
        if in_current:
            continue
        if pair in queue:                              # already waiting: just keep the newest details
            old = SLOTS.get(pair) or {}
            SLOTS[pair] = {"clause": (old.get("clause", "") + " " + r["clause"]).strip(), "qty": r["qty"] or old.get("qty")}
            continue
        queue.append(pair)
        SLOTS[pair] = {"clause": r["clause"], "qty": r["qty"]}
        added.append(r)
    return added


UNIT_UR = {"kg": "کلو", "g": "گرام", "l": "لیٹر", "ml": "ملی لیٹر"}


def qty_display(qtext, lang):
    if not qtext:
        return ""
    for n, u in sorted(size_pairs(numwords_to_digits(qtext))):
        if u in BASE_UNITS:
            return f"{fmt_qty(n)} " + (UNIT_UR[u] if lang == "urdu" else u)
    n = parse_quantity_rules(qtext)
    return fmt_qty(n) if n else ""


def describe_request(r, lang, by_item=False):
    label = pair_label(r["pair"], lang)
    pool = pool_for(*r["pair"]) if (by_item and r["pair"][0] in BY_FAMILY) else []
    near = narrow_products(pool, r["clause"]) if len(pool) > 1 else []
    if len(near) > 1 and lang == "urdu":               # two apples: say "سیب"
        common = set(_urdu_words(near[0]))
        for q in near[1:]:
            common &= set(_urdu_words(q))
        if common:
            label = sorted(common, key=len)[0]
    if len(near) == 1:                                 # "tomato" and "potato" are both Vegetables: name the item itself
        label = (" ".join(_urdu_words(near[0])[:1]) or label) if lang == "urdu" else (short_name(near[0]) if len(short_name(near[0])) >= 8 else near[0]["name"])
    return f"{qty_display(r['qty'], lang)} {label}".strip()


# ---- change the basket by voice: "sugar hata do" / "make the soap 5" / "cheeni 3 kar do" -------------------------

DELETE_WORDS = ["remove", "delete", "hata", "hatao", "hatado", "hatana", "nikal", "nikaal", "nikalo", "nikaldo",
                "hata do", "nikal do", "take out", "ہٹا", "ہٹاؤ", "ہٹادو", "ہٹانا", "نکال", "نکالو", "نکالدو",
                "ہٹا دو", "نکال دو", "ڈیلیٹ", "ریموو"]
UPDATE_WORDS = SET_WORDS + ["make", "set", "kar den", "kardein", "kar dein", "کر دیں", "کردیں", "کریں", "should be",
                            "instead", "quantity", "تعداد", "مقدار"]
ALL_WORDS = ["all", "sab", "sabhi", "everything", "سب", "تمام", "سارے"]
LAST_WORDS = ["last", "akhri", "akhiri", "آخری"]
FINISH_PHRASES = ["no more", "nothing else", "that's all", "thats all", "that is all", "aur kuch nahi", "kuch aur nahi",
                  "اور کچھ نہیں", "کچھ اور نہیں", "آرڈر نہیں کرنا", "اور آرڈر نہیں", "bas itna", "بس اتنا",
                  "order nahi karna", "don't want anything else", "dont want anything else"]
FINISH_WORDS = {"confirm", "کنفرم", "checkout"}
SKIP_PHRASES = ["skip", "chor do", "chhor do", "chodo", "rehne do", "reh do", "leave it", "forget it", "nahi lena",
                "چھوڑ دو", "چھوڑیں", "رہنے دو", "نہیں لینا", "no thanks"]


def wants_finish(text):
    """'that's all, confirm what I have' — said while an item is still being chosen: stop asking, go to the order."""
    return has_any(text, FINISH_PHRASES) or has_any(text, FINISH_WORDS)


def wants_skip(text):
    return has_any(text, SKIP_PHRASES) or (has_any(text, ["nahi chahiye", "نہیں چاہیے"]) and len(tokens(text)) <= 6)


def _line_is(c, fam, pt):
    if c["family"] != fam:
        return False
    if pt is None:
        return True
    if pt.startswith("kw:"):
        return _name_has(c["name"], EXTRA_ITEMS[pt[3:]]["find"])
    return product_type(fam, c["name"]) == pt


def cart_targets(utt):
    """Basket lines the sentence points at: by item name, by brand, 'last item' or 'first item'."""
    both, low = utt.both, utt.both.lower()
    if has_any(both, LAST_WORDS) and current_cart:
        return [current_cart[-1]]
    for words_, idx in ORDINALS:
        if has_any(both, words_) and idx < len(current_cart) and has_any(both, ["item", "cheez", "چیز", "آئٹم"]):
            return [current_cart[idx]]
    pairs = detect_for_utt(utt)
    hits = [c for c in current_cart if any(_line_is(c, f, pt) for f, pt in pairs)]
    by_brand = [c for c in current_cart if c["brand"] and len(c["brand"]) >= 3 and c["brand"].lower() in low]
    if by_brand:
        hits = [c for c in hits if c in by_brand] or by_brand
    return hits


def edit_cart(utt, lang):
    """Remove an item or change its quantity. Returns (display, speech) or None if the sentence isn't an edit."""
    global order_pending_confirmation
    both = utt.both
    wants_delete = has_any(both, DELETE_WORDS)
    wants_update = any(w in both.lower() for w in UPDATE_WORDS)
    if not current_cart or not (wants_delete or wants_update):
        return None
    hits = cart_targets(utt)
    if not hits:
        if wants_delete and current is None:
            m = t(lang, f"Which item should I remove? You have: {cart_lines_text(lang)}.",
                  f"کونسی چیز ہٹاؤں؟ آپ کے آرڈر میں ہے: {cart_lines_text(lang)}۔")
            return m, m
        return None
    if len(hits) > 1 and not has_any(both, ALL_WORDS):
        names = t(lang, ", ", "، ").join(c["name"] for c in hits)
        m = t(lang, f"You have more than one: {names}. Please say the brand, for example the first one.",
              f"ایک سے زیادہ ہیں: {names}۔ برانڈ کا نام بتائیں۔")
        return m, m
    qty = None
    if wants_update and not wants_delete:
        text = utt.text or both
        p0 = PRODUCTS.get(hits[0]["id"])
        if p0 and len(hits) == 1:
            qty = packs_from_text(text, p0)[0]
        if qty is None:
            qty = parse_quantity_rules(numwords_to_digits(text))
        if qty is None and current is not None:      # "Dettol kar do" while choosing a brand is an answer, not an edit
            return None
    if wants_delete:
        names = t(lang, ", ", "، ").join(c["name"] for c in hits)
        for c in hits:
            current_cart.remove(c)
        order_pending_confirmation = False
        pre = t(lang, f"Okay, removed {names}. ", f"ٹھیک ہے، {names} ہٹا دیا۔ ")
    else:
        if qty is None or qty <= 0 or qty > 100:
            m = t(lang, f"How many {hits[0]['name']} would you like? Say for example: make it 3.",
                  f"{hits[0]['name']} کتنے چاہییں؟ مثلاً کہیں: تین کر دو۔")
            return m, m
        for c in hits:
            c["quantity"] = qty
        order_pending_confirmation = False
        pre = t(lang, f"Okay, {hits[0]['name']} is now {fmt_qty(qty)}. ", f"ٹھیک ہے، {hits[0]['name']} اب {fmt_qty(qty)} ہے۔ ")
    d, s_ = build_cart_summary(lang)
    return pre + d, pre + s_


def skip_current(lang):
    """Drop the item being chosen and carry on with the next one."""
    global current
    label = pair_label((current["family"], current["ptype"]), lang)
    current = None
    return compose(t(lang, f"Okay, skipping {label}.", f"ٹھیک ہے، {label} چھوڑ دیتے ہیں۔"), start_next(lang), lang)


def finish_now(lang):
    """'That's all, confirm what I have' while an item is still being chosen: drop what is pending, read the order."""
    global current
    skipped = ([pair_label((current["family"], current["ptype"]), lang)] if current else []) + [pair_label(pr, lang) for pr in queue]
    current = None
    queue.clear(); SLOTS.clear(); SLOTS_EXTRA.clear()
    if not current_cart:
        m = t(lang, "Okay, nothing added. What would you like?", "ٹھیک ہے، کچھ شامل نہیں کیا۔ آپ کو کیا چاہیے؟")
        return m, m
    pre = t(lang, f"Okay, skipping {join_names(skipped, lang)}. ", f"ٹھیک ہے، {join_names(skipped, lang)} چھوڑ دیتے ہیں۔ ") if skipped else ""
    d, s_ = request_confirmation(lang)
    return pre + d, pre + s_


def residual_utterance(utt, pairs):
    """The sentence without the clauses about the given NEW items (what's left may answer the current question)."""
    def keep(text):
        return " ".join(c for c in split_clauses(text) if not (detect_families(c) and all(f in pairs for f in detect_families(c))))
    en, ur = keep(utt.en), keep(utt.ur)
    if not en.strip() and not ur.strip():
        return None
    return Utterance(ur if utt.lang == "urdu" and ur.strip() else (en or ur), utt.lang, en, ur)


# ============================================================
# LLM — only for sentences the fast rules can't handle
# ============================================================

def build_system_prompt():
    catalog = "\n".join(f'- "{f}"' for f in BY_FAMILY)
    return f"""You are AssanMart, a voice-first grocery ordering assistant for Pakistan.

ITEM CATEGORIES:
{catalog}

Respond with ONLY valid JSON in this shape:
{{"intent": "add_items" | "confirm_order" | "cancel_order" | "check_cart" | "chat",
  "items": [{{"catalog_name": "<exact category>" or null, "mentioned_as": "<what user said>", "quantity": <number> or null, "action": "add" | "set"}}],
  "reply_text": "<only for intent chat>"}}

Rules:
- add_items: map every item the user mentions to the EXACT category above; null if not in the list.
- Brand, pack size and quantity are asked by the backend later. Only fill "quantity" when the user is CHANGING
  an existing item ("make the sugar 3", "cheeni 2 kar do") and then set action "set". Otherwise quantity null, action "add".
- confirm_order / cancel_order / check_cart as the names suggest.
- chat: greetings, questions, language-switch requests. Reply in 1-2 short sentences.
- SAFETY: if the user says anything like a card number, CVV or OTP, do not extract it; intent chat and explain
  we only support Cash on Delivery (or a JazzCash request), never card details by voice.
- Never state prices. If you must mention money, say "rupees" (English) or "روپے" (Urdu) — never "Rs".
- Reply in the language given in [Language: ...] — English when it says english, Urdu script when it says urdu."""


SYSTEM_PROMPT = None


def understand_and_extract(user_text: str, language: str, history: list) -> dict:
    global SYSTEM_PROMPT
    if SYSTEM_PROMPT is None:
        SYSTEM_PROMPT = build_system_prompt()
    hist = [types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
            for m in history[-4:]]
    try:
        out = _gemini_sync(f"[Language: {language}] {user_text}", 500, system=SYSTEM_PROMPT, json_mode=True, history=hist)
        try:
            return json.loads(out)
        except Exception:
            # Urdu text can make the model write a bad \u escape: drop stray backslashes and retry
            return json.loads(re.sub(r'\\(?!["\\/bfnrtu])|\\u(?![0-9a-fA-F]{4})', '', out))
    except Exception as e:
        print(f"⚠️ Gemini parse failed: {e}")
        return {"intent": "chat", "items": [], "reply_text": ""}


# ============================================================
# SPEECH-TO-TEXT
# ============================================================

@dataclass
class Utterance:
    text: str       # transcript in the chosen language (shown to the user)
    lang: str       # "english" | "urdu"
    en: str
    ur: str
    switched: bool = False   # True when the user just asked to change the conversation language

    @property
    def both(self):
        return f"{self.en} {self.ur}".strip()


TOP_BRANDS = []


def _top_brands():
    global TOP_BRANDS
    if not TOP_BRANDS:
        seen = []
        for fam in BRANDS.values():
            for b in fam[:3]:
                if b not in seen and b.lower() != "generic":
                    seen.append(b)
        TOP_BRANDS = seen[:50]
    return TOP_BRANDS


def _deepgram_call(audio_data: bytes, language_code: str, content_type: str = "audio/webm"):
    try:
        headers = {"Authorization": f"Token {DEEPGRAM_KEY}", "Content-Type": content_type}
        base = f"https://api.deepgram.com/v1/listen?model=nova-3&language={language_code}&punctuate=true"
        url = base
        if language_code == "en":   # keyterm prompting helps English recognise brand names
            url += "".join(f"&keyterm={requests.utils.quote(b)}" for b in _top_brands())
        response = http.post(url, headers=headers, data=audio_data)
        if response.status_code == 400 and url != base:
            response = http.post(base, headers=headers, data=audio_data)
        if response.status_code != 200:
            print(f"⚠️ Deepgram error ({language_code}): {response.status_code} {response.text[:200]}")
            return "", 0.0
        alt = response.json()["results"]["channels"][0]["alternatives"][0]
        return alt["transcript"], alt.get("confidence", 0.0)
    except Exception as e:
        print(f"⚠️ Deepgram call failed ({language_code}): {e}")
        return "", 0.0


SWITCH_CUE = re.compile(r"speak|talk|baat|بات|language|zaban|zuban|زبان|bol|بول|reply|respond|response|jawab|جواب|switch|"
                        r"change|convert|مجھ سے|mujh se|can you|can we|could you|کیا|kya")
OTHER_LANG = re.compile(r"other language|another language|dusri zaban|doosri zaban|دوسری زبان|دوسرے زبان")


def choose_language(en_text, en_conf, ur_text, ur_conf):
    """Language is asked at the start ("English or Urdu?"). After that it NEVER changes by itself — only when the
    user asks: 'can you talk to me in Urdu?' / 'can we speak English?' / 'talk in the other language'."""
    both = f"{en_text} {ur_text}".lower()
    wants_en = re.search(r"english|انگلش|انگلیش|انگریزی|angrezi|ingli", both)
    wants_ur = re.search(r"\burdu\b|اردو|اُردو", both)
    if not language_chosen:                       # this is the answer to "English or Urdu?"
        if wants_ur and not wants_en:
            return "urdu"
        if wants_en and not wants_ur:
            return "english"
        if re.search(r"[\u0600-\u06FF]", ur_text) and ur_conf >= en_conf:   # no word for it: use what they spoke
            return "urdu"
        return "english"
    cur = S_language()
    if OTHER_LANG.search(both):
        return "english" if cur == "urdu" else "urdu"
    # a language word only counts as a switch request when phrased like one (or said alone), never inside an order
    asked = bool(SWITCH_CUE.search(both)) or max(len(tokens(en_text)), len(tokens(ur_text))) <= 3
    if asked and wants_ur and not wants_en:
        return "urdu"
    if asked and wants_en and not wants_ur:
        return "english"
    return cur


def S_language():
    return session_language or "english"


SWITCH_RE = re.compile(r"urdu|english|اردو|انگلش|انگریزی|angrezi")


async def stt_raw(audio_path: str, content_type: str, cur: str, chosen: bool):
    """The network part of speech-to-text. Uses NO conversation state, so many customers can be transcribed at once.
    English + Urdu are transcribed in parallel; if the call for the CURRENT language comes back first and is confident,
    the slower call is not waited for. -> (en_text, en_conf, ur_text, ur_conf)"""
    with open(audio_path, "rb") as f:
        audio_data = f.read()
    # the real container decides, not the label the browser put on it (iPhone sends mp4, Chrome sends webm)
    if audio_data[:4] == b"\x1aE\xdf\xa3":
        content_type = "audio/webm"
    elif audio_data[4:8] == b"ftyp":
        content_type = "audio/mp4"
    elif audio_data[:4] == b"OggS":
        content_type = "audio/ogg"
    elif audio_data[:4] == b"RIFF":
        content_type = "audio/wav"
    t_en = asyncio.create_task(asyncio.to_thread(_deepgram_call, audio_data, "en", content_type))
    t_ur = asyncio.create_task(asyncio.to_thread(_deepgram_call, audio_data, "ur", content_type))
    first, other = (t_en, t_ur) if cur == "english" else (t_ur, t_en)
    fn, on = ("en", "ur") if first is t_en else ("ur", "en")
    # Urdu sessions need both transcripts while choosing brands/products (English brand names), so no shortcut there
    # Urdu brands/products are matched through brand_ur + aliases, so a confident Urdu transcript is enough on its own
    results = {}
    if chosen:
        text, conf = await first
        results[fn] = (text, conf)
        if conf >= (0.8 if cur == "english" else 0.85) and text.strip() and not SWITCH_RE.search(text.lower()) and not OTHER_LANG.search(text.lower()):
            other.cancel()
        else:
            results[on] = await other
    else:
        results["en"], results["ur"] = await asyncio.gather(t_en, t_ur)
    en_text, en_conf = results.get("en", ("", 0.0))
    ur_text, ur_conf = results.get("ur", ("", 0.0))
    print(f"🇬🇧 EN ({en_conf:.2f}): {en_text}\n🇵🇰 UR ({ur_conf:.2f}): {ur_text}")
    return en_text, en_conf, ur_text, ur_conf


def build_utterance(en_text, en_conf, ur_text, ur_conf) -> Utterance:
    """Decides the language and builds the Utterance. Uses the conversation state: call it inside use_session()."""
    global session_language
    if not en_text.strip() and not ur_text.strip():
        return Utterance("", session_language or "english", "", "")
    if language_chosen and max(en_conf, ur_conf) < 0.4:      # mumbling / background noise: don't answer it, keep listening
        print("🔇 too uncertain — ignored")
        return Utterance("", session_language or "english", "", "")
    best_conf = max(en_conf, ur_conf)
    main_ = ur_text if ur_conf >= en_conf else en_text
    words_ = tokens(main_)
    if language_chosen and best_conf < 0.6 and len(words_) >= 3 and len(set(words_)) <= len(words_) * 0.6:
        print("🔇 repeated filler words (echo / noise) — ignored")       # "اس بعد بعد اس بعد کے کے" -> no Gemini call, no reply
        return Utterance("", session_language or "english", "", "")
    prev = session_language or "english"
    lang = choose_language(en_text, en_conf, ur_text, ur_conf)
    session_language = lang
    main = ur_text if lang == "urdu" else en_text
    if not main.strip():           # e.g. Urdu words spoken in an English session: still understand them (reply stays English)
        main = en_text or ur_text
    return Utterance(main, lang, en_text, ur_text, switched=(lang != prev))


async def transcribe_with_deepgram(audio_path: str, content_type: str = "audio/webm") -> Utterance:
    """Single-customer version (kept for tests / scripts)."""
    raw = await stt_raw(audio_path, content_type, S_language(), language_chosen)
    return build_utterance(*raw)


# ============================================================
# TEXT-TO-SPEECH
# ============================================================

async def speak(text: str, language: str, output_path: str) -> bool:
    if language == "urdu":
        def _uplift_call():
            return http.post(
                "https://api.upliftai.org/v1/synthesis/text-to-speech",
                headers={"Authorization": f"Bearer {UPLIFT_KEY}", "Content-Type": "application/json"},
                json={"voiceId": "v_meklc281", "text": text, "outputFormat": "MP3_22050_128"},
            )
        response = await asyncio.to_thread(_uplift_call)
        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            return True
        print(f"⚠️ Uplift TTS failed: {response.status_code} {response.text[:200]}")
        return False
    for attempt in range(2):
        try:
            await edge_tts.Communicate(text, "en-US-AriaNeural").save(output_path)
            return True
        except Exception as e:
            print(f"⚠️ edge-tts attempt {attempt + 1} failed: {e}")
            await asyncio.sleep(0.2)
    return False


TTS_JOBS = {}      # id -> {"text", "lang", "ts"}
TTS_CACHE = {}     # (lang, text) -> mp3 bytes  (repeated phrases are instant)


class TTSJob:
    """One spoken reply. Synthesis starts the moment the reply is decided (not when the browser asks for it),
    and the browser can start playing while the rest is still being produced."""
    def __init__(self, text, lang):
        self.text, self.lang, self.ts = text, lang, time.time()
        self.chunks, self.done = [], False


def clean_for_tts(text: str) -> str:
    """edge-tts answers 'No audio was received' for text it can not read (dashes, Arabic semicolons, emoji, markdown ...).
    Turn those into plain pauses so the voice always gets something it can speak."""
    t_ = re.sub(r"[\u2014\u2013\u2012\u2015]", ", ", text or "")              # em / en dashes
    t_ = t_.replace("؛", "،").replace(";", ",").replace("۔", ".").replace("؟", "?")
    t_ = re.sub(r"[*_#`~|<>{}\[\]\\^]", " ", t_)
    t_ = re.sub(r"[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE0F]", " ", t_)           # emoji
    t_ = t_.replace("&", " and ").replace("₨", "Rs ")
    return re.sub(r"\s+", " ", t_).strip()


async def _edge_collect(text: str, voice: str):
    chunks = []
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return chunks


async def _edge_urdu(text: str):
    """Free Urdu voice with fallbacks: cleaned text, the other Urdu voice, and in the end the English voice (so the
    customer still hears the answer instead of silence)."""
    cleaned = clean_for_tts(text)
    for voice, txt in (("ur-PK-UzmaNeural", cleaned), ("en-US-AriaNeural", cleaned)):      # one Urdu try (a second Urdu voice fails the same way)
        if not txt:
            break
        try:
            chunks = await _edge_collect(txt, voice)
            if chunks:
                return chunks
        except Exception as e:
            print(f"⚠️ edge-tts {voice} failed: {e}")
    return []


async def _run_tts(job):
    key = (job.lang, job.text)
    try:
        if key in TTS_CACHE:
            job.chunks.append(TTS_CACHE[key])
            return
        if job.lang == "urdu":
            data = await _urdu_tts_bytes(job.text)
            if data:
                job.chunks.append(data)
            else:                                   # Uplift failed / out of balance -> free Urdu neural voice
                job.chunks.extend(await _edge_urdu(job.text))
        else:
            for attempt in range(2):
                try:
                    job.chunks.extend(await _edge_collect(clean_for_tts(job.text) or job.text, "en-US-AriaNeural"))
                    break
                except Exception as e:
                    print(f"⚠️ edge-tts attempt {attempt + 1} failed: {e}")
                    if job.chunks:            # already partly produced: keep what we have
                        break
        if job.chunks:
            _cache_put(key, b"".join(job.chunks))
    except Exception as e:
        print(f"⚠️ TTS job failed: {e}")
    finally:
        job.done = True


def _urdu_size(size):
    m_ = re.match(r"\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)", size or "")
    if not m_:
        return {"Small": "چھوٹی", "Medium": "درمیانی", "Large": "بڑی"}.get(size, "")
    num, unit = m_.group(1), m_.group(2).lower()
    unit = {"kg": "کلو", "g": "گرام", "l": "لیٹر", "ml": "ملی لیٹر", "pcs": "عدد", "pack": "پیک", "pouch": "پاؤچ"}.get(unit, unit)
    return f"{num} {unit}"


_GENERIC_UR = {}


def _generic_ur(family):
    """Urdu words that name the WHOLE family ("سبزی", "کولڈ ڈرنک", "چائے") — shared by many of its products."""
    if family not in _GENERIC_UR:
        items = BY_FAMILY.get(family, [])
        count = {}
        for q in items:
            for a_ in {x.strip() for x in re.split(r"[;,،]", q.get("aliases", "")) if re.search(r"[\u0600-\u06FF]", x)}:
                count[a_] = count.get(a_, 0) + 1
        need = max(2, len(items) * 0.4)
        _GENERIC_UR[family] = {a_ for a_, n_ in count.items() if n_ >= need} | {FAMILY_UR.get(family, "")}
    return _GENERIC_UR[family]


def _urdu_words(p):
    """The specific Urdu name of a product from the aliases column ("ٹماٹر", "آلو", "سیب کالا کلو")."""
    bu = p.get("brand_ur") or ""
    gen = _generic_ur(p["family"])
    out = []
    for a_ in re.split(r"[;,،]", p.get("aliases", "")):
        a_ = a_.strip()
        if not a_ or re.search(r"\d", a_) or not re.search(r"[\u0600-\u06FF]", a_) or a_ in ("عام",):
            continue
        rest = a_.replace(bu, "").strip() if bu else a_
        if not rest or a_ == bu or a_ in gen or rest in gen:
            continue
        if re.search(r"[a-zA-Z]", a_):
            continue
        out.append(a_)
    return out


def _urdu_item_name(p):
    """Spoken Urdu name of a product: brand + Urdu item word (from the aliases column) + size."""
    bu = p.get("brand_ur") or ""
    words = _urdu_words(p)
    own = [a for a in words if bu and bu in a]
    if own:                                   # the alias already contains the brand ("ڈالڈا کوکنگ آئل")
        base = min(own, key=lambda a: abs(len(a.split()) - 3))
    elif words:
        brand = bu if p.get("brand") != "Generic" else ""
        base = f"{brand} {' '.join(words[:2])}".strip()
    else:                                     # no specific word: "نیسکیفے کافی" (brand + what it is)
        alias_own = [a.strip() for a in re.split(r"[;,،]", p.get("aliases", ""))
                     if bu and bu in a and a.strip() != bu and not re.search(r"[\d a-zA-Z]", a.replace(" ", "")) and a.strip() != bu]
        if alias_own:
            base = min(alias_own, key=lambda a: abs(len(a.split()) - 2))
        else:
            brand = bu if p.get("brand") != "Generic" else ""
            base = f"{brand} {FAMILY_UR.get(p['family'], '')}".strip()
    sz = _urdu_size(p["size"])
    return base if (not sz or sz.split()[0] in base) else f"{base} {sz}".strip()


def urduize(text):
    """The Urdu voice can't pronounce English product names — say them in Urdu (the screen text stays English)."""
    rep_ = {}
    for p in PRODUCTS.values():
        ur = _urdu_item_name(p)
        rep_[p["name"]] = ur
        sn = short_name(p)
        if sn and sn != p["name"] and sn not in rep_:
            rep_[sn] = re.sub(r"^" + re.escape(p.get("brand_ur", "")) + r"\s*", "", ur) if p.get("brand_ur") else ur
    for k in sorted(rep_, key=len, reverse=True):
        if k in text:
            text = text.replace(k, rep_[k])
    for b, ur in BRAND_UR.items():
        if b != "Generic":
            text = re.sub(rf"(?<![A-Za-z]){re.escape(b)}(?![A-Za-z])", ur, text)
    return text


STORE_NAME_RE = re.compile(r"\bAa?s+aa?n[\s\-]*Mart\b", re.I)


def pronounce_brand(text, lang):
    """The English voice reads "AssanMart" wrongly, so it gets a phonetic spelling. Spoken text only: the words on screen stay as they are."""
    return STORE_NAME_RE.sub("آسان مارٹ" if lang == "urdu" else "Ahsahn Mart", text)


def tts_url(text: str, lang: str) -> str:
    """Returns immediately and starts synthesising in the background; the browser streams it from /tts/<id>."""
    text = pronounce_brand(text, lang)            # only the SPOKEN text: "AssanMart" -> "Aasaan Mart" / آسان مارٹ
    if lang == "urdu":
        text = urduize(text)
    tid = uuid.uuid4().hex
    job = TTSJob(text, lang)
    TTS_JOBS[tid] = job
    while len(TTS_JOBS) > 300:
        TTS_JOBS.pop(next(iter(TTS_JOBS)))
    asyncio.get_running_loop().create_task(_run_tts(job))
    return f"/tts/{tid}"


def _cache_put(key, data: bytes):
    TTS_CACHE[key] = data
    while len(TTS_CACHE) > 300:
        TTS_CACHE.pop(next(iter(TTS_CACHE)))


UPLIFT_OFF_UNTIL = 1e18 if os.getenv("UPLIFT_DISABLED") == "1" else 0.0     # after a 401/402/403 (no balance / bad key) we skip Uplift for a while instead of failing every turn


async def _urdu_tts_bytes(text: str):
    global UPLIFT_OFF_UNTIL
    if time.time() < UPLIFT_OFF_UNTIL:
        return None
    def _call():
        return http.post(
            "https://api.upliftai.org/v1/synthesis/text-to-speech",
            headers={"Authorization": f"Bearer {UPLIFT_KEY}", "Content-Type": "application/json"},
            json={"voiceId": "v_meklc281", "text": text, "outputFormat": "MP3_22050_128"},
        )
    try:
        r = await asyncio.to_thread(_call)
    except Exception as e:
        print(f"⚠️ Uplift TTS error: {e}")
        return None
    if r.status_code == 200:
        return r.content
    print(f"⚠️ Uplift TTS failed: {r.status_code} {r.text[:200]}")
    if r.status_code in (401, 402, 403):
        UPLIFT_OFF_UNTIL = time.time() + 600
        print("ℹ️ Uplift disabled for 10 minutes — using the free edge-tts Urdu voice instead")
    return None


def _is_apple_safari(ua: str) -> bool:
    ua = (ua or "").lower()
    return ("iphone" in ua or "ipad" in ua or "ipod" in ua
            or ("safari" in ua and "chrome" not in ua and "chromium" not in ua and "android" not in ua))


@app.get("/tts/{tid}")
async def tts_stream(tid: str, request: Request):
    job = TTS_JOBS.get(tid)
    if not job:
        return Response(status_code=404)
    while not job.chunks and not job.done:          # wait for the first bit of audio
        await asyncio.sleep(0.01)
    if not job.chunks:
        return Response(status_code=502)

    if _is_apple_safari(request.headers.get("user-agent", "")):
        # iPhone/Safari will not play a chunked stream: it needs the full file with a Content-Length and Range (206) support
        waited = 0.0
        while not job.done and waited < 30:
            await asyncio.sleep(0.02)
            waited += 0.02
        data = b"".join(job.chunks)
        size = len(data)
        hdr = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
        rng = request.headers.get("range")
        m = re.match(r"bytes=(\d*)-(\d*)", rng or "")
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:                                   # "bytes=-N" = the last N bytes
                start = max(0, size - int(m.group(2)))
                end = size - 1
            end = min(end, size - 1)
            if start >= size:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
            hdr["Content-Range"] = f"bytes {start}-{end}/{size}"
            return Response(data[start:end + 1], status_code=206, media_type="audio/mpeg", headers=hdr)
        return Response(data, media_type="audio/mpeg", headers=hdr)

    async def gen():
        i = 0
        while True:
            if i < len(job.chunks):
                yield job.chunks[i]
                i += 1
            elif job.done:
                break
            else:
                await asyncio.sleep(0.01)
    return StreamingResponse(gen(), media_type="audio/mpeg")


def cleanup_old_audio(max_age=900):
    now = time.time()
    for fn in os.listdir("temp_audio"):
        p = os.path.join("temp_audio", fn)
        try:
            if now - os.path.getmtime(p) > max_age:
                os.remove(p)
        except OSError:
            pass


# ============================================================
# ROUTES — voice conversation
# ============================================================

@app.post("/greet")
async def greet(request: Request):
    """?lang=english|urdu : the language is already known (chosen by the welcome agent) -> skip the language question.
    ?resume=1 : keep the cart and the conversation (coming back to the voice window), just say we are listening."""
    global session_language, language_chosen
    sid, user = await identify(request)
    cleanup_old_audio()
    qp = request.query_params
    lang_q = qp.get("lang") if qp.get("lang") in ("english", "urdu") else None
    resume = qp.get("resume") in ("1", "true")
    name = user["name"].split()[0] if user and user.get("name") else ""
    async with use_session(sid, user and user["id"]):
        if resume and current_cart is not None:
            lang = lang_q or session_language or "english"
            session_language, language_chosen = lang, True
            n = len(current_cart)
            msg = t(lang, f"Welcome back! You have {n} item{'' if n == 1 else 's'} in your cart. What else would you like to order?" if n
                    else "Welcome back! What would you like to order?",
                    f"خوش آمدید! آپ کی ٹوکری میں {n} چیزیں ہیں۔ اور کیا چاہیے؟" if n else "خوش آمدید! کیا چاہیے؟")
            return {"reply_text": msg, "audio_url": tts_url(msg, lang), "options": ui_options(lang) if current else None,
                    "cart": cart_snapshot(), "history": [{"role": "assistant", "content": msg}], "language": lang}
        reset_session_state()
        if lang_q:
            session_language, language_chosen = lang_q, True
            hi = (f" {name}" if name else "")
            msg = t(lang_q, f"Great{hi}! I'm AssanMart's voice assistant. Tell me what groceries you need.",
                    f"بہت خوب{hi}! میں آسان مارٹ کی وائس اسسٹنٹ ہوں۔ بتائیں آپ کو کیا چاہیے؟")
            return {"reply_text": msg, "audio_url": tts_url(msg, lang_q), "options": None,
                    "cart": cart_snapshot(), "history": [{"role": "assistant", "content": msg}], "language": lang_q}
        greeting = "Assalam-o-Alaikum! I'm AssanMart. Which language would you like to talk in, English or Urdu?"
        if name:
            greeting = f"Assalam-o-Alaikum {name}! I'm AssanMart. Which language would you like to talk in, English or Urdu?"
        return {"reply_text": greeting, "audio_url": tts_url(greeting, "english"), "options": None,
                "cart": cart_snapshot(), "history": [{"role": "assistant", "content": greeting}], "language": "english"}


@app.post("/voice/preload")
async def voice_preload(payload: dict, request: Request):
    """The photo scanner hands over what is still open: {lang, cart:[{id, qty}], lines:["sugar 2kg", ...]}.
    The confirmed items go into this customer's voice cart; the agent then asks about the remaining lines by voice."""
    global session_language, language_chosen
    sid, user = await identify(request)
    lang = "urdu" if payload.get("lang") == "urdu" else "english"
    lines = [str(x).strip() for x in (payload.get("lines") or []) if str(x).strip()][:30]
    async with use_session(sid, user and user["id"]):
        reset_session_state()
        session_language, language_chosen = lang, True
        for c in payload.get("cart") or []:
            p = PRODUCTS.get(int(_num(c.get("id")) or -1))
            q = _num(c.get("qty")) or 1
            if not p:
                continue
            ex = next((x for x in current_cart if x["id"] == p["id"]), None)
            if ex:
                ex["quantity"] += q
            else:
                current_cart.append({"id": p["id"], "name": p["name"], "brand": p["brand"], "family": p["family"],
                                     "quantity": q, "unit_price": p["price"], "size": p["size"], "said": "scan"})
        got = t(lang, f"I added the {len(current_cart)} items you confirmed. " if current_cart else "",
                f"آپ کی تصدیق شدہ {len(current_cart)} چیزیں شامل کر دی ہیں۔ " if current_cart else "")
        if not lines:
            m = got + t(lang, "Anything else you need?", "اور کچھ چاہیے؟")
            return {"reply_text": m, "audio_url": tts_url(m, lang), "options": ui_options(lang),
                    "cart": cart_snapshot(), "history": [{"role": "assistant", "content": m}], "language": lang}
        text = ", ".join(lines)
        ascii_ = sum(ch.isascii() for ch in text) >= len(text) * 0.7
        utt = Utterance(text, lang, text if ascii_ else "", "" if ascii_ else text)
        history = []
        display, speech = await route_utterance(utt, history, lang)
        pre = got + t(lang, "Now the rest. ", "اب باقی چیزیں۔ ")
        display, speech = pre + display, pre + speech
        history += [{"role": "user", "content": text}, {"role": "assistant", "content": display}]
        return {"reply_text": display, "audio_url": tts_url(speech, lang), "options": ui_options(lang),
                "cart": cart_snapshot(), "history": history, "language": lang}


# ---- photo scanner: the agent speaks every step and understands short answers ------------------------------

_ORD = {0: r"\b(1|one|first|ek|aik|pehla|pehli)\b|ایک|پہلا|پہلی|اول", 1: r"\b(2|two|second|do|dusra)\b|دو\b|دوسرا|دوسری",
        2: r"\b(3|three|third|teen|tisra)\b|تین|تیسرا|تیسری", 3: r"\b(4|four|fourth|char|chaar|chotha)\b|چار|چوتھا|چوتھی",
        4: r"\b(5|five|fifth|panch|paanch)\b|پانچ|پانچواں", 5: r"\b(6|six|sixth|chhe|che)\b|چھ\b|چھٹا",
        6: r"\b(7|seven|seventh|saat)\b|سات|ساتواں", 7: r"\b(8|eight|eighth|aath)\b|آٹھ|آٹھواں"}
_S_SKIP = re.compile(r"skip|leave it|not needed|don'?t need|no need|remove|chhor|chor|rehne|nahi chahiye|نہیں چاہیے|چھوڑ|رہنے دو|سکپ|اسکپ|ہٹا")
_S_BACK = re.compile(r"\bback\b|previous|go back|pichl|wapas|واپس|پچھلا|پیچھے")
_S_MORE = re.compile(r"\bmore\b|other|else|another option|aur option|مزید|اور دکھا|دوسرے|دوسری")
_S_REVIEW = re.compile(r"review|change|again|dobara|edit|دوبارہ|تبدیل")
_S_YES = re.compile(r"\b(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|right|correct|good|proceed|start|add|add it|go ahead|next|done|thik|theek|haan|han|ji)\b|ہاں|جی|ٹھیک|درست|کنفرم|شروع|ایڈ|اگلا|آگے|ہو گیا")
_S_NO = re.compile(r"\b(no|nope|cancel|stop)\b|نہیں|رک")


_S_NEXT_CHECKOUT = re.compile(r"check ?out|checkout|\bpay\b|payment|place (?:the |my )?order|order now|confirm (?:the |my )?order|چیک ?آؤٹ|چیک ?آوٹ|چیکاؤٹ|ادائیگی|آرڈر (?:کر|دے|پلیس)|بل")
_S_NEXT_MORE = re.compile(r"\bmore\b|add more|another|scan|photo|picture|\bagain\b|\bmore items\b|مزید|اور چیز|اور سامان|ایڈ مور|دوسری|دوبارہ|تصویر")
_S_NEXT_BROWSE = re.compile(r"brows|continue shopping|keep shopping|look around|\bshop\b|store|دیکھ|براؤز|براوز|سٹور|اسٹور|دکان|خریداری")


def scan_pick_by_name(options, text):
    """Which of the shown options did the customer NAME? Words that tell the options apart (rare words, brand, type) and the
    size said ("5 litre", "ایک کلو") are compared with every option. -> ("pick", index) | ("ambiguous", [indices]) | None."""
    prods = [PRODUCTS.get(o.get("id")) for o in options]
    if len(prods) < 2 or not all(prods):
        return None
    spoken = numwords_to_digits(text.lower())
    want = size_pairs(spoken)
    sc = rank_products(prods, text) or [0.0] * len(prods)
    tot = []
    for p_, base in zip(prods, sc):
        have = size_pairs(f"{p_['name']} {p_.get('size', '')}")
        tot.append(base + (2.0 if want and same_size(want, have) else 0.0))
    top = max(tot)
    if top <= 0:
        return None
    ties = [i for i, v in enumerate(tot) if v >= top - 1e-9]
    if len(ties) == 1:
        return ("pick", ties[0])
    if len(ties) < len(tot):
        return ("ambiguous", ties)
    return None


def scan_intent(context, text, options):
    s = text.lower()
    toks = set(tokens(s))
    if context == "qty":                                   # "how many?" / "you wrote 2 kg — keep it?"
        n = parse_quantity_rules(numwords_to_digits(s))
        if _S_BACK.search(s):
            return {"action": "back"}
        if n is not None and 0 < n <= 100:
            return {"action": "qty", "value": n}
        if _S_YES.search(s) and not _S_NO.search(s):
            return {"action": "yes"}
        if _S_NO.search(s) or _S_REVIEW.search(s):
            return {"action": "no"}
        return {"action": None}
    if context == "next":                                  # after the items were added: checkout / browse / add more
        if _S_NEXT_CHECKOUT.search(s):
            return {"action": "checkout"}
        if _S_NEXT_MORE.search(s):
            return {"action": "more"}
        if _S_NEXT_BROWSE.search(s):
            return {"action": "browse"}
        return {"action": None}
    if context == "pick":
        if _S_SKIP.search(s):
            return {"action": "skip"}
        if _S_BACK.search(s):
            return {"action": "back"}
        if _S_MORE.search(s):
            return {"action": "more"}
        ordinal = [i for i, pat in _ORD.items() if i < len(options) and re.search(pat, s)]
        said_number = re.search(r"\b(number|option|no\.?)\b|نمبر|آپشن", s)
        by_name = scan_pick_by_name(options, text)
        if by_name and not said_number:                    # "Dalda 5 litre", "سفید لوبیا", "the Sella one": by name (and size)
            if by_name[0] == "pick":
                return {"action": "pick", "index": by_name[1]}
            if not ordinal:
                return {"action": "ambiguous", "indices": by_name[1]}
        if ordinal:                                         # "the second one" matches "one" too -> the highest ordinal wins
            return {"action": "pick", "index": max(ordinal)}
        if by_name and by_name[0] == "ambiguous":
            return {"action": "ambiguous", "indices": by_name[1]}
        scores = []
        for i, o in enumerate(options):
            ot = {w for w in tokens(f"{o.get('brand','')} {o.get('name','')} {o.get('size','')}".lower()) if len(w) >= 3}
            scores.append((len(ot & toks), i))
        scores.sort(reverse=True)
        if scores and scores[0][0] >= 1 and (len(scores) == 1 or scores[0][0] > scores[1][0]):
            return {"action": "pick", "index": scores[0][1]}
        if _S_YES.search(s):
            return {"action": "yes"}
        return {"action": None}
    if _S_REVIEW.search(s):
        return {"action": "review"}
    if _S_YES.search(s) and not _S_NO.search(s):
        return {"action": "yes"}
    if _S_NO.search(s):
        return {"action": "no"}
    return {"action": None}


@app.post("/scan/say")
async def scan_say(payload: dict):
    lang = "urdu" if payload.get("lang") == "urdu" else "english"
    text_ = str(payload.get("text") or "")[:900]
    if not text_.strip():
        return {"audio_url": None}
    return {"audio_url": tts_url(text_, lang)}


@app.post("/scan/reply")
async def scan_reply(audio: UploadFile = File(...), context: str = Form("pick"), lang: str = Form("english"),
                     options_json: str = Form("[]")):
    ct = (audio.content_type or "audio/webm").split(";")[0]
    path = f"temp_audio/{uuid.uuid4()}.{'mp4' if 'mp4' in ct else 'webm'}"
    with open(path, "wb") as f:
        f.write(await audio.read())
    try:
        en_text, en_conf, ur_text, ur_conf = await stt_raw(path, ct, lang, True)
    finally:
        os.remove(path)
    try:
        options = json.loads(options_json)
    except Exception:
        options = []
    both = f"{en_text} {ur_text}".strip()
    heard = (ur_text if lang == "urdu" else en_text) or en_text or ur_text
    if not both:
        return {"heard": "", "action": None}
    return {"heard": heard, **scan_intent(context, both, options)}


# ---- sign-up form by voice: the agent asks name -> phone -> address, the form fills itself ------------------

_DIGIT_WORDS = {
    "0": ["zero", "oh", "o", "sifar", "sifr", "صفر", "سفر", "زیرو", "زیر", "اوہ"],
    "1": ["one", "ek", "aik", "ایک", "ون", "وان"],
    "2": ["two", "do", "دو", "ٹو"],
    "3": ["three", "teen", "تین", "تھری", "تھرے", "تری", "تھرى"],
    "4": ["four", "for", "char", "chaar", "چار", "فور", "فار"],
    "5": ["five", "panch", "paanch", "پانچ", "فائیو", "فائو", "پنج"],
    "6": ["six", "chhe", "cheh", "che", "chay", "چھ", "چھے", "چھہ", "سکس", "چھے"],
    "7": ["seven", "saat", "سات", "سیون", "سیوین"],
    "8": ["eight", "aath", "ath", "آٹھ", "ایٹ", "اٹھ"],
    "9": ["nine", "nau", "نو", "نائن", "ناین"],
}
_DW = {w: d for d, ws in _DIGIT_WORDS.items() for w in ws}
_MULT = {"double": 2, "dabal": 2, "dabbal": 2, "dubal": 2, "ڈبل": 2, "ڈبّل": 2, "دوبل": 2, "ڈبلی": 2,
         "triple": 3, "tripal": 3, "teepal": 3, "ٹرپل": 3, "ٹریپل": 3, "تریپل": 3, "ٹپل": 3}
_SEG_WORDS = sorted([w for w in _DW if len(w) > 1], key=len, reverse=True)


def _seg_digits(word):
    """'تھریتری' -> '33', 'سکسون' -> '61' (digit words the speech engine glued together). None if it is not only digit words."""
    n = len(word)
    best = [None] * (n + 1)
    best[0] = ""
    for i in range(n):
        if best[i] is None:
            continue
        for w in _SEG_WORDS:
            if word.startswith(w, i) and best[i + len(w)] is None:
                best[i + len(w)] = best[i] + _DW[w]
    return best[n]


def spoken_phone(text):
    """'zero three double three' / 'زیرو ڈبل تھری سکس47 ٹرپل فور سکس ون' / '0336 47' -> '03364744461' (or what could be understood).
    Understands double / triple (ڈبل / ٹرپل), digit words in English, Urdu and Roman Urdu, glued words (تھریتری = 33) and mixed tokens (سکس47)."""
    toks = re.findall(r"\d+|[^\W\d_]+", (text or "").translate(ARABIC_DIGITS).lower())
    out, mult = [], 1
    for idx, w in enumerate(toks):
        if w in _MULT:
            mult = _MULT[w]
            continue
        if w.isdigit():
            out.append(w[0] * mult + w[1:] if mult > 1 else w)
            mult = 1
            continue
        d = _DW.get(w)
        if d is None and w == "و" and out and idx == len(toks) - 1:   # speech engines often cut the last "ون" to "و"
            d = "1"
        if d is None:
            d = _seg_digits(w)
        if d:
            out.append(d[0] * mult + d[1:] if mult > 1 else d)
            mult = 1
    d = "".join(out)
    if d.startswith("92") and len(d) == 12:
        d = "0" + d[2:]
    if len(d) == 10 and d.startswith("3"):
        d = "0" + d
    return d


_NAME_LEAD = re.compile(r"^(?:my name is|my name's|i am|i'm|this is|name is|mera naam|میرا نام|میرا نام ہے|نام)\s+", re.I)
_ADDR_LEAD = re.compile(r"^(?:my address is|address is|it is|it's|mera pata|میرا پتہ|میرا ایڈریس|پتہ|ایڈریس)\s+", re.I)


@app.post("/form/reply")
async def form_reply(audio: UploadFile = File(...), field: str = Form("name"), lang: str = Form("english")):
    ct = (audio.content_type or "audio/webm").split(";")[0]
    path = f"temp_audio/{uuid.uuid4()}.{'mp4' if 'mp4' in ct else 'webm'}"
    with open(path, "wb") as f:
        f.write(await audio.read())
    try:
        en_text, en_conf, ur_text, ur_conf = await stt_raw(path, ct, lang, True)
    finally:
        os.remove(path)
    main = (ur_text if lang == "urdu" else en_text) or en_text or ur_text
    if not (en_text + ur_text).strip() or max(en_conf, ur_conf) < 0.3:
        return {"heard": "", "value": "", "ok": False}
    if field == "phone":
        for cand in (en_text, ur_text):
            d = spoken_phone(cand)
            if len(d) == 11 and d.startswith("03"):
                return {"heard": main, "value": d, "ok": True}
        best = max((spoken_phone(c) for c in (en_text, ur_text, main)), key=len)     # keep the fullest attempt, the form shows what was heard
        return {"heard": main, "value": best, "ok": False}
    if field == "name":
        v = _NAME_LEAD.sub("", main.strip()).strip(" .،۔")
        return {"heard": main, "value": v.title() if v.isascii() else v, "ok": len(v) >= 2}
    if field == "address":
        v = _ADDR_LEAD.sub("", main.strip()).strip(" .،۔")
        return {"heard": main, "value": v, "ok": len(v) >= 4}
    intent = scan_intent("summary", f"{en_text} {ur_text}", [])     # yes / no (and "change name / phone / address")
    low = f"{en_text} {ur_text}".lower()
    which = ("name" if re.search(r"name|نام", low) else "phone" if re.search(r"phone|number|نمبر|فون", low)
             else "address" if re.search(r"address|پتہ|ایڈریس", low) else None)
    return {"heard": main, "action": intent.get("action"), "which": which, "ok": True}


# ---- welcome agent: language -> voice or browse -> (after an order) what next --------------------------------

WELCOME_SAY = {
    "language": ("Assalam-o-Alaikum! Welcome to AssanMart. I'm your voice assistant. Which language would you like to talk in, English or Urdu?",
                 "english"),
    "mode": {
        "english": "Great! I can take your whole grocery order by voice, or you can browse the store yourself. Would you like to order by voice, or browse?",
        "urdu": "بہت خوب! میں آپ کا پورا آرڈر آواز سے لے سکتی ہوں، یا آپ خود اسٹور براؤز کر سکتے ہیں۔ آپ آواز سے آرڈر کرنا چاہیں گے یا براؤز کرنا؟"},
    "after_order": {
        "english": "Your order has been placed. Would you like to place another order by voice, browse the store, or are you done?",
        "urdu": "آپ کا آرڈر ہو گیا ہے۔ کیا آپ آواز سے مزید آرڈر کرنا چاہیں گے، اسٹور براؤز کریں گے، یا بس؟"},
    "retry": {
        "english": "Sorry, I didn't catch that. Please say voice, or browse.",
        "urdu": "معذرت، سمجھ نہیں آیا۔ براہِ کرم کہیں آواز، یا براؤز۔"},
    "retry_lang": ("Sorry, I didn't catch that. Please say English, or Urdu.", "english"),
    "browse": {"english": "Alright, take your time and browse. I'm here if you need me.",
               "urdu": "ٹھیک ہے، آپ آرام سے براؤز کریں۔ ضرورت ہو تو میں حاضر ہوں۔"},
    "voice": {"english": "Okay, opening voice ordering.", "urdu": "ٹھیک ہے، آواز سے آرڈر شروع کرتے ہیں۔"},
    "done": {"english": "Thank you for shopping with AssanMart. Have a lovely day!",
             "urdu": "آسان مارٹ سے خریداری کا شکریہ۔ آپ کا دن اچھا گزرے!"},
}
WELCOME_DISPLAY_UR = "آپ انگریزی میں بات کرنا چاہیں گے یا اردو میں؟"
_W_DONE = re.compile(r"\b(done|nothing|no thanks|no thank you|that'?s all|that is all|bye|goodbye|finished|no)\b|بس|نہیں|شکریہ|خدا حافظ|اللہ حافظ|کچھ نہیں|ختم")
_W_BROWSE = re.compile(r"brows|website|myself|manual|click|scroll|search|look around|store|shop|خود|براؤز|براوز|دیکھ|ویب|ایپ|سٹور|اسٹور")
_W_VOICE = re.compile(r"voice|speak|talk|say|order by|\bmic|بول|آواز|اواز|وائس|بات")
_W_YES = re.compile(r"\b(yes|yeah|yep|sure|ok|okay|continue|more|again|another|please)\b|ہاں|جی|ٹھیک|اور|مزید|دوبارہ")


def welcome_intent(stage, text):
    s = text.lower()
    if _W_BROWSE.search(s) and not _W_VOICE.search(s):
        return "browse"
    if _W_VOICE.search(s):
        return "voice"
    if stage == "after_order" and _W_DONE.search(s):
        return "done"
    if _W_YES.search(s) and not _W_DONE.search(s):
        return "voice"
    if _W_DONE.search(s):
        return "done" if stage == "after_order" else "browse"
    return None


@app.post("/welcome/say")
async def welcome_say(payload: dict):
    """What the welcome agent says at a given stage: language | mode | after_order (the language is known after the first)."""
    stage = payload.get("stage") or "language"
    lang = "urdu" if payload.get("lang") == "urdu" else "english"
    cleanup_old_audio()
    if stage == "language":
        txt, vl = WELCOME_SAY["language"]
        return {"text": txt + " " + WELCOME_DISPLAY_UR, "audio_url": tts_url(txt, vl), "lang": "english", "stage": "language"}
    txt = WELCOME_SAY.get(stage, WELCOME_SAY["mode"])[lang]
    return {"text": txt, "audio_url": tts_url(txt, lang), "lang": lang, "stage": stage}


@app.post("/welcome/reply")
async def welcome_reply(audio: UploadFile = File(...), stage: str = Form("language"), lang: str = Form("english")):
    """Listens to the customer's answer at the welcome stage (no cart / order state involved)."""
    ct = (audio.content_type or "audio/webm").split(";")[0]
    ext = "mp4" if "mp4" in ct else "webm"
    path = f"temp_audio/{uuid.uuid4()}.{ext}"
    with open(path, "wb") as f:
        f.write(await audio.read())
    try:
        en_text, en_conf, ur_text, ur_conf = await stt_raw(path, ct, lang, False)
    finally:
        os.remove(path)
    heard = (en_text if lang != "urdu" else ur_text) or en_text or ur_text
    both = f"{en_text} {ur_text}".lower()
    if not both.strip():
        return {"heard": "", "action": None, "stage": stage, "lang": lang}
    if stage == "language":
        wants_en = re.search(r"english|انگلش|انگلیش|انگریزی|angrezi|ingli", both)
        wants_ur = re.search(r"\burdu\b|اردو|اُردو", both)
        chosen = "urdu" if (wants_ur and not wants_en) else "english" if (wants_en and not wants_ur) else None
        if chosen is None:
            if max(en_conf, ur_conf) < 0.4:
                return {"heard": heard, "action": None, "stage": stage, "lang": lang}
            chosen = choose_language(en_text, en_conf, ur_text, ur_conf)
        txt = WELCOME_SAY["mode"][chosen]
        return {"heard": heard, "action": "language", "lang": chosen, "stage": "mode", "text": txt, "audio_url": tts_url(txt, chosen)}
    intent = welcome_intent(stage, both)
    if intent is None:
        txt = WELCOME_SAY["retry"][lang]
        return {"heard": heard, "action": None, "stage": stage, "lang": lang, "text": txt, "audio_url": tts_url(txt, lang)}
    txt = WELCOME_SAY[intent][lang]
    return {"heard": heard, "action": intent, "stage": stage, "lang": lang, "text": txt, "audio_url": tts_url(txt, lang)}


def pair_label(pair, lang="english"):
    fam, pt = pair
    return type_label(fam, pt, lang) if pt else fam_label(fam, lang)


def join_names(names, lang):
    if len(names) <= 1:
        return "".join(names)
    and_ = t(lang, " and ", " اور ")
    sep = t(lang, ", ", "، ")
    return sep.join(names[:-1]) + and_ + names[-1]


def current_question(lang):
    """Asks the pending question of the current item again (used after a language switch or an interruption)."""
    st, fam = current["stage"], current["family"]
    if st == "brand":
        return ask_brand(lang, current["brand_page"])
    if st == "type":
        names = t(lang, ", ", "، ").join(type_label(fam, l, lang) for l in current["types"])
        m = t(lang, f"{current['brand']}: {names}. Which do you need?", f"{current['brand']}: {names}۔ کونسی چاہیے؟")
        return m, m
    if st == "variant":
        return ask_variant(lang, current["variants"], current["page"])
    return select_product(lang, current["product"])


def looks_like_answer(utt):
    """True when the sentence answers the question currently being asked (brand / type / product / quantity)."""
    st, both, fam = current["stage"], utt.both, current["family"]
    if st == "brand":
        return bool(match_brand_rules(both, current["brands"])) or wants_more(both)
    if st == "type":
        low = both.lower()
        return any(l in current["types"] and any((k in low) if k.isascii() else (k in both) for k in kws)
                   for l, _, kws in TYPE_KEYWORDS.get(fam, []))
    if st == "variant":
        shown = current["shown"] or current["variants"]
        return bool(match_variant_rules(both, current["variants"], shown, current["brand"])) or wants_more(both)
    return bool(re.search(r"\d", both.translate(ARABIC_DIGITS))) or packs_from_text(both, current["product"])[0] is not None


def find_unavailable(text):
    """Brands the customer asked for that exist in the dataset but are switched off (no price / out of stock).
    -> [(brand, family)] so the agent can say so instead of silently offering something else."""
    if not _HIDDEN:
        return []
    low = text.lower()
    comp = {re.sub(r"[\s\-'’.]+", "", v) for v in (low, spoken_to_digits(low).lower())}
    out, seen = [], set()
    for h in _HIDDEN:
        b = h["brand"]
        if not b or b == "Generic" or b.lower() in BRAND_FAMS or b in seen:
            continue                                   # other products of this brand ARE on sale -> normal flow
        key = re.sub(r"[\s\-'’.]+", "", b.lower())
        hit = len(key) >= 3 and any(key in c for c in comp)
        if not hit and h["brand_ur"]:
            hit = find_native(text, h["brand_ur"]) >= 0 or re.sub(r"\s+", "", h["brand_ur"]) in re.sub(r"\s+", "", text)
        if hit:
            seen.add(b)
            out.append((b, h["family"]))
    return out



# ---- "I don't want X, I want Y" / words glued together by the speech recogniser ---------------------------

NEG_PATTERNS = [
    # Urdu: "نہیں مجھے سفید لوبیا نہیں چاہیے"
    re.compile(r"(?<!\S)(?:(?:نہیں|نہی|جی نہیں)\s+)?(?:مجھے\s+)?((?:(?!چاہیے|چاہئے|چاہیئے|لینا|نہیں)[^\s،۔,.؟?]+\s+){0,3}?(?!چاہیے|چاہئے|چاہیئے|لینا|نہیں)[^\s،۔,.؟?]+)\s+(?:نہیں|نہی)\s+(?:چاہیے|چاہئے|چاہیئے|لینا|لینی|چاہتا|چاہتی)", re.I),
    # English: "no, I don't want the white beans" / "I do not need white beans"
    re.compile(r"(?:\bno\b[, ]*)?(?:\bi\s+)?\b(?:don'?t|do\s+not|dont|did\s+not|didn'?t)\s+(?:want|need|ask\s+for|order)\s+(?:the\s+|any\s+|that\s+)?(.+?)(?=\s+(?:i|and|but|give|get|add)\b|[,.;]|$)", re.I),
    # Roman Urdu: "mujhe safed lobia nahi chahiye"
    re.compile(r"(?:\bnahi\b[, ]*)?(?:\bmujhe\s+)?\b([a-z' ]*?)\s*\b(?:nahi|nahin|nai)\s+(?:chahiye|chahie|lena|leni)\b", re.I),
]


def strip_negated(utt):
    """Cuts the parts the customer REJECTS out of the sentence ("not the white beans, the red ones") so they are not
    ordered. Returns (cleaned Utterance, [rejected phrases])."""
    dropped = []

    def cut(text):
        for pat in NEG_PATTERNS:
            def sub(m):
                if not m.group(1).strip():
                    return m.group(0)                 # a bare "نہیں چاہیے" is handled elsewhere (skip / not this)
                dropped.append(m.group(1).strip())
                return " "
            text = pat.sub(sub, text)
        return re.sub(r"\s+", " ", text).strip(" ،,.")

    en, ur = cut(utt.en), cut(utt.ur)
    if not dropped:
        return utt, []
    main = ur if (utt.text == utt.ur and utt.ur) else en
    return Utterance(main, utt.lang, en, ur, utt.switched), dropped


def _product_blob(p):
    return " ".join([p["name"], p.get("aliases", ""), p.get("brand_ur", "")]).lower()


def drop_from_cart(phrases):
    """Removes the cart lines the customer just rejected. A line goes when what he named is one of its names / aliases."""
    global order_pending_confirmation
    gone = []
    for ph in phrases:
        ph = ph.lower().strip()
        if len(ph) < 3:
            continue
        for c in list(current_cart):
            p = PRODUCTS.get(c["id"])
            if not p:
                continue
            names = [a.strip().lower() for a in re.split(r"[;,،]", p.get("aliases", "")) if a.strip()] + [p["name"].lower()]
            if any(ph == n or ph in n or (len(n) >= 4 and n in ph) for n in names):
                current_cart.remove(c)
                gone.append(c["name"])
                order_pending_confirmation = False
    return gone


_KNOWN_WORDS = set()


def repair_fused_words(text):
    """Speech-to-text sometimes glues a filler to a product word ("مجلال" = "مجھے لال"). A word that is not known,
    but ENDS with a word of the dataset, is split in two."""
    global _KNOWN_WORDS
    if not _KNOWN_WORDS:
        for p in PRODUCTS.values():
            _KNOWN_WORDS |= {w for w in tokens(_product_blob(p)) if len(w) >= 2}
        _KNOWN_WORDS |= {"مجھے", "مجھ", "میں", "اور", "کو", "کا", "کی", "کے", "چاہیے", "دو", "ایک", "نہیں", "اس", "یہ"}
    out = []
    for w in text.split():
        bare = w.strip("۔،,.؟?!")
        if len(bare) >= 5 and bare not in _KNOWN_WORDS:
            for k in range(2, len(bare) - 2):
                tail = bare[k:]
                if len(tail) >= 3 and tail in _KNOWN_WORDS and all(ord(ch) > 127 for ch in bare):
                    w = bare[:k] + " " + tail
                    break
        out.append(w)
    return " ".join(out)


async def route_utterance(utt: Utterance, history: list, lang: str):
    """Decides what to say. Returns (display_text, speech_text)."""
    global order_pending_confirmation, current, language_chosen
    both = utt.both

    # -1. the agent has just asked "English or Urdu?" -> this is the answer
    if not language_chosen:
        language_chosen = True
        utt.switched = False
        if SWITCH_RE.search(both.lower()) and not detect_for_utt(utt) and max(len(tokens(utt.en)), len(tokens(utt.ur))) <= 6:
            m = t(lang, "Okay, English it is. What groceries do you need?", "جی ٹھیک ہے، اردو میں بات کرتے ہیں۔ آپ کو کیا چاہیے؟")
            return m, m
        # (otherwise the user already started ordering: language was picked from what they spoke, carry on)

    # 0. the user just asked to change language -> confirm in the NEW language and carry on
    if utt.switched and not detect_for_utt(utt):
        msg = t(lang, "Sure, I'll speak English from now on. ", "جی ضرور، اب میں آپ سے اردو میں بات کروں گی۔ ")
        if current is not None:
            d, s_ = current_question(lang)
            return msg + d, msg + s_
        m = msg + t(lang, "What would you like?", "آپ کو کیا چاہیے؟")
        return m, m

    # 0a. the customer asks for a brand that is in the dataset but not for sale right now -> say so honestly
    gone = find_unavailable(both)
    if gone and not order_pending_confirmation:
        names = "، ".join(b for b, _ in gone) if lang == "urdu" else ", ".join(b for b, _ in gone)
        sorry = t(lang, f"Sorry, {names} is not available right now. ", f"معذرت، {names} ابھی دستیاب نہیں ہے۔ ")
        fams = [f for _, f in gone if f in BY_FAMILY]
        if fams and (current is None or current["family"] != fams[0]):
            opts = ", ".join(dict.fromkeys(p["brand"] for p in BY_FAMILY[fams[0]]))
            sorry += t(lang, f"In {fams[0]} we have {opts}. Would you like one of those?",
                       f"{fams[0]} میں {opts} موجود ہیں۔ کیا وہ لے لوں؟")
        elif current is not None:
            d, s_ = current_question(lang)
            return sorry + d, sorry + s_
        return sorry.strip(), sorry.strip()

    # 0b. change the basket by voice (remove an item / change its quantity) — works at any point before checkout
    edited = edit_cart(utt, lang)
    if edited:
        return edited

    # 1. waiting for the final yes/no
    if order_pending_confirmation:
        if has_any(both, CANCEL):
            return cancel_everything(lang)
        if has_any(both, YES | DONE) and not has_any(both, NO):
            return confirm_and_place_order(lang)
        if has_any(both, NO):
            order_pending_confirmation = False
            m = t(lang, "Okay, I haven't confirmed it. What would you like to add or change?",
                  "ٹھیک ہے، ابھی کنفرم نہیں کیا۔ کیا شامل یا تبدیل کرنا ہے؟")
            return m, m

    # 2. in the middle of brand -> pack -> quantity for an item
    if current is not None:
        if has_any(both, CANCEL):
            return cancel_everything(lang)
        stage = current["stage"]
        # a way out, so the agent can never get stuck on one item
        if wants_finish(both):
            return finish_now(lang)
        if wants_skip(both):
            return skip_current(lang)
        utt, rejected = strip_negated(utt)
        if rejected:
            both = utt.both
            drop_from_cart(rejected)
            if not (utt.en.strip() or utt.ur.strip()):
                return current_question(lang)
        # NEW item(s) mentioned while another is being chosen ("...and 2 kilo sugar too") -> remember them, with details.
        # Only the language the user speaks counts here, and a word of the item being chosen is never a "new item".
        cur_pair = (current["family"], current["ptype"])
        main_only = Utterance(utt.text, utt.lang, "" if utt.lang == "urdu" else utt.text, utt.text if utt.lang == "urdu" else "")
        reqs = [r for r in extract_requests(main_only) if r["pair"]
                and not (r["pair"][0] == cur_pair[0] and (r["pair"][1] is None or cur_pair[1] is None or r["pair"][1] == cur_pair[1]))]
        # words that belong to the products being chosen right now ("red kidney beans" while choosing a pulse) are the ANSWER,
        # never a second item ("Carrot Red", "Fresh Beans")
        pool_words = set()
        for p_ in (current.get("all_variants") or current.get("variants") or current.get("pool") or []):
            pool_words |= set(tokens(_product_blob(p_)))
        def _is_answer_words(r):
            ws = [w for w in tokens(r.get("clause") or "") if len(w) >= 3]
            if bool(ws) and sum(w in pool_words for w in ws) >= len(ws) * 0.5:
                return True
            # "Zero SUGAR can" while choosing a cola: the family word is part of the product's name, no amount was said
            fam_ws = [w for w in tokens(r["pair"][0]) if len(w) >= 3]
            return bool(fam_ws) and all(w.rstrip("s") in {x.rstrip("s") for x in pool_words} for w in fam_ws) and not r.get("qty")
        reqs = [r for r in reqs if not _is_answer_words(r)]
        pre = ""
        if reqs:
            rest = residual_utterance(utt, {r["pair"] for r in reqs})
            added = register_requests(reqs)
            if added:
                names = join_names([describe_request(r, lang, by_item=sum(1 for x in added if x["pair"] == r["pair"]) > 1) for r in added], lang)
                pre = t(lang, f"Okay, I'll also get {names} after this. ", f"ٹھیک ہے، اس کے بعد {names} بھی لیں گے۔ ")
            if rest is None or not looks_like_answer(rest):
                d, s_ = current_question(lang)
                return pre + d, pre + s_
            utt = rest                                  # the same sentence also answered the current question
        print(f"🏷️ step: {stage}")
        current.setdefault("said", []).append(utt.both)
        if stage == "brand":
            d, s_ = await handle_brand(utt, lang)
        elif stage == "type":
            d, s_ = await handle_type(utt, lang)
        elif stage == "variant":
            d, s_ = await handle_variant(utt, lang)
        else:
            d, s_ = await handle_quantity(utt, lang)
        return pre + d, pre + s_

    # 3. fresh request — rules first, LLM only if needed
    if has_any(both, CANCEL):
        return cancel_everything(lang)

    neg_pre = ""
    if utt.ur:
        utt = Utterance(repair_fused_words(utt.text) if utt.text == utt.ur else utt.text, utt.lang, utt.en, repair_fused_words(utt.ur), utt.switched)
        both = utt.both
    utt, rejected = strip_negated(utt)
    if rejected:
        both = utt.both
        gone = drop_from_cart(rejected)
        if gone:
            names_ = ", ".join(dict.fromkeys(gone))
            neg_pre = t(lang, f"Okay, removed {names_}. ", f"ٹھیک ہے، {names_} ہٹا دیا۔ ")
        if not (utt.en.strip() or utt.ur.strip()):
            m = neg_pre or t(lang, "Okay, I won't add that. What would you like instead?", "ٹھیک ہے، وہ نہیں لوں گی۔ اس کی جگہ کیا چاہیے؟")
            return m, m

    reqs = extract_requests(utt)
    fams = [r["pair"] for r in reqs if r["pair"]]
    wants_set = any(w in both.lower() for w in SET_WORDS)

    if fams and not wants_set:
        # remember EVERY item of the sentence with the amounts / brands / sizes that came with it
        reqs, missing = await resolve_unknown(reqs, lang)
        added = register_requests(reqs)
        step = start_next(lang)
        pre = neg_pre
        if missing:
            pre += t(lang, f"Sorry, we don't have {', '.join(missing)}. ", f"معذرت، {'، '.join(missing)} دستیاب نہیں۔ ")
        if added and (len(added) > 1 or any(r["qty"] for r in added)):     # say back what was understood, once
            ack = join_names([describe_request(r, lang, by_item=sum(1 for x in added if x["pair"] == r["pair"]) > 1) for r in added], lang)
            pre += t(lang, f"Got it: {ack}. ", f"ٹھیک ہے: {ack}۔ ")
        if step:
            return pre + step[0], pre + step[1]
        d, s_ = build_cart_summary(lang)
        return pre + d, pre + s_

    if not fams and not wants_set and has_any(both, YES | NO | DONE) and len(tokens(both)) <= 6:
        if has_any(both, NO) and not has_any(both, YES | DONE):      # a plain "no" must not place/ask to place the order
            if current_cart:
                m = t(lang, "Okay. Tell me what else you need, or say confirm when you're ready.",
                      "ٹھیک ہے۔ اور کیا چاہیے؟ یا تیار ہوں تو کنفرم کہیں۔")
                return m, m
        elif current_cart:
            return request_confirmation(lang)

    parsed = await _aextract(utt.text, lang, history)
    print(f"🧠 {parsed}")
    intent = parsed.get("intent")

    if intent == "add_items":
        missing = []
        for item in parsed.get("items", []):
            fam, qty = item.get("catalog_name"), item.get("quantity")
            if not fam or fam not in BY_FAMILY:
                missing.append(item.get("mentioned_as") or "?")
                continue
            if item.get("action") == "set" and qty:
                existing = [c for c in current_cart if c["family"] == fam]
                if existing:
                    existing[-1]["quantity"] = float(qty)
                    continue
            pt = next((p_ for f_, p_ in detect_families(item.get("mentioned_as") or "") if f_ == fam and p_), None)
            add_families([(fam, pt)])
        pre = ""
        if missing:
            pre = t(lang, f"Sorry, we don't have {', '.join(missing)}. ", f"معذرت، {'، '.join(missing)} دستیاب نہیں۔ ")
        return compose(pre.strip(), start_next(lang), lang)
    if intent == "confirm_order":
        return confirm_and_place_order(lang) if order_pending_confirmation else request_confirmation(lang)
    if intent == "cancel_order":
        return cancel_everything(lang)
    if intent == "check_cart":
        return build_cart_summary(lang)
    reply = parsed.get("reply_text") or t(lang, "Sorry, could you say that again?", "معذرت، دوبارہ بتائیں؟")
    return reply, reply


@app.post("/converse")
async def converse(request: Request, audio: UploadFile = File(...), history_json: str = Form("[]")):
    t0 = time.time()
    sid, user = await identify(request)
    history = json.loads(history_json)

    ct = (audio.content_type or "audio/webm").split(";")[0]
    ext = "mp4" if "mp4" in ct else "webm"
    input_path = f"temp_audio/{uuid.uuid4()}.{ext}"
    with open(input_path, "wb") as f:
        f.write(await audio.read())
    try:
        cur_lang, chosen = peek_session(sid)           # language of THIS customer (no state switch needed yet)
        raw = await stt_raw(input_path, ct, cur_lang, chosen)
    finally:
        os.remove(input_path)
    t1 = time.time()

    async with use_session(sid, user and user["id"]):   # from here on the module variables are this customer's
        utt = build_utterance(*raw)
        print(f"👂 [{utt.lang}] {utt.text}  ⏱️ STT: {t1 - t0:.2f}s")

        if not utt.text.strip():       # noise / nothing recognised: stay silent, the frontend just keeps listening
            return {"detected_language": utt.lang, "user_text": "", "reply_text": "", "options": ui_options(utt.lang),
                    "cart": cart_snapshot(), "audio_url": None, "history": history}

        lang = utt.lang
        stage_before, family_before = (current["stage"], current["family"]) if current else ("fresh", None)
        display_text, speech_text = await route_utterance(utt, history, lang)
        log_turn(stage_before, family_before, utt, display_text)
        t2 = time.time()
        print(f"🧠 Logic: {t2 - t1:.2f}s | TOTAL before audio: {t2 - t0:.2f}s\n🤖 {display_text}")

        history.append({"role": "user", "content": utt.text})
        history.append({"role": "assistant", "content": display_text})
        return {"detected_language": lang, "user_text": utt.text, "reply_text": display_text,
                "options": ui_options(lang), "cart": cart_snapshot(),
                "audio_url": tts_url(speech_text, lang), "history": history}


@app.get("/audio/{filename}")
async def get_audio(filename: str):
    return FileResponse(f"temp_audio/{os.path.basename(filename)}", media_type="audio/mpeg")


# ============================================================
# ROUTES — React frontend support
# ============================================================

@app.get("/cart")
async def get_cart(request: Request):
    sid, user = await identify(request)
    async with use_session(sid, user and user["id"]):
        stage = current["stage"] if current else None
        fam = current["family"] if current else None
        return {
            **cart_snapshot(),
            "awaiting_brand_for": fam if stage == "brand" else None,
            "awaiting_variant_for": fam if stage in ("type", "variant") else None,
            "awaiting_quantity_for": fam if stage == "quantity" else None,
            "options": ui_options(session_language or "english"),
        }


@app.get("/me")
async def who_am_i(request: Request):
    """Who is logged in (the frontend shows the name / a login button)."""
    sid, user = await identify(request)
    return {"logged_in": bool(user), "user": user, "login_required": REQUIRE_LOGIN, "session": sid}


@app.get("/orders")
async def my_orders(request: Request):
    """Past orders of the logged-in customer (newest first)."""
    sid, user = await identify(request)
    if not user:
        raise HTTPException(status_code=401, detail="login required")
    db = SessionLocal()
    try:
        rows = db.query(Order).filter(Order.user_id == user["id"]).all()
        rows = sorted(rows, key=lambda r: r.id, reverse=True)[:50]
        return {"orders": [{"id": r.id, "total": r.total_price, "subtotal": r.subtotal, "delivery_fee": r.delivery_fee,
                            "status": r.status, "created_at": str(r.created_at), "source": r.source,
                            "payment_method": r.payment_method, "customer_name": r.customer_name, "phone": r.phone,
                            "address": r.address, "city": r.city, "delivery_slot": r.delivery_slot,
                            "items": json.loads(r.items_json or "[]")} for r in rows]}
    finally:
        db.close()


# ============================================================
# STORE CHECKOUT ORDERS + MY ORDERS
# ============================================================
FREE_DELIVERY_FROM = float(os.getenv("FREE_DELIVERY_FROM", "2000"))
DELIVERY_FEE = float(os.getenv("DELIVERY_FEE", "150"))


@app.post("/orders/place")
async def place_web_order(request: Request, payload: dict):
    """The website checkout saves its order here. Prices come from the catalogue, never from the browser."""
    sid, user = await identify(request)
    if ORDER_REQUIRES_LOGIN and not user:
        raise HTTPException(status_code=401, detail="Please sign in to place your order.")
    lines, subtotal = [], 0.0
    for it in (payload.get("items") or [])[:200]:
        try:
            pid, qty = int(it.get("id")), float(it.get("quantity"))
        except (TypeError, ValueError):
            continue
        p = PRODUCTS.get(pid)
        if not p or qty <= 0:
            continue
        qty = min(qty, item_cap(p))
        if qty <= 0:
            continue
        line = p["price"] * qty
        subtotal += line
        lines.append({"id": pid, "name": p["name"], "brand": p["brand"], "quantity": qty, "unit_price": p["price"],
                      "line_total": line, "size": p.get("size"), "image_url": p.get("image_url")})
    if not lines:
        raise HTTPException(status_code=400, detail="no valid items")
    fee = 0.0 if subtotal >= FREE_DELIVERY_FROM else DELIVERY_FEE
    db = SessionLocal()
    try:
        for ln in lines:                                     # stock goes down like it does for voice orders
            p = PRODUCTS[ln["id"]]
            if p["stock"] is not None:
                p["stock"] = max(0, p["stock"] - ln["quantity"])
                row = db.get(Product, p["id"])
                if row:
                    row.stock_quantity = p["stock"]
        order = Order(items_json=json.dumps(lines), total_price=subtotal + fee, status="confirmed",
                      payment_method="Cash on Delivery",                 # the only payment method
                      user_id=user["id"] if user else None, session_id=sid, created_at=datetime.utcnow(), source="web",
                      customer_name=str(payload.get("customer_name") or "")[:120], phone=str(payload.get("phone") or "")[:40],
                      address=str(payload.get("address") or "")[:300], city=str(payload.get("city") or "")[:60],
                      delivery_slot=str(payload.get("delivery_slot") or "")[:60], subtotal=subtotal, delivery_fee=fee)
        db.add(order)
        db.flush()
        oid = order.id
        db.add_all([OrderItem(order_id=oid, product_id=ln["id"], name=ln["name"], brand=ln["brand"], quantity=ln["quantity"],
                              unit_price=ln["unit_price"], line_total=ln["line_total"]) for ln in lines])
        db.commit()
        if user:                                             # remember the delivery details for the next order
            save_profile(user["id"], payload)
        return {"order_id": oid, "subtotal": subtotal, "delivery_fee": fee, "total": subtotal + fee,
                "created_at": str(order.created_at)}
    except Exception as e:
        db.rollback()
        print(f"⚠️ order not saved: {e}")
        raise HTTPException(status_code=500, detail="could not save the order")
    finally:
        db.close()


# ============================================================
# ADMIN: products, stock, orders, customers  (only for a Supabase user whose app_metadata.role = "admin")
# ============================================================
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}   # optional extra admins by email
ADMIN_SETUP_OPEN = os.getenv("ADMIN_SETUP_OPEN", "0") == "1"      # 1 = the admin login page may create more admin accounts
ORDER_STATUSES = ["pending", "confirmed", "packed", "out_for_delivery", "delivered", "cancelled"]
LOW_STOCK = float(os.getenv("LOW_STOCK", "10"))


async def require_admin(request):
    sid, user = await identify(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in as admin.")
    if user.get("role") != "admin" and (user.get("email") or "").lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="This account is not an admin.")
    return user


def reload_catalog():
    """The customer side (store + voice agent) picks up what the admin changed — no restart."""
    build_catalog()
    _POOL_CACHE.clear()
    _PTOK_CACHE.clear()
    for fam in BY_FAMILY:
        FAMILY_ALIASES.setdefault(fam, [fam.lower()])
    print(f"🔄 Catalogue reloaded: {len(PRODUCTS)} products")


def product_row(p):
    return {"id": p.id, "name": p.name, "brand": p.brand, "category": p.category, "subcategory": p.subcategory,
            "package_size": p.package_size, "unit": p.unit, "brand_ur": p.brand_ur, "aliases": p.aliases, "price": p.price,
            "image_url": p.image_url, "stock_quantity": p.stock_quantity, "is_active": 0 if p.is_active == 0 else 1}


_PRODUCT_FIELDS = {"name": str, "brand": str, "category": str, "subcategory": str, "package_size": str, "unit": str,
                   "brand_ur": str, "aliases": str, "price": float, "image_url": str, "stock_quantity": float, "is_active": int}


def apply_product_fields(p, data):
    for k, typ in _PRODUCT_FIELDS.items():
        if k not in data:
            continue
        v = data[k]
        if v is None or (isinstance(v, str) and not v.strip() and typ is not str):
            v = None
        elif typ is float:
            v = float(v)
        elif typ is int:
            v = 1 if str(v).lower() in ("1", "true", "yes") else 0
        else:
            v = str(v).strip()
        setattr(p, k, v)


@app.get("/catalog/products")
async def public_products():
    """Everything on sale (what the admin has switched on) — the store reads its products from here."""
    items = []
    db = SessionLocal()
    try:
        cat = {p.id: (p.category, p.brand_ur) for p in db.query(Product).all()}
    finally:
        db.close()
    for d in PRODUCTS.values():
        c, bur = cat.get(d["id"], (None, None))
        items.append({"id": d["id"], "name": d["name"], "brand": d["brand"], "brand_ur": bur or "", "category": c or d["family"],
                      "family": d["family"], "size": d["size"], "price": d["price"], "stock": d["stock"],
                      "image_url": d["image_url"], "aliases": d["aliases"]})
    return {"products": items}


@app.get("/admin/setup")
async def admin_setup_status():
    """Public: is there already an admin? (the admin login page shows 'Create account' when there is none)"""
    n = 0
    try:
        with engine.begin() as con:
            n = con.execute(sql_text("select count(*) from auth.users where raw_app_meta_data->>'role' = 'admin'")).scalar() or 0
    except Exception as e:
        print(f"ℹ️ admin check failed: {e}")
    return {"exists": n > 0, "open": ADMIN_SETUP_OPEN or n == 0}


@app.post("/admin/setup")
async def admin_setup(request: Request):
    """The person who just signed up in the admin app becomes an admin - allowed only while no admin exists yet
    (or ADMIN_SETUP_OPEN=1 in backend/.env, e.g. while you are setting things up)."""
    sid, user = await identify(request)
    if not user:
        raise HTTPException(status_code=401, detail="Sign-up did not finish. Please try again.")
    try:
        with engine.begin() as con:
            n = con.execute(sql_text("select count(*) from auth.users where raw_app_meta_data->>'role' = 'admin'")).scalar() or 0
            if n > 0 and not ADMIN_SETUP_OPEN:
                raise HTTPException(status_code=403, detail="An admin already exists. Ask them to give you access, or log in.")
            con.execute(sql_text("update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{\"role\":\"admin\"}'::jsonb where id = cast(:i as uuid)"),
                        {"i": user["id"]})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"could not make this account an admin: {e}")
    _TOKEN_CACHE.clear()
    return {"ok": True, "email": user.get("email")}


@app.get("/admin/me")
async def admin_me(request: Request):
    user = await require_admin(request)
    return {"ok": True, "email": user.get("email"), "name": user.get("name")}


@app.get("/admin/products")
async def admin_products(request: Request):
    await require_admin(request)
    db = SessionLocal()
    try:
        return {"products": [product_row(p) for p in db.query(Product).order_by(Product.id).all()]}
    finally:
        db.close()


@app.post("/admin/products")
async def admin_add_product(request: Request, payload: dict):
    await require_admin(request)
    if not str(payload.get("name") or "").strip() or _num(payload.get("price")) is None or not str(payload.get("subcategory") or "").strip():
        raise HTTPException(status_code=400, detail="name, price and subcategory (item family) are required")
    db = SessionLocal()
    try:
        new_id = (db.query(sql_func.max(Product.id)).scalar() or 0) + 1
        p = Product(id=int(payload.get("id") or new_id), is_active=1, brand="Generic")
        apply_product_fields(p, payload)
        p.brand = p.brand or "Generic"
        db.add(p)
        db.commit()
        out = product_row(p)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"could not add: {e}")
    finally:
        db.close()
    reload_catalog()
    return {"product": out}


@app.put("/admin/products/{pid}")
async def admin_update_product(pid: int, request: Request, payload: dict):
    await require_admin(request)
    db = SessionLocal()
    try:
        p = db.get(Product, pid)
        if not p:
            raise HTTPException(status_code=404, detail="product not found")
        apply_product_fields(p, payload)
        db.commit()
        out = product_row(p)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"could not update: {e}")
    finally:
        db.close()
    reload_catalog()
    return {"product": out}


@app.delete("/admin/products/{pid}")
async def admin_delete_product(pid: int, request: Request):
    await require_admin(request)
    db = SessionLocal()
    try:
        p = db.get(Product, pid)
        if not p:
            raise HTTPException(status_code=404, detail="product not found")
        db.delete(p)
        db.commit()
    finally:
        db.close()
    reload_catalog()
    return {"deleted": pid}


@app.post("/admin/reload-catalog")
async def admin_reload(request: Request):
    await require_admin(request)
    reload_catalog()
    return {"products": len(PRODUCTS)}


def order_row(r, with_items=True):
    d = {"id": r.id, "status": r.status, "total": r.total_price, "subtotal": r.subtotal, "delivery_fee": r.delivery_fee,
         "payment_method": r.payment_method, "source": r.source, "user_id": r.user_id, "customer_name": r.customer_name,
         "phone": r.phone, "address": r.address, "city": r.city, "delivery_slot": r.delivery_slot,
         "created_at": r.created_at.isoformat() if r.created_at else None}
    if with_items:
        try:
            d["items"] = json.loads(r.items_json or "[]")
        except Exception:
            d["items"] = []
    return d


@app.get("/admin/orders")
async def admin_orders(request: Request, status: str = "", limit: int = 300):
    await require_admin(request)
    db = SessionLocal()
    try:
        q = db.query(Order)
        if status:
            q = q.filter(Order.status == status)
        rows = q.order_by(Order.id.desc()).limit(max(1, min(limit, 2000))).all()
        return {"orders": [order_row(r) for r in rows], "statuses": ORDER_STATUSES}
    finally:
        db.close()


@app.get("/admin/orders/{oid}")
async def admin_order(oid: int, request: Request):
    await require_admin(request)
    db = SessionLocal()
    try:
        r = db.get(Order, oid)
        if not r:
            raise HTTPException(status_code=404, detail="order not found")
        d = order_row(r)
        d["lines"] = [{"product_id": i.product_id, "name": i.name, "brand": i.brand, "quantity": i.quantity,
                       "unit_price": i.unit_price, "line_total": i.line_total}
                      for i in db.query(OrderItem).filter(OrderItem.order_id == oid).all()]
        return {"order": d}
    finally:
        db.close()


@app.patch("/admin/orders/{oid}/status")
async def admin_order_status(oid: int, request: Request, payload: dict):
    await require_admin(request)
    st = str(payload.get("status") or "").strip().lower()
    if st not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {ORDER_STATUSES}")
    db = SessionLocal()
    try:
        r = db.get(Order, oid)
        if not r:
            raise HTTPException(status_code=404, detail="order not found")
        r.status = st
        db.commit()
        return {"order": order_row(r, with_items=False)}
    finally:
        db.close()


@app.get("/admin/customers")
async def admin_customers(request: Request):
    await require_admin(request)
    db = SessionLocal()
    try:
        profiles = {c.user_id: c for c in db.query(Customer).all()}
        agg = {}
        for o in db.query(Order).all():
            key = o.user_id or f"guest:{o.phone or o.session_id or o.id}"
            a = agg.setdefault(key, {"user_id": o.user_id, "name": o.customer_name, "phone": o.phone, "address": o.address,
                                     "city": o.city, "orders": 0, "spent": 0.0, "last_order": None})
            a["orders"] += 1
            if (o.status or "") != "cancelled":
                a["spent"] += o.total_price or 0
            if o.created_at and (a["last_order"] is None or o.created_at.isoformat() > a["last_order"]):
                a["last_order"] = o.created_at.isoformat()
            a["name"] = a["name"] or o.customer_name
        for uid, c in profiles.items():
            a = agg.setdefault(uid, {"user_id": uid, "orders": 0, "spent": 0.0, "last_order": None})
            a.update({"name": c.name or a.get("name"), "phone": c.phone or a.get("phone"),
                      "address": c.address or a.get("address"), "city": c.city or a.get("city")})
        return {"customers": sorted(agg.values(), key=lambda x: x["last_order"] or "", reverse=True)}
    finally:
        db.close()


@app.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    db = SessionLocal()
    try:
        orders = db.query(Order).all()
        live = [o for o in orders if (o.status or "") != "cancelled"]
        today = datetime.utcnow().date()
        by_day, by_status, top = {}, {}, {}
        for o in orders:
            by_status[o.status or "confirmed"] = by_status.get(o.status or "confirmed", 0) + 1
        for o in live:
            if o.created_at:
                day = o.created_at.date().isoformat()
                d = by_day.setdefault(day, {"date": day, "orders": 0, "revenue": 0.0})
                d["orders"] += 1
                d["revenue"] += o.total_price or 0
        for i in db.query(OrderItem).all():
            t = top.setdefault(i.product_id, {"product_id": i.product_id, "name": i.name, "quantity": 0.0, "revenue": 0.0})
            t["quantity"] += i.quantity or 0
            t["revenue"] += i.line_total or 0
        prods = db.query(Product).all()
        return {"orders": len(orders), "revenue": sum(o.total_price or 0 for o in live),
                "today_orders": sum(1 for o in live if o.created_at and o.created_at.date() == today),
                "pending": by_status.get("pending", 0) + by_status.get("confirmed", 0),
                "customers": len({o.user_id or o.phone or o.session_id for o in orders}),
                "products": len(prods), "inactive": sum(1 for p in prods if p.is_active == 0),
                "low_stock": sum(1 for p in prods if p.stock_quantity is not None and p.stock_quantity <= LOW_STOCK and p.is_active != 0),
                "by_status": by_status, "by_day": sorted(by_day.values(), key=lambda x: x["date"])[-30:],
                "top_products": sorted(top.values(), key=lambda x: -x["quantity"])[:10]}
    finally:
        db.close()


@app.get("/me/profile")
async def get_my_profile(request: Request):
    sid, user = await identify(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return {"profile": load_profile(user["id"]), "email": user.get("email"), "name": user.get("name")}


@app.put("/me/profile")
async def put_my_profile(request: Request, payload: dict):
    sid, user = await identify(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in.")
    save_profile(user["id"], payload)
    return {"profile": load_profile(user["id"])}


# ============================================================
# PHOTO OF A GROCERY LIST -> items
# ============================================================
# Gemini only READS the list (one line per item, exactly as written). It never chooses products. The dataset
# matcher below (the same one the voice agent uses) finds the product, so nothing is added that is not in the
# list and everything uncertain is shown to the customer to choose.

SCAN_PROMPT = """You are reading a photo of a customer's grocery shopping list (English, Urdu, Roman Urdu or a mix; printed or handwritten).
Copy EVERY item line exactly as written. Do not translate, do not correct, do not guess, do not add items.
Skip headings, dates, prices, totals, tick marks, doodles and anything that is not an item.
If a line is crossed out, skip it. If a word is unreadable, leave that word out; if the whole line is unreadable, skip it.
Reply with JSON only: {"lines": [{"text": "item words exactly as written, without the quantity", "english": "the same item named in plain English (translate Urdu / Roman Urdu words, e.g. 'سیب' -> 'apple'), without the quantity", "qty": "quantity words exactly as written, e.g. '2 kg', '3', 'aadha kilo', or null"}]}"""


def _vision_lines_sync(data, mime):
    if gemini_client is None:
        raise RuntimeError("GEMINI_API_KEY is not set")
    cfg = types.GenerateContentConfig(max_output_tokens=3000, response_mime_type="application/json", temperature=0)
    resp = gemini_client.models.generate_content(
        model=GEMINI_MODEL, contents=[types.Part.from_bytes(data=data, mime_type=mime), SCAN_PROMPT], config=cfg)
    out = json.loads(resp.text)
    lines = []
    for ln in (out.get("lines") or [])[:80]:
        text = str(ln.get("text") or "").strip()
        if len(text) >= 2:
            lines.append({"text": text[:120], "english": str(ln.get("english") or "").strip()[:120] or None,
                          "qty": (str(ln.get("qty")).strip()[:40] if ln.get("qty") else None)})
    return lines


def _cand_view(p, qty):
    return {"id": p["id"], "name": p["name"], "brand": p["brand"], "size": p["size"], "price": p["price"],
            "image_url": p.get("image_url"), "quantity": qty}


_BRAND_NORM = {}


def _bnorm(x):
    return re.sub(r"[^a-z0-9\u0600-\u06FF]", "", (x or "").lower())


def brands_in_text(text):
    """Brands named in the text, spelled any way ("Lays" = "Lay's" = "lay s"). -> {normalised brand: families}"""
    if len(_BRAND_NORM) != len(BRAND_FAMS):
        _BRAND_NORM.clear()
        for k_, fams_ in BRAND_FAMS.items():
            n_ = _bnorm(k_)
            if len(n_) >= 3:
                _BRAND_NORM.setdefault(n_, set()).update(fams_)
    words = [_bnorm(w) for w in re.findall(r"[\w']+", (text or "").lower())]
    cands = set(w for w in words if len(w) >= 3) | {a_ + b_ for a_, b_ in zip(words, words[1:]) if a_ and b_}
    return {n_: f_ for n_, f_ in _BRAND_NORM.items() if n_ in cands}


def scan_match(text, qty_text, english=None):
    """One list line -> {"status": matched | choose | unknown, "candidates": [...]}. Call inside use_session()."""
    clause = f"{text} {qty_text or ''}".strip()
    pairs = detect_families(clause)
    # a brand on the line decides the family: "Lays french cheese" is Lay's chips, not cheese
    brands = brands_in_text(text)
    if brands:
        bfams = set().union(*brands.values())
        kept = [(f, pt) for f, pt in pairs if f in bfams]
        pairs = kept or [(f, None) for f in sorted(bfams) if f in BY_FAMILY]
    pool = []
    for fam, pt in pairs:
        pool += [p for p in pool_for(fam, pt) if p not in pool]
    if brands and pool:
        only = [p for p in pool if _bnorm(p["brand"]) in brands]
        pool = only or pool
    if not pool:
        pool = list(PRODUCTS.values())
        scores = rank_products(pool, text) or []
        if not scores or max(scores) < 2.5:                     # nothing in the catalogue resembles this line
            return {"text": text, "english": english or text, "qty_text": qty_text, "status": "unknown", "candidates": []}
        best = max(scores)
        pool = [p for p, sc in zip(pool, scores) if sc >= best * 0.75][:12]
    near = narrow_products(pool, text)
    want = size_pairs(clause)
    if want:
        sized = [p for p in near if same_size(want, size_pairs(p["name"] + " " + p["size"]))]
        near = sized or near

    def qty_for(p):
        q, _ = packs_from_text(clause, p)
        if q is None and not want:
            q = parse_quantity_rules(qty_text or text)
        return q if q and 0 < q <= 100 else 1

    near = sorted(near, key=lambda p: (p["brand"], p["price"]))[:8]
    cands = [_cand_view(p, qty_for(p)) for p in near]
    status = "matched" if len(near) == 1 else ("choose" if near else "unknown")
    taken = {p["id"] for p in near}                                  # the rest of the same kind of item ("more options")
    more = [_cand_view(p, qty_for(p)) for p in sorted(pool, key=lambda p: (p["brand"], p["price"])) if p["id"] not in taken][:16]
    return {"text": text, "english": english or text, "qty_text": qty_text, "status": status, "candidates": cands,
            "more": more if near else []}


@app.post("/scan-list")
async def scan_list(request: Request, image: UploadFile = File(...)):
    sid, user = await identify(request)
    data = await image.read()
    if not data or len(data) > 8_000_000:
        raise HTTPException(status_code=413, detail="image missing or larger than 8 MB")
    mime = image.content_type if (image.content_type or "").startswith("image/") else "image/jpeg"
    try:
        lines = await asyncio.wait_for(asyncio.to_thread(_vision_lines_sync, data, mime), 40)
    except Exception as e:
        print(f"⚠️ scan failed: {e!r}")
        raise HTTPException(status_code=502, detail="could not read the picture, please try a clearer photo")
    key = f"scan:{uuid.uuid4().hex}"
    async with use_session(key, None):                       # a clean, throw-away conversation state
        results = [scan_match(l["text"], l["qty"], l.get("english")) for l in lines]
    SESSIONS.pop(key, None)
    print(f"🧾 scanned list: {len(lines)} lines, {sum(r['status'] == 'matched' for r in results)} matched")
    return {"lines": results}



@app.get("/health")
async def health():
    return {"ok": True, "products": len(PRODUCTS), "sessions_in_memory": len(SESSIONS), "redis": _redis is not None,
            "database": "sqlite" if DATABASE_URL.startswith("sqlite") else "postgres", "login": bool(SUPABASE_URL and SUPABASE_ANON_KEY)}


@app.get("/catalog/{family}")
async def get_catalog(family: str):
    return {"family": family, "brands": BRANDS.get(family, []), "products": BY_FAMILY.get(family, [])}


@app.post("/select")
async def select_option(payload: dict, request: Request):
    sid, user = await identify(request)
    async with use_session(sid, user and user["id"]):
        return await _select_option(payload)


async def _select_option(payload: dict):
    """User TAPPED something in the pop-up.
    value = brand name | type label | 'pid:<id>' | 'next';  qty (optional) = number of packs -> goes straight to cart.
    At the quantity step send only {"qty": n}."""
    value = (payload.get("value") or "").strip()
    qty = _num(payload.get("qty"))
    qty = qty if qty and 0 < qty <= 100 else None
    lang = session_language or "english"
    d = s_ = None
    if current is not None:
        st = current["stage"]
        if st == "brand" and value in current["brands"]:
            d, s_ = after_brand(lang, value)
        elif st == "type" and value in current["types"]:
            d, s_ = apply_type(lang, value)
        elif st in ("variant", "quantity") and value.startswith("pid:") and value[4:].isdigit() and int(value[4:]) in PRODUCTS:
            d, s_ = select_product(lang, PRODUCTS[int(value[4:])])
            if qty and current is not None and current["stage"] == "quantity":
                d, s_ = add_selected_to_cart(lang, qty)
        elif st == "quantity" and not value and qty:
            d, s_ = add_selected_to_cart(lang, qty)
    if d is None:
        d, s_ = await route_utterance(Utterance(value, lang, value, ""), [], lang)
    return {"reply_text": d, "options": ui_options(lang), "cart": cart_snapshot(), "audio_url": tts_url(s_, lang)}


@app.post("/action")
async def button_action(payload: dict, request: Request):
    sid, user = await identify(request)
    async with use_session(sid, user and user["id"]):
        return await _button_action(payload)


async def _button_action(payload: dict):
    global order_pending_confirmation
    action = payload.get("action")
    lang = session_language or "english"
    if action == "confirm":
        display_text, speech_text = confirm_and_place_order(lang) if order_pending_confirmation else request_confirmation(lang)
    elif action == "decline":
        order_pending_confirmation = False
        display_text = speech_text = t(lang, "Okay, I haven't placed it. What would you like to change?",
                                       "ٹھیک ہے، ابھی آرڈر نہیں کیا۔ کیا تبدیل کرنا ہے؟")
    elif action == "cancel":
        display_text, speech_text = cancel_everything(lang)
    else:
        return {"error": "unknown action"}
    return {"reply_text": display_text, "options": ui_options(lang), "cart": cart_snapshot(),
            "audio_url": tts_url(speech_text, lang)}


@app.post("/cart/update")
async def cart_update(payload: dict, request: Request):
    sid, user = await identify(request)
    async with use_session(sid, user and user["id"]):
        return _cart_update(payload)


def _cart_update(payload: dict):
    """Basket +/- and remove buttons. qty <= 0 removes the line."""
    global order_pending_confirmation
    pid = _num(payload.get("id"))
    qty = _num(payload.get("qty"))
    for c in list(current_cart):
        if pid is not None and c["id"] == int(pid):
            if qty is None or qty <= 0:
                current_cart.remove(c)
            else:
                c["quantity"] = min(qty, item_cap(PRODUCTS.get(c["id"]) or c))
            order_pending_confirmation = False
            break
    return cart_snapshot()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)