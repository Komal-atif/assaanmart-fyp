import sqlite3

DATABASE = "asanmart.db"

conn = sqlite3.connect(DATABASE)
cursor = conn.cursor()

print("=" * 60)
print("ASSANMART DATABASE CHECK")
print("=" * 60)

# Check table structure
cursor.execute("PRAGMA table_info(groceries)")
columns = cursor.fetchall()

print("\nDatabase columns:")
for column in columns:
    print(f"  - {column[1]}")

# Count products
cursor.execute("SELECT COUNT(*) FROM groceries")
count = cursor.fetchone()[0]

print(f"\nTotal products: {count}")

# Show sample products
cursor.execute("""
    SELECT id, name, brand, price, package_size, unit, stock_quantity
    FROM groceries
    LIMIT 10
""")

items = cursor.fetchall()

print("\nSample products:")
for item in items:
    product_id, name, brand, price, package_size, unit, stock = item

    print(
        f"{product_id}. {name} | "
        f"{brand} | Rs.{price} | "
        f"{package_size} {unit} | "
        f"Stock: {stock}"
    )

print("\n" + "=" * 60)
print("DATABASE CHECK COMPLETE")
print("=" * 60)

conn.close()