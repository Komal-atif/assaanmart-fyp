import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const IMG = "/products";

const CATEGORIES = [
  { id: "commodities", name: "Commodities", ur: "راشن", emoji: "🛢️", color: "#FFF1C9" },
  { id: "personal", name: "Personal Care", ur: "ذاتی نگہداشت", emoji: "🧴", color: "#FFE0E6" },
  { id: "beverages", name: "Beverages", ur: "مشروبات", emoji: "🥤", color: "#DDF0FF" },
  { id: "snacks", name: "Snacks & Biscuits", ur: "اسنیکس", emoji: "🍪", color: "#FFE5D4" },
  { id: "bakery", name: "Bakery & Breakfast", ur: "ناشتہ", emoji: "🍞", color: "#FFF6C9" },
  { id: "fruitveg", name: "Fruits & Vegetables", ur: "پھل سبزی", emoji: "🥦", color: "#D8F3E3" },
  { id: "dairy", name: "Dairy", ur: "ڈیری", emoji: "🥛", color: "#ECE4FF" },
  { id: "meat", name: "Meat & Sea Food", ur: "گوشت", emoji: "🍗", color: "#FFD9D2" },
  { id: "spices", name: "Spices & Sauces", ur: "مسالے اور ساس", emoji: "🌶️", color: "#FFE3C8" },
];

const PRODUCTS = [
  { id: 1, cat: "commodities", name: "Dalda Canola Oil Pouch", size: "1 L", price: 615, img: "Commodities/Cooking%20Oil/1.png" },
  { id: 61, cat: "commodities", name: "Sugar", size: "1 kg", price: 140, img: "Commodities/Sugar/61.png" },
  { id: 57, cat: "commodities", name: "Shan Pink Himalayan Salt", size: "800 g", price: 95, img: "Commodities/Salt/57.png" },
  { id: 123, cat: "commodities", name: "Mughal Chakki Atta", size: "5 kg", price: 977.5, img: "Commodities/Atta-Flour/123.png" },
  { id: 325, cat: "dairy", name: "Olper's Full Cream Milk", size: "1000 ml", price: 348.84, img: "Dairy/Milk/325.png" },
  { id: 331, cat: "dairy", name: "Nestle Yogurt Sweet & Tasty", size: "400 g", price: 270, img: "Dairy/Yogurt/331.png" },
  { id: 97, cat: "bakery", name: "brightfarms Fresh Eggs Large", size: "12 pcs", price: 323, img: "Bakery&Breakfast/Eggs/97.png" },
  { id: 83, cat: "bakery", name: "Dawn Bread Plain Large", size: "Large", price: 270, img: "Bakery&Breakfast/Bread/83.png" },
  { id: 74, cat: "meat", name: "brightfarms Chicken Standard Cut", size: "1 kg", price: 747.15, img: "meat&chicken/Chicken/74.png" },
  { id: 160, cat: "beverages", name: "Vital Tea Pouch", size: "430 g", price: 950, img: "Beverages/Tea/160.png" },
  { id: 176, cat: "beverages", name: "Slice Mango Fruit Drink", size: "200 ml", price: 42, img: "Beverages/Juices/176.png" },
  { id: 294, cat: "snacks", name: "Lay's Classic", size: "", price: 150, img: "Snacks&Biscuits/Chips/294.png" },
  { id: 313, cat: "snacks", name: "Cadbury Dairy Milk", size: "", price: 100, img: "Snacks&Biscuits/Chocolates/313.png" },
  { id: 209, cat: "personal", name: "Colgate Max Blue Toothpaste", size: "75 g", price: 220, img: "Personal%20Care/Toothpaste/209.png" },
  { id: 250, cat: "fruitveg", name: "brightfarms Sunder Khani Grapes", size: "250 g", price: 258, img: "Fruits%20and%20Vegatables/Fruits/250.png" },
  { id: 22, cat: "commodities", name: "Haleeb Asli Desi Ghee", size: "1 kg", price: 2800, img: "Commodities/Ghee/22.png" },
  { id: 345, cat: "dairy", name: "Blue Band Regular Margarine", size: "100 g", price: 200, img: "Dairy/Butter/345.png" },
  { id: 242, cat: "personal", name: "Rose Petal Tissue Box Pop Up", size: "", price: 243, img: "Personal%20Care/Tissues/242.png" },
  { id: 354, cat: "spices", name: "National Drizz'l Hot Sauce", size: "290 g", price: 236.8, img: "Spices%20&%20Sauces/Sauces/354.png" },
  { id: 349, cat: "spices", name: "Italia Mix Herbs Jar", size: "30 g", price: 221.26, img: "Spices%20&%20Sauces/Spices/349.png" },
];

const rs = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });

function Img({ src, fallback }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className="pd-fallback">{fallback}</span>;
  return <img src={src} alt="" loading="lazy" onError={() => setBad(true)} />;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState({});

  const product = PRODUCTS.find((p) => p.id === parseInt(id));
  const category = CATEGORIES.find((c) => c.id === product?.cat);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("am_cart");
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch { /* ignore */ }
  }, []);

  const add = (productId, delta = 1) => {
    setCart((c) => {
      const n = (c[productId] || 0) + delta;
      const x = { ...c };
      if (n <= 0) delete x[productId]; else x[productId] = n;
      try { localStorage.setItem("am_cart", JSON.stringify(x)); } catch { /* ignore */ }
      return x;
    });
  };

  if (!product) {
    return (
      <div className="pd-container">
        <div className="pd-error">
          <h2>Product not found</h2>
          <button onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    add(product.id, qty);
    alert(`Added ${qty} ${product.name} to cart!`);
    navigate("/dashboard");
  };

  return (
    <div className="pd-container">
      <div className="pd-bg" aria-hidden="true">
        {["🍎", "🥕", "🍞", "🥛", "🍪", "🧃", "🍅", "🧀"].map((e, i) => (
          <span key={i} style={{ "--i": i }}>{e}</span>
        ))}
      </div>

      <header className="pd-header">
        <button className="pd-back" onClick={() => navigate("/dashboard")}>
          ← Back
        </button>
        <h1>Product Details</h1>
      </header>

      <main className="pd-main">
        <div className="pd-content">
          <div className="pd-image">
            <Img src={`${IMG}/${product.img}`} fallback="🛍️" />
          </div>

          <div className="pd-info">
            <div className="pd-badge" style={{ "--bg": category?.color }}>
              {category?.emoji} {category?.name}
            </div>

            <h1 className="pd-title">{product.name}</h1>
            <p className="pd-size">{product.size || "Standard Size"}</p>

            <div className="pd-price">
              <span className="pd-price-label">Price</span>
              <span className="pd-price-value">{rs(product.price)}</span>
            </div>

            <div className="pd-qty-section">
              <label>Quantity</label>
              <div className="pd-qty">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty(qty + 1)}>+</button>
              </div>
            </div>

            <div className="pd-total">
              <span>Total</span>
              <span className="pd-total-value">{rs(product.price * qty)}</span>
            </div>

            <button className="pd-add-btn" onClick={handleAddToCart}>
              Add to Cart 🛒
            </button>

            <div className="pd-features">
              <div className="pd-feature">
                <span>✓</span>
                <span>Original Product</span>
              </div>
              <div className="pd-feature">
                <span>✓</span>
                <span>Fast Delivery</span>
              </div>
              <div className="pd-feature">
                <span>✓</span>
                <span>Quality Assured</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
