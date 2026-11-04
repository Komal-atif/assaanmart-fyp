import pandas as pd
from sqlalchemy import create_engine, Column, String, Float, Integer, Text
from sqlalchemy.orm import declarative_base, sessionmaker

# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = "sqlite:///./asanmart.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# ============================================================
# GROCERY TABLE
# ============================================================

class GroceryItem(Base):
    __tablename__ = "groceries"

    id = Column(Integer, primary_key=True)

    name = Column(String)
    brand = Column(String)

    category = Column(String)
    subcategory = Column(String)

    package_size = Column(String)
    unit = Column(String)

    price = Column(Float)
    stock_quantity = Column(Float)

    image_url = Column(Text)
    aliases = Column(Text)


# Create table if it doesn't exist
Base.metadata.create_all(bind=engine)


# ============================================================
# LOAD EXCEL DATASET
# ============================================================

EXCEL_FILE = "data/assanmart_dataset.xlsx"

df = pd.read_excel(EXCEL_FILE)

print("=" * 60)
print("ASSANMART DATASET LOADER")
print("=" * 60)

print(f"Dataset loaded successfully.")
print(f"Total rows in Excel: {len(df)}")

print("\nColumns found:")
for column in df.columns:
    print(f"  - {column}")


# ============================================================
# CHECK REQUIRED COLUMNS
# ============================================================

required_columns = [
    "id",
    "name",
    "brand",
    "category",
    "subcategory",
    "package_size",
    "unit",
    "price",
    "stock_quantity",
    "image_url",
    "aliases"
]

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    print("\n❌ Missing columns:")
    for col in missing_columns:
        print(f"  - {col}")

    raise ValueError("Dataset structure does not match expected columns.")


# ============================================================
# CLEAN DATA
# ============================================================

# Replace NaN values with None
df = df.where(pd.notna(df), None)


# Convert numeric fields
df["id"] = pd.to_numeric(df["id"], errors="coerce")
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["stock_quantity"] = pd.to_numeric(
    df["stock_quantity"],
    errors="coerce"
)


# Remove rows without a product name
df = df[df["name"].notna()]

print(f"\nValid products after cleaning: {len(df)}")


# ============================================================
# CLEAR OLD DATABASE DATA
# ============================================================

db = SessionLocal()

print("\nRemoving old grocery data...")

db.query(GroceryItem).delete()

db.commit()

print("Old grocery data removed.")


# ============================================================
# INSERT NEW PRODUCTS
# ============================================================

count = 0

for _, row in df.iterrows():

    item = GroceryItem(

        id=int(row["id"]),

        name=str(row["name"]) if row["name"] is not None else None,

        brand=str(row["brand"]) if row["brand"] is not None else None,

        category=(
            str(row["category"])
            if row["category"] is not None
            else None
        ),

        subcategory=(
            str(row["subcategory"])
            if row["subcategory"] is not None
            else None
        ),

        package_size=(
            str(row["package_size"])
            if row["package_size"] is not None
            else None
        ),

        unit=(
            str(row["unit"])
            if row["unit"] is not None
            else None
        ),

        price=(
            float(row["price"])
            if row["price"] is not None
            else 0
        ),

        stock_quantity=(
            float(row["stock_quantity"])
            if row["stock_quantity"] is not None
            else 0
        ),

        image_url=(
            str(row["image_url"])
            if row["image_url"] is not None
            else None
        ),

        aliases=(
            str(row["aliases"])
            if row["aliases"] is not None
            else None
        )
    )

    db.add(item)
    count += 1


db.commit()
db.close()


# ============================================================
# VERIFY DATABASE
# ============================================================

db = SessionLocal()

total_products = db.query(GroceryItem).count()

print("\n" + "=" * 60)
print("DATABASE UPDATE COMPLETE")
print("=" * 60)

print(f"Products inserted: {count}")
print(f"Products in database: {total_products}")


# ============================================================
# SHOW SAMPLE PRODUCTS
# ============================================================

print("\nSample products:")

products = db.query(GroceryItem).limit(10).all()

for product in products:

    print(
        f"{product.id}. "
        f"{product.name} | "
        f"{product.brand} | "
        f"Rs.{product.price} | "
        f"{product.package_size}"
    )


# ============================================================
# CATEGORY SUMMARY
# ============================================================

print("\nCategories:")

categories = (
    db.query(GroceryItem.category)
    .distinct()
    .all()
)

for category in categories:

    if category[0]:
        total = (
            db.query(GroceryItem)
            .filter(GroceryItem.category == category[0])
            .count()
        )

        print(f"  {category[0]}: {total} products")


db.close()

print("\n✅ AssanMart database successfully updated!")