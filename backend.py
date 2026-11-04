from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from google import genai
from google.genai import types
from sqlalchemy import create_engine, Column, String, Float, Integer
from sqlalchemy.orm import declarative_base, sessionmaker
import requests, os, uuid, json, asyncio, time, re, difflib, math
import pandas as pd
from dataclasses import dataclass
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

DATABASE_URL = "sqlite:///./asanmart.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
    price = Column(Float)               # price of ONE pack/unit as listed
    image_url = Column(String, nullable=True)
    stock_quantity = Column(Float, nullable=True)   # empty in CSV -> treated as "in stock"


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    items_json = Column(String)
    total_price = Column(Float)
    payment_method = Column(String, default="COD")
    status = Column(String, default="confirmed")


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


def load_csv_into_db():
    base = os.path.dirname(os.path.abspath(__file__))
    path = CSV_PATH if os.path.exists(CSV_PATH) else os.path.join(base, CSV_PATH)
    if not os.path.exists(path):
        print(f"⚠️ Dataset not found at {CSV_PATH} — put the file there or set CSV_PATH")
        return

    try:
        if path.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(path)
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

    Product.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)

    rows, used_ids = [], set()
    for i, r in df.iterrows():
        price = _num(r.get("price"))
        subcategory = _clean(r.get("subcategory"))
        if price is None or not subcategory:
            continue
        pid = _num(r.get("id"))
        pid = int(pid) if pid is not None else i + 1
        if pid in used_ids:
            continue
        used_ids.add(pid)
        rows.append(Product(
            id=pid,
            name=_clean(r.get("name")),
            brand=_clean(r.get("brand")) or "Generic",
            category=_clean(r.get("category")),
            subcategory=subcategory,
            package_size=_clean(r.get("package_size")) or None,
            unit=_clean(r.get("unit")) or None,
            price=price,
            image_url=(_clean(r.get("image_url")) or _clean(r.get("image")) or _clean(r.get("picture")) or None),
            stock_quantity=_num(r.get("stock_quantity")),
        ))

    db = SessionLocal()
    db.add_all(rows)
    db.commit()
    db.close()
    print(f"✅ Loaded {len(rows)} products from {path}")


Base.metadata.create_all(bind=engine)
load_csv_into_db()

# In-memory catalog (no DB query per turn -> faster)
PRODUCTS = {}       # id -> dict
BY_FAMILY = {}      # family -> [dict]
BRANDS = {}         # family -> [brand, ...] sorted by number of products desc


def build_catalog():
    PRODUCTS.clear(); BY_FAMILY.clear(); BRANDS.clear()
    db = SessionLocal()
    for p in db.query(Product).all():
        d = {"id": p.id, "name": p.name, "brand": p.brand, "family": p.subcategory,
             "size": p.package_size or p.unit or "pack", "price": float(int(p.price + 0.5)), "image_url": p.image_url, "stock": p.stock_quantity}
        PRODUCTS[p.id] = d
        BY_FAMILY.setdefault(p.subcategory, []).append(d)
    db.close()
    for fam, items in BY_FAMILY.items():
        counts = {}
        for it in items:
            counts[it["brand"]] = counts.get(it["brand"], 0) + 1
        BRANDS[fam] = sorted(counts, key=lambda b: (-counts[b], b.lower()))


build_catalog()

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ============================================================
# ALIASES — how people actually say each item family
# ============================================================

FAMILY_ALIASES = {
    "Flour": ["atta", "aata", "flour", "maida", "besan", "آٹا", "آٹے", "میدہ", "بیسن"],
    "Sugar": ["sugar", "cheeni", "chini", "چینی"],
    "Pulses": ["daal", "dal", "dals", "lentil", "lentils", "pulses", "chana", "masoor", "moong", "mash", "lobia",
               "دال", "چنا", "مسور", "مونگ", "ماش", "لوبیا"],
    "Salt": ["salt", "namak", "نمک"],
    "Oil & Ghee": ["cooking oil", "oil", "tel", "تیل", "آئل", "آیل"],
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

FAMILY_UR = {
    "Flour": "آٹا", "Sugar": "چینی", "Pulses": "دال", "Salt": "نمک", "Oil & Ghee": "تیل", "Olive Oil": "زیتون کا تیل",
    "Ghee": "گھی", "Eggs": "انڈے", "Breads, Buns & Rolls": "ڈبل روٹی", "Butter & Margarine": "مکھن",
    "Spreads & Honey": "شہد اور سپریڈ", "Instant Oats": "اوٹس", "Fresh Chicken": "تازہ چکن",
    "Frozen Chicken": "فروزن چکن", "Fresh Beef": "بیف", "Fresh Mutton": "مٹن", "Oral Care": "ٹوتھ پیسٹ اور برش",
    "Bath & Body": "صابن اور باڈی واش", "Shampoo & Conditioner": "شیمپو", "Tissues": "ٹشو",
}

for _fam in BY_FAMILY:
    if _fam not in FAMILY_ALIASES:
        print(f"ℹ️ No spoken aliases for '{_fam}' — add it to FAMILY_ALIASES")


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
    "Flour": {"atta": "atta", "aata": "atta", "آٹا": "atta", "آٹے": "atta", "maida": "maida", "میدہ": "maida",
              "besan": "besan", "بیسن": "besan"},
    "Spreads & Honey": {"honey": "honey", "shahad": "honey", "شہد": "honey", "ہنی": "honey", "jam": "jam", "جیم": "jam",
                        "peanut butter": "peanut butter", "nutella": "chocolate spread",
                        "cheese spread": "cheese", "cream cheese": "cheese", "topping": "toppings", "toppings": "toppings"},
    "Breads, Buns & Rolls": {"bread": "bread", "بریڈ": "bread", "double roti": "bread", "ڈبل روٹی": "bread",
                             "bun": "buns", "buns": "buns", "rolls": "rolls", "rusk": "rusk",
                             "tortilla": "wraps", "wrap": "wraps", "wraps": "wraps"},
}


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
                at = text.find(a)
            if at < 0:
                continue
            key = (fam, amap.get(a))
            pos[key] = min(at, pos.get(key, at))
        # a typed mention ("toothbrush") makes the generic family mention redundant
        if any(k[0] == fam and k[1] for k in pos):
            pos.pop((fam, None), None)
    found = [k for k, _ in sorted(pos.items(), key=lambda kv: kv[1])]
    present = {f for f, _ in found}
    for specific, general in SPECIFIC_OVER.items():
        if specific in present and general in present:
            found = [(f, pt) for f, pt in found if f != general]
    if "peanut butter" in low and low.count("butter") == low.count("peanut butter"):
        found = [(f, pt) for f, pt in found if f != "Butter & Margarine"]
    return found


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
        if ptype:
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
session_language = None


def reset_session_state():
    global current_cart, queue, current, order_pending_confirmation, session_language
    current_cart, queue, current = [], [], None
    order_pending_confirmation = False
    session_language = None


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
CHEAP = ["sasta", "sasti", "cheap", "cheapest", "kam qeemat", "سستا", "سستی"]
EXPENSIVE = ["mehenga", "mehngi", "premium", "expensive", "best", "acha", "مہنگا", "مہنگی", "اچھا"]


def tokens(text):
    return re.findall(r"[\w']+", text.lower().translate(ARABIC_DIGITS), flags=re.UNICODE)


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
    cfg = types.GenerateContentConfig(max_output_tokens=max_tokens, system_instruction=system,
                                      response_mime_type="application/json" if json_mode else None)
    contents = (history or []) + [types.Content(role="user", parts=[types.Part(text=prompt)])]
    return gemini_client.models.generate_content(model=GEMINI_MODEL, contents=contents, config=cfg).text.strip()


async def llm_pick(user_text: str, options: list, what: str):
    """Returns the index of the option the user meant, or None."""
    listing = "\n".join(f"{i + 1}. {o}" for i, o in enumerate(options))
    prompt = (f'The user was asked to choose {what} from:\n{listing}\nUser said (may be Urdu script / Roman Urdu / English): '
              f'"{user_text}"\nReply with ONLY the number of the best match, or NONE if unclear.')
    try:
        out = await asyncio.to_thread(_gemini_sync, prompt, 8)
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
        out = await asyncio.to_thread(_gemini_sync, prompt, 8)
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
        brands = brands_in(pool)
        current = {"family": fam, "ptype": ptype, "pool": pool, "brands": brands, "stage": "brand", "brand": None,
                   "variants": [], "product": None, "page": 0, "brand_page": 0, "types": [], "shown": []}
        if len(brands) == 1:
            return after_brand(lang, brands[0])
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


def match_brand_rules(text: str, brands: list):
    low = text.lower()
    for b in sorted(brands, key=len, reverse=True):
        if b.lower() in low:
            return b
    words = re.findall(r"[a-z0-9]+", low)
    for b in brands:
        for tok in b.lower().split():
            if len(tok) >= 4 and tok in words:
                return b
    lowmap = {b.lower(): b for b in brands}
    for w in words:
        if len(w) < 4:
            continue
        m = difflib.get_close_matches(w, list(lowmap), n=1, cutoff=0.78)
        if m:
            return lowmap[m[0]]
    prices = {b: min(p["price"] for p in current["pool"] if p["brand"] == b) for b in brands}
    if has_any(text, CHEAP):
        return min(prices, key=prices.get)
    if has_any(text, EXPENSIVE):
        return max(prices, key=prices.get)
    return None


async def handle_brand(utt, lang):
    brands = current["brands"]
    brand = match_brand_rules(utt.both, brands)
    if not brand and has_any(utt.both, MORE):
        return ask_brand(lang, current["brand_page"] + 1)
    if not brand:
        i = await llm_pick(utt.both, brands, f"a brand of {current['ptype'] or current['family']}")
        brand = brands[i] if i is not None else None
    if not brand:
        d, s_ = ask_brand(lang, current["brand_page"])
        pre = t(lang, "Sorry, I didn't catch the brand. ", "معذرت، برانڈ سمجھ نہیں آیا۔ ")
        return pre + d, pre + s_
    d, s_ = after_brand(lang, brand)
    pre = t(lang, f"{brand}. ", f"{brand}۔ ")
    return pre + d, pre + s_


def after_brand(lang, brand):
    current["brand"] = brand
    fam = current["family"]
    variants = sorted([p for p in current["pool"] if p["brand"] == brand], key=lambda p: p["price"])
    current["variants"] = variants
    if len(variants) == 1:
        return select_product(lang, variants[0])
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
        out.update(title=current["product"]["name"], product=item_view(current["product"], lang, True))
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
            "pending": pending, "awaiting_confirmation": order_pending_confirmation}


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
    lines = t(lang, "; ", "؛ ").join(f"{short_name(p)} — {money(p['price'], lang)}" for p in chunk)
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


UNIT_CANON = {"kg": "kg", "kilo": "kg", "kilogram": "kg", "kgs": "kg", "کلو": "kg",
              "g": "g", "gm": "g", "gram": "g", "grams": "g", "گرام": "g",
              "l": "l", "ltr": "l", "litre": "l", "liter": "l", "lit": "l", "لیٹر": "l",
              "ml": "ml", "pieces": "pc", "piece": "pc", "pcs": "pc", "pack": "pc"}

STOP = {"the", "one", "want", "need", "please", "with", "and", "give", "for", "wala", "wali", "dena", "chahiye",
        "karo", "hai", "next", "more", "aur", "bhi", "any", "koi", "yes", "okay"}


def size_pairs(text):
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
    want = size_pairs(text)
    if want:
        hits = [v for v in variants if want & size_pairs(v["name"] + " " + v["size"])]
        if hits:
            return hits
    for words_, idx in ORDINALS:
        if has_any(text, words_) and idx < len(shown):
            return [shown[idx]]
    n = parse_quantity_rules(text)      # bare "5" / "two" -> the pack whose size is 5 / 2
    if n:
        hits = [v for v in variants if n in {p[0] for p in size_pairs(v["name"] + " " + v["size"])}]
        if hits:
            return hits
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


async def handle_variant(utt, lang):
    variants, shown = current["variants"], current["shown"] or current["variants"]
    hits = match_variant_rules(utt.both, variants, shown, current["brand"])
    if len(hits) == 1:
        return select_product(lang, hits[0])
    if len(hits) > 1:
        return ask_variant(lang, hits)
    if has_any(utt.both, MORE):
        return ask_variant(lang, variants, current["page"] + 1)
    i = await llm_pick(utt.both, [short_name(v) for v in variants[:30]], "a product")
    if i is not None:
        return select_product(lang, variants[i])
    d, s_ = ask_variant(lang, variants, current["page"])
    pre = t(lang, "Sorry, I didn't catch which one. ", "معذرت، سمجھ نہیں آیا۔ ")
    return pre + d, pre + s_


def select_product(lang, p):
    current["product"] = p
    current["stage"] = "quantity"
    text = t(lang, f"{p['name']} is {money(p['price'], lang)} each. How many would you like?",
             f"{p['name']} کی قیمت {money(p['price'], lang)} ہے۔ کتنے چاہیے؟")
    return text, text


# ---- quantity -------------------------------------------------------------

BASE_UNITS = {"kg": ("mass", 1000), "g": ("mass", 1), "l": ("vol", 1000), "ml": ("vol", 1)}


def numwords_to_digits(text):
    out = []
    for w in text.split():
        v = NUM_WORDS.get(w.lower())
        out.append((str(int(v)) if float(v).is_integer() else str(v)) if v is not None else w)
    return " ".join(out)


def base_amount(pairs):
    for n, u in sorted(pairs):
        if u in BASE_UNITS:
            dim, mult = BASE_UNITS[u]
            return dim, n * mult
    return None


def packs_from_text(text, product):
    """'3 kg' of a 1 kg pack -> 3 packs; '10 kg' of a 5 kg pack -> 2; '2 kg' of a 5 kg pack -> 1 (rounded up).
    Returns (packs, was_rounded) or (None, False) if the user didn't give an amount with a unit."""
    up = base_amount(size_pairs(numwords_to_digits(text)))
    pp = base_amount(size_pairs(product["name"] + " " + product["size"]))
    if not up or not pp or up[0] != pp[0] or pp[1] <= 0:
        return None, False
    ratio = up[1] / pp[1]
    qty = float(max(1, math.ceil(ratio - 1e-9)))
    return qty, abs(ratio - qty) > 1e-6


def add_selected_to_cart(lang, qty, rounded=False):
    """Puts current['product'] x qty into the cart, moves on to the next queued item."""
    global current
    p = current["product"]
    existing = next((c for c in current_cart if c["id"] == p["id"]), None)
    if existing:
        existing["quantity"] += qty
    else:
        current_cart.append({"id": p["id"], "name": p["name"], "brand": p["brand"], "family": p["family"],
                             "quantity": qty, "unit_price": p["price"], "size": p["size"]})
    unit, line = money(p["price"], lang), money(p["price"] * qty, lang)
    confirm = t(lang, f"Added {fmt_qty(qty)} × {p['name']} at {unit} each — {line}.",
                f"{fmt_qty(qty)} × {p['name']} شامل کر دیا، {unit} فی عدد — کل {line}۔")
    if rounded:
        confirm += t(lang, f" It comes in {p['size']} packs, so I rounded up.", f" یہ {p['size']} کے پیک میں ملتا ہے، اس لیے اوپر round کیا۔")
    current = None
    return compose(confirm, start_next(lang), lang)


async def handle_quantity(utt, lang):
    p = current["product"]
    qty, rounded = packs_from_text(utt.both, p)
    if qty is None:
        qty = parse_quantity_rules(utt.both)
    if qty is None:
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


def request_confirmation(lang):
    global order_pending_confirmation
    if not current_cart:
        m = t(lang, "Your cart is empty.", "ٹوکری خالی ہے۔")
        return m, m
    order_pending_confirmation = True
    m = t(lang, f"Your total is {money(cart_total(), lang)}. Shall I confirm the order?",
          f"کل رقم {money(cart_total(), lang)} بنتی ہے۔ کیا آرڈر کنفرم کر دوں؟")
    return m, m


def confirm_and_place_order(lang):
    global current_cart, order_pending_confirmation
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
        db.add(Order(items_json=json.dumps(confirmed), total_price=total, status="confirmed"))
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
    return display, speech


def cancel_everything(lang):
    global current, order_pending_confirmation
    current_cart.clear(); queue.clear()
    current = None
    order_pending_confirmation = False
    m = t(lang, "Okay, order cancelled.", "ٹھیک ہے، آرڈر منسوخ کر دیا گیا۔")
    return m, m


def add_families(pairs):
    for pair in pairs:
        fam, pt = pair
        if pair in queue or (current and current["family"] == fam and current["ptype"] == pt):
            continue
        queue.append(pair)


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
        out = _gemini_sync(f"[Language: {language}] {user_text}", 200, system=SYSTEM_PROMPT, json_mode=True, history=hist)
        return json.loads(out)
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


def choose_language(en_text, en_conf, ur_text, ur_conf):
    """The conversation language NEVER changes by itself. It changes only when the user asks, e.g.
    'can you talk to me in Urdu?' / 'کیا آپ مجھ سے اردو میں بات کر سکتی ہیں' / 'can we speak English?'.
    Everything else keeps the current language (English at the start)."""
    both = f"{en_text} {ur_text}".lower()
    wants_en = re.search(r"english|انگلش|انگلیش|انگریزی|angrezi|ingli", both)
    wants_ur = re.search(r"\burdu\b|اردو|اُردو", both)
    cur = session_language or "english"
    if wants_ur and not wants_en:
        return "urdu"
    if wants_en and not wants_ur:
        return "english"
    return cur


SWITCH_RE = re.compile(r"urdu|english|اردو|انگلش|انگریزی|angrezi")


async def transcribe_with_deepgram(audio_path: str, content_type: str = "audio/webm") -> Utterance:
    """English + Urdu are transcribed in parallel. If the call for the CURRENT session language comes back first
    and is confident, we don't wait for the other one (saves the slower call's time on most turns)."""
    global session_language
    with open(audio_path, "rb") as f:
        audio_data = f.read()
    cur = session_language or "english"
    t_en = asyncio.create_task(asyncio.to_thread(_deepgram_call, audio_data, "en", content_type))
    t_ur = asyncio.create_task(asyncio.to_thread(_deepgram_call, audio_data, "ur", content_type))
    first, other = (t_en, t_ur) if cur == "english" else (t_ur, t_en)
    fn, on = ("en", "ur") if first is t_en else ("ur", "en")
    # Urdu sessions need both transcripts while choosing brands/products (English brand names), so no shortcut there
    fast_ok = cur == "english" or current is None or current["stage"] == "quantity"

    results = {}
    if fast_ok:
        text, conf = await first
        results[fn] = (text, conf)
        if conf >= 0.85 and text.strip() and not SWITCH_RE.search(text.lower()):
            other.cancel()
        else:
            results[on] = await other
    else:
        results["en"], results["ur"] = await asyncio.gather(t_en, t_ur)
    en_text, en_conf = results.get("en", ("", 0.0))
    ur_text, ur_conf = results.get("ur", ("", 0.0))

    print(f"🇬🇧 EN ({en_conf:.2f}): {en_text}\n🇵🇰 UR ({ur_conf:.2f}): {ur_text}")
    if not en_text.strip() and not ur_text.strip():
        return Utterance("", session_language or "english", "", "")
    prev = session_language or "english"
    lang = choose_language(en_text, en_conf, ur_text, ur_conf)
    session_language = lang
    main = ur_text if lang == "urdu" else en_text
    if not main.strip():           # e.g. Urdu words spoken in an English session: still understand them (reply stays English)
        main = en_text or ur_text
    return Utterance(main, lang, en_text, ur_text, switched=(lang != prev))


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


def tts_url(text: str, lang: str) -> str:
    """Returns immediately; the audio is generated (English: streamed) when the browser requests the URL.
    This way the text/pop-up appears right away instead of waiting for the speech to be synthesised."""
    tid = uuid.uuid4().hex
    TTS_JOBS[tid] = {"text": text, "lang": lang, "ts": time.time()}
    while len(TTS_JOBS) > 300:
        TTS_JOBS.pop(next(iter(TTS_JOBS)))
    return f"/tts/{tid}"


def _cache_put(key, data: bytes):
    TTS_CACHE[key] = data
    while len(TTS_CACHE) > 300:
        TTS_CACHE.pop(next(iter(TTS_CACHE)))


async def _urdu_tts_bytes(text: str):
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
    return None


@app.get("/tts/{tid}")
async def tts_stream(tid: str):
    job = TTS_JOBS.get(tid)
    if not job:
        return Response(status_code=404)
    key = (job["lang"], job["text"])
    if key in TTS_CACHE:
        return Response(TTS_CACHE[key], media_type="audio/mpeg")
    if job["lang"] == "urdu":
        data = await _urdu_tts_bytes(job["text"])
        if not data:
            return Response(status_code=502)
        _cache_put(key, data)
        return Response(data, media_type="audio/mpeg")

    async def gen():
        buf = bytearray()
        try:
            async for chunk in edge_tts.Communicate(job["text"], "en-US-AriaNeural").stream():
                if chunk["type"] == "audio":
                    buf.extend(chunk["data"])
                    yield chunk["data"]      # playback starts after the first chunk
        except Exception as e:
            print(f"⚠️ edge-tts stream failed: {e}")
            return
        if buf:
            _cache_put(key, bytes(buf))
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
async def greet():
    reset_session_state()
    cleanup_old_audio()
    greeting = "Assalam-o-Alaikum! I'm AssanMart. Tell me what groceries you need."
    return {"reply_text": greeting, "audio_url": tts_url(greeting, "english"), "options": None,
            "cart": cart_snapshot(), "history": [{"role": "assistant", "content": greeting}]}


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
        return bool(match_brand_rules(both, current["brands"])) or has_any(both, MORE)
    if st == "type":
        low = both.lower()
        return any(l in current["types"] and any((k in low) if k.isascii() else (k in both) for k in kws)
                   for l, _, kws in TYPE_KEYWORDS.get(fam, []))
    if st == "variant":
        shown = current["shown"] or current["variants"]
        return bool(match_variant_rules(both, current["variants"], shown, current["brand"])) or has_any(both, MORE)
    return bool(re.search(r"\d", both.translate(ARABIC_DIGITS))) or packs_from_text(both, current["product"])[0] is not None


async def route_utterance(utt: Utterance, history: list, lang: str):
    """Decides what to say. Returns (display_text, speech_text)."""
    global order_pending_confirmation, current
    both = utt.both

    # 0. the user just asked to change language -> confirm in the NEW language and carry on
    if utt.switched and not detect_for_utt(utt):
        msg = t(lang, "Sure, I'll speak English from now on. ", "جی ضرور، اب میں آپ سے اردو میں بات کروں گی۔ ")
        if current is not None:
            d, s_ = current_question(lang)
            return msg + d, msg + s_
        m = msg + t(lang, "What would you like?", "آپ کو کیا چاہیے؟")
        return m, m

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
        # a NEW item mentioned while another is being chosen ("...and honey too") -> remember it for later
        cur_pair = (current["family"], current["ptype"])
        new_fams = [pr for pr in detect_for_utt(utt)
                    if pr != cur_pair and not (pr[0] == cur_pair[0] and pr[1] is None)]
        if new_fams and not looks_like_answer(utt):
            add_families(new_fams)
            names = join_names([pair_label(pr, lang) for pr in new_fams], lang)
            pre = t(lang, f"Okay, I'll also get {names} after this. ", f"ٹھیک ہے، اس کے بعد {names} بھی لیں گے۔ ")
            d, s_ = current_question(lang)
            return pre + d, pre + s_
        print(f"🏷️ step: {stage}")
        if stage == "brand":
            return await handle_brand(utt, lang)
        if stage == "type":
            return await handle_type(utt, lang)
        if stage == "variant":
            return await handle_variant(utt, lang)
        return await handle_quantity(utt, lang)

    # 3. fresh request — rules first, LLM only if needed
    if has_any(both, CANCEL):
        return cancel_everything(lang)

    fams = detect_for_utt(utt)
    wants_set = any(w in both.lower() for w in SET_WORDS)

    if fams and not wants_set:
        add_families(fams)
        names = [pair_label(pr, lang) for pr in fams]
        step = start_next(lang)
        if step and len(fams) > 1:    # several items in one sentence: say them back, then take them one by one
            pre = t(lang, f"Got it: {join_names(names, lang)}. Let's start with {names[0]}. ",
                    f"ٹھیک ہے: {join_names(names, lang)}۔ پہلے {names[0]} دیکھتے ہیں۔ ")
            return pre + step[0], pre + step[1]
        return step or build_cart_summary(lang)

    if not fams and not wants_set and has_any(both, YES | NO | DONE) and len(tokens(both)) <= 6:
        if current_cart:
            return request_confirmation(lang)

    parsed = await asyncio.to_thread(understand_and_extract, utt.text, lang, history)
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
async def converse(audio: UploadFile = File(...), history_json: str = Form("[]")):
    t0 = time.time()
    history = json.loads(history_json)

    ct = (audio.content_type or "audio/webm").split(";")[0]
    ext = "mp4" if "mp4" in ct else "webm"
    input_path = f"temp_audio/{uuid.uuid4()}.{ext}"
    with open(input_path, "wb") as f:
        f.write(await audio.read())
    try:
        utt = await transcribe_with_deepgram(input_path, ct)
    finally:
        os.remove(input_path)
    t1 = time.time()
    print(f"👂 [{utt.lang}] {utt.text}  ⏱️ STT: {t1 - t0:.2f}s")

    if not utt.text.strip():       # noise / nothing recognised: stay silent, the frontend just keeps listening
        return {"detected_language": utt.lang, "user_text": "", "reply_text": "", "options": ui_options(utt.lang),
                "cart": cart_snapshot(), "audio_url": None, "history": history}

    lang = utt.lang
    display_text, speech_text = await route_utterance(utt, history, lang)
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
async def get_cart():
    stage = current["stage"] if current else None
    fam = current["family"] if current else None
    return {
        **cart_snapshot(),
        "awaiting_brand_for": fam if stage == "brand" else None,
        "awaiting_variant_for": fam if stage in ("type", "variant") else None,
        "awaiting_quantity_for": fam if stage == "quantity" else None,
        "options": ui_options(session_language or "english"),
    }


@app.get("/catalog/{family}")
async def get_catalog(family: str):
    return {"family": family, "brands": BRANDS.get(family, []), "products": BY_FAMILY.get(family, [])}


@app.post("/select")
async def select_option(payload: dict):
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
            if qty:
                d, s_ = add_selected_to_cart(lang, qty)
        elif st == "quantity" and not value and qty:
            d, s_ = add_selected_to_cart(lang, qty)
    if d is None:
        d, s_ = await route_utterance(Utterance(value, lang, value, ""), [], lang)
    return {"reply_text": d, "options": ui_options(lang), "cart": cart_snapshot(), "audio_url": tts_url(s_, lang)}


@app.post("/action")
async def button_action(payload: dict):
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
async def cart_update(payload: dict):
    """Basket +/- and remove buttons. qty <= 0 removes the line."""
    global order_pending_confirmation
    pid = _num(payload.get("id"))
    qty = _num(payload.get("qty"))
    for c in list(current_cart):
        if pid is not None and c["id"] == int(pid):
            if qty is None or qty <= 0:
                current_cart.remove(c)
            else:
                c["quantity"] = min(qty, 100)
            order_pending_confirmation = False
            break
    return cart_snapshot()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)