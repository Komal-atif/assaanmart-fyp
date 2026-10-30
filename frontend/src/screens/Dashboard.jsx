import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import "./Dashboard.css";

const categories = [
  {
    name: "Commodities",
    icon: "🌾",
    subcategories: ["Atta / Flour", "Rice"],
  },
  {
    name: "Beverages",
    icon: "🥤",
    subcategories: ["Soft Drinks", "Tea", "Coffee", "Tea Whitener", "Juices"],
  },
  {
    name: "Personal Care",
    icon: "🧴",
    subcategories: [
      "Shampoo & Conditioner", "Body Wash", "Toothpaste",
      "Toothbrush", "Mouthwash", "Pads", "Tissues",
    ],
  },
  {
    name: "Fruits & Vegetables",
    icon: "🥦",
    subcategories: ["Fruits", "Vegetables"],
  },
  {
    name: "Snacks & Biscuits",
    icon: "🍪",
    subcategories: ["Biscuits", "Candies", "Chips", "Popcorn", "Chocolate", "Wafers"],
  },
  {
    name: "Dairy",
    icon: "🥛",
    subcategories: ["Milk", "Milk Powder", "Yogurt", "Cream", "Cheese", "Eggs", "Butter"],
  },
  {
    name: "Spices & Sauces",
    icon: "🌶️",
    subcategories: ["Spices", "Sauces"],
  },
];

// Images use verified paths from your project.
// Products without a verified image use an emoji placeholder.
const products = [
  // COMMODITIES
  { name: "Ashrafi Fine Flour", category: "Commodities", subcategory: "Atta / Flour", size: "5kg", price: 983.7, icon: "🌾" },
  { name: "Rice Flour", category: "Commodities", subcategory: "Atta / Flour", size: "500g", price: 140.6, icon: "🌾" },
  { name: "Sadi Fine Flour", category: "Commodities", subcategory: "Atta / Flour", size: "5kg", price: 929.2, icon: "🌾" },
  { name: "Super Basmati Rice 386", category: "Commodities", subcategory: "Rice", size: "1kg", price: 278, icon: "🍚" },
  { name: "Super Kernel Rice", category: "Commodities", subcategory: "Rice", size: "1kg", price: 372, icon: "🍚" },
  { name: "Guard Awami Basmati", category: "Commodities", subcategory: "Rice", size: "1kg", price: 294.5, icon: "🍚" },
  { name: "Guard Supreme Basmati", category: "Commodities", subcategory: "Rice", size: "1kg", price: 541.5, icon: "🍚" },
  { name: "Falak Extreme Basmati", category: "Commodities", subcategory: "Rice", size: "5kg", price: 2521.2, icon: "🍚" },
  { name: "Guard Supreme Basmati", category: "Commodities", subcategory: "Rice", size: "5kg", price: 2702.75, icon: "🍚" },
  { name: "Falak Select Basmati", category: "Commodities", subcategory: "Rice", size: "5kg", price: 2132.75, icon: "🍚" },
  { name: "Falak Brown Basmati", category: "Commodities", subcategory: "Rice", size: "1.5kg", price: 600, icon: "🍚" },

  // BEVERAGES
  { name: "Pepsi PET", category: "Beverages", subcategory: "Soft Drinks", size: "345ml", price: 57, icon: "🥤" },
  { name: "Pepsi PET", category: "Beverages", subcategory: "Soft Drinks", size: "500ml", price: null, icon: "🥤" },
  { name: "Pepsi PET", category: "Beverages", subcategory: "Soft Drinks", size: "1.5L", price: null, icon: "🥤" },
  { name: "Coca-Cola", category: "Beverages", subcategory: "Soft Drinks", size: "345ml", price: null, image: "/products/Beverages/Soft Drinks/139.png" },
  { name: "Coca-Cola", category: "Beverages", subcategory: "Soft Drinks", size: "1.5L", price: null, icon: "🥤" },
  { name: "Coca-Cola Zero Can", category: "Beverages", subcategory: "Soft Drinks", size: "250ml", price: null, icon: "🥤" },
  { name: "Pepsi Zero", category: "Beverages", subcategory: "Soft Drinks", size: "250ml", price: null, icon: "🥤" },
  { name: "Mirinda", category: "Beverages", subcategory: "Soft Drinks", size: "500ml", price: null, icon: "🥤" },
  { name: "7up", category: "Beverages", subcategory: "Soft Drinks", size: "500ml", price: null, icon: "🥤" },
  { name: "Sprite", category: "Beverages", subcategory: "Soft Drinks", size: "500ml", price: null, icon: "🥤" },
  { name: "Tapal Danedar", category: "Beverages", subcategory: "Tea", size: "350g", price: 750, icon: "🍵" },
  { name: "Tapal Elaichi", category: "Beverages", subcategory: "Tea", size: "80g", price: 250, icon: "🍵" },
  { name: "Tapal Tea Bags", category: "Beverages", subcategory: "Tea", size: "50g", price: 250, icon: "🍵" },
  { name: "Tapal Green Tea", category: "Beverages", subcategory: "Tea", size: "45g", price: 250, icon: "🍵" },
  { name: "Tapal Tezdum", category: "Beverages", subcategory: "Tea", size: "170g", price: 400, icon: "🍵" },
  { name: "Vital Tea", category: "Beverages", subcategory: "Tea", size: "430g", price: 950, icon: "🍵" },
  { name: "Nescafe Sachet", category: "Beverages", subcategory: "Coffee", size: "Sachet", price: 30, icon: "☕" },
  { name: "Nescafe Tradicao", category: "Beverages", subcategory: "Coffee", size: "200g", price: 3049, icon: "☕" },
  { name: "Nescafe Gold", category: "Beverages", subcategory: "Coffee", size: "47.5g", price: 12500, icon: "☕" },
  { name: "Best Day Coffee", category: "Beverages", subcategory: "Coffee", size: "50g", price: 650, icon: "☕" },
  { name: "Everyday Tea Whitener", category: "Beverages", subcategory: "Tea Whitener", size: "230g", price: 515, image: "/products/Beverages/Tea Whitener/171.png" },
  { name: "Everyday Powder", category: "Beverages", subcategory: "Tea Whitener", size: "350g", price: 775, icon: "🥛" },
  { name: "Tarang", category: "Beverages", subcategory: "Tea Whitener", size: "170ml", price: 50, icon: "🥛" },
  { name: "Slice Mango", category: "Beverages", subcategory: "Juices", size: "200ml", price: 42, icon: "🧃" },
  { name: "Fruita Vitals Mango", category: "Beverages", subcategory: "Juices", size: "200ml", price: 80, image: "/products/Beverages/Juices/177.png" },
  { name: "Fruita Vitals Mango", category: "Beverages", subcategory: "Juices", size: "1L", price: 380, image: "/products/Beverages/Juices/177.png" },
  { name: "Fruita Vitals Grape", category: "Beverages", subcategory: "Juices", size: "200ml", price: 80, icon: "🧃" },
  { name: "Shezan Mango", category: "Beverages", subcategory: "Juices", size: "250ml", price: 46, icon: "🧃" },
  { name: "Milo", category: "Beverages", subcategory: "Juices", size: "220ml", price: 160, icon: "🥤" },
  { name: "Tang Orange", category: "Beverages", subcategory: "Juices", size: "125g", price: 100, icon: "🍊" },
  { name: "Jam-e-Shirin", category: "Beverages", subcategory: "Juices", size: "800ml", price: 550, icon: "🥤" },

  // PERSONAL CARE
  { name: "Dove Shampoo", category: "Personal Care", subcategory: "Shampoo & Conditioner", size: "650ml", price: 1450, icon: "🧴" },
  { name: "Sunsilk Shampoo", category: "Personal Care", subcategory: "Shampoo & Conditioner", size: "650ml", price: 1399, icon: "🧴" },
  { name: "TRESemme Shampoo", category: "Personal Care", subcategory: "Shampoo & Conditioner", size: "170ml", price: 550, icon: "🧴" },
  { name: "TRESemme Conditioner", category: "Personal Care", subcategory: "Shampoo & Conditioner", size: "170ml", price: 560, icon: "🧴" },
  { name: "Sunsilk Shampoo", category: "Personal Care", subcategory: "Shampoo & Conditioner", size: "80ml", price: 190, icon: "🧴" },
  { name: "Lifebuoy Shampoo", category: "Personal Care", subcategory: "Shampoo & Conditioner", size: "90ml", price: 200, icon: "🧴" },
  { name: "Lux Orchid Body Wash", category: "Personal Care", subcategory: "Body Wash", size: "520ml", price: 748, icon: "🧴" },
  { name: "Lux Rose Body Wash", category: "Personal Care", subcategory: "Body Wash", size: "520ml", price: 790, icon: "🧴" },
  { name: "Lux Vitamin C Body Wash", category: "Personal Care", subcategory: "Body Wash", size: "250ml", price: 437, icon: "🧴" },
  { name: "Palmolive Cherry Body Wash", category: "Personal Care", subcategory: "Body Wash", size: "250ml", price: 400, icon: "🧴" },
  { name: "Colgate Toothpaste", category: "Personal Care", subcategory: "Toothpaste", size: "75g", price: 220, image: "/products/Personal Care/Toothpaste/209.png" },
  { name: "Colgate Toothpaste", category: "Personal Care", subcategory: "Toothpaste", size: "40g", price: 75, image: "/products/Personal Care/Toothpaste/209.png" },
  { name: "Sensodyne", category: "Personal Care", subcategory: "Toothpaste", size: "70g", price: 391, icon: "🪥" },
  { name: "Colgate Herbal", category: "Personal Care", subcategory: "Toothpaste", size: "45g", price: 75, icon: "🪥" },
  { name: "Colgate Slim Soft", category: "Personal Care", subcategory: "Toothbrush", size: "1 pc", price: 170, icon: "🪥" },
  { name: "English Pro Whitening", category: "Personal Care", subcategory: "Toothbrush", size: "1 pc", price: 98, icon: "🪥" },
  { name: "Colgate Mouthwash", category: "Personal Care", subcategory: "Mouthwash", size: "500ml", price: 748, icon: "🧴" },
  { name: "Aquafresh Mouthwash", category: "Personal Care", subcategory: "Mouthwash", size: "500ml", price: 950, icon: "🧴" },
  { name: "Butterfly Pants", category: "Personal Care", subcategory: "Pads", size: "2 pcs", price: 200, icon: "📦" },
  { name: "Freedom Pants", category: "Personal Care", subcategory: "Pads", size: "5 pcs", price: 480, icon: "📦" },
  { name: "Rose Petal Facial Tissue", category: "Personal Care", subcategory: "Tissues", size: "1 pack", price: 243, icon: "🧻" },
  { name: "Prime Toilet Roll", category: "Personal Care", subcategory: "Tissues", size: "1 roll", price: 85, icon: "🧻" },

  // FRUITS & VEGETABLES
  { name: "Bananas", category: "Fruits & Vegetables", subcategory: "Fruits", size: "Half Dozen", price: 133, image: "/products/Fruits and Vegatables/Fruits/249.png" },
  { name: "Grapes", category: "Fruits & Vegetables", subcategory: "Fruits", size: "250g", price: 258, image: "/products/Fruits and Vegatables/Fruits/250.png" },
  { name: "Apples", category: "Fruits & Vegetables", subcategory: "Fruits", size: "500g", price: 219, image: "/products/Fruits and Vegatables/Fruits/251.png" },
  { name: "Sweet Lime", category: "Fruits & Vegetables", subcategory: "Fruits", size: "500g", price: 99, icon: "🍊" },
  { name: "Apples", category: "Fruits & Vegetables", subcategory: "Fruits", size: "1kg", price: 299, image: "/products/Fruits and Vegatables/Fruits/251.png" },
  { name: "Papaya", category: "Fruits & Vegetables", subcategory: "Fruits", size: "450-650g", price: 649, icon: "🍈" },
  { name: "Melon", category: "Fruits & Vegetables", subcategory: "Fruits", size: "500-600g", price: 404, icon: "🍈" },
  { name: "Tomatoes", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500g", price: 78, image: "/products/Fruits and Vegatables/Vegetables/256.png" },
  { name: "Potatoes", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "1kg", price: 49, image: "/products/Fruits and Vegatables/Vegetables/257.png" },
  { name: "Cucumber", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "250g", price: 35, image: "/products/Fruits and Vegatables/Vegetables/258.png" },
  { name: "Onion", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "1kg", price: 244, icon: "🧅" },
  { name: "Mint", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "1 bundle", price: 13, icon: "🌿" },
  { name: "Lemon", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "250g", price: 20, icon: "🍋" },
  { name: "Green Chili", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "250g", price: 44, icon: "🌶️" },
  { name: "Cabbage", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500-600g", price: 80, icon: "🥬" },
  { name: "Capsicum", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500g", price: 143, icon: "🫑" },
  { name: "Spinach", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500g", price: 149, icon: "🥬" },
  { name: "Ginger", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "100g", price: 59, icon: "🫚" },
  { name: "Carrot", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500g", price: 161, icon: "🥕" },
  { name: "Brinjal", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500g", price: 116, icon: "🍆" },
  { name: "Coriander", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "100g", price: 42, icon: "🌿" },
  { name: "Cauliflower", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500-700g", price: 251, icon: "🥦" },
  { name: "Lady Finger", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "1kg", price: 219, icon: "🥬" },
  { name: "Garlic", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "100g", price: 59, icon: "🧄" },
  { name: "Beans", category: "Fruits & Vegetables", subcategory: "Vegetables", size: "500g", price: 149, icon: "🫘" },

  // SNACKS & BISCUITS
  { name: "Bakeri Bistiks", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 95, icon: "🍪" },
  { name: "Peek Freans Gluco", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 320, icon: "🍪" },
  { name: "Cadbury Center Filled Cookies", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 380, icon: "🍪" },
  { name: "Peek Freans Peanut Pik", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 100, icon: "🍪" },
  { name: "Oreo", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 380, image: "/products/Snacks&Biscuits/Biscuits/278.png" },
  { name: "Peek Freans Party Pik", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 100, icon: "🍪" },
  { name: "Tiger Bar", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 285, icon: "🍪" },
  { name: "Bisconni Choc Chip Ticky", category: "Snacks & Biscuits", subcategory: "Biscuits", size: "Pack", price: 240, icon: "🍪" },
  { name: "Candyland Buttons", category: "Snacks & Biscuits", subcategory: "Candies", size: "Pack", price: 50, icon: "🍬" },
  { name: "Candyland Junior Puffs", category: "Snacks & Biscuits", subcategory: "Candies", size: "Pack", price: 180, icon: "🍬" },
  { name: "Candyland Yums", category: "Snacks & Biscuits", subcategory: "Candies", size: "Pack", price: 50, icon: "🍬" },
  { name: "Mayfair Creamers Strawberry", category: "Snacks & Biscuits", subcategory: "Candies", size: "Pack", price: 200, icon: "🍬" },
  { name: "Kurkure Black", category: "Snacks & Biscuits", subcategory: "Chips", size: "Pack", price: 20, icon: "🥔" },
  { name: "Lay's French Cheese", category: "Snacks & Biscuits", subcategory: "Chips", size: "Pack", price: 30, icon: "🥔" },
  { name: "Lay's Masala", category: "Snacks & Biscuits", subcategory: "Chips", size: "Pack", price: 70, icon: "🥔" },
  { name: "Lay's Paprika", category: "Snacks & Biscuits", subcategory: "Chips", size: "Pack", price: 50, image: "/products/Snacks&Biscuits/Chips/293.png" },
  { name: "Slanty Salt", category: "Snacks & Biscuits", subcategory: "Chips", size: "Pack", price: 50, icon: "🥔" },
  { name: "Popcorn Seed", category: "Snacks & Biscuits", subcategory: "Popcorn", size: "250g", price: 111, icon: "🍿" },
  { name: "Popnosh Caramel", category: "Snacks & Biscuits", subcategory: "Popcorn", size: "26g", price: 70, icon: "🍿" },
  { name: "Cadbury Dairy Milk", category: "Snacks & Biscuits", subcategory: "Chocolate", size: "Pack", price: 100, icon: "🍫" },
  { name: "Perk", category: "Snacks & Biscuits", subcategory: "Chocolate", size: "Pack", price: 30, icon: "🍫" },
  { name: "Dairy Milk Oreo", category: "Snacks & Biscuits", subcategory: "Chocolate", size: "95g", price: 950, icon: "🍫" },
  { name: "Frisky Chocolate", category: "Snacks & Biscuits", subcategory: "Wafers", size: "Pack", price: 150, icon: "🍫" },
  { name: "Frisky Orange", category: "Snacks & Biscuits", subcategory: "Wafers", size: "Pack", price: 150, icon: "🍊" },
  { name: "Novita Chocolate", category: "Snacks & Biscuits", subcategory: "Wafers", size: "Pack", price: 320, icon: "🍫" },

  // DAIRY
  { name: "Olper's Full Cream Milk", category: "Dairy", subcategory: "Milk", size: "250ml", price: 92.12, icon: "🥛" },
  { name: "Olper's Full Cream Milk", category: "Dairy", subcategory: "Milk", size: "1000ml", price: 348.84, icon: "🥛" },
  { name: "Nurpur Milk", category: "Dairy", subcategory: "Milk", size: "250ml", price: 84.96, icon: "🥛" },
  { name: "Dairy Omung", category: "Dairy", subcategory: "Milk", size: "1000ml", price: 313.5, icon: "🥛" },
  { name: "Nestle Bunyad", category: "Dairy", subcategory: "Milk Powder", size: "910g", price: 1860, icon: "🥛" },
  { name: "Olper's Milk Powder", category: "Dairy", subcategory: "Milk Powder", size: "800g", price: 2300, icon: "🥛" },
  { name: "Nido", category: "Dairy", subcategory: "Milk Powder", size: "375g", price: 1000, icon: "🥛" },
  { name: "Nestle Sweet & Tasty Yogurt", category: "Dairy", subcategory: "Yogurt", size: "400g", price: 270, icon: "🥣" },
  { name: "Milkpak Yogurt", category: "Dairy", subcategory: "Yogurt", size: "450g", price: 230, icon: "🥣" },
  { name: "Prema Greek Yogurt", category: "Dairy", subcategory: "Yogurt", size: "100g", price: 150, icon: "🥣" },
  { name: "Olper's Cream", category: "Dairy", subcategory: "Cream", size: "200ml", price: 225.6, icon: "🥛" },
  { name: "Nestle Milkpak Cream", category: "Dairy", subcategory: "Cream", size: "200ml", price: 245, icon: "🥛" },
  { name: "Happy Cow Regular", category: "Dairy", subcategory: "Cheese", size: "120g", price: 950, icon: "🧀" },
  { name: "Happy Cow Cheddar Slices", category: "Dairy", subcategory: "Cheese", size: "150g", price: 1150, icon: "🧀" },
  { name: "Dairy Life Mozzarella", category: "Dairy", subcategory: "Cheese", size: "200g", price: 1370, icon: "🧀" },
  { name: "Brightfarms Eggs", category: "Dairy", subcategory: "Eggs", size: "12 pcs", price: 330, icon: "🥚" },
  { name: "Farm Fresh Eggs", category: "Dairy", subcategory: "Eggs", size: "12 pcs", price: 390, icon: "🥚" },
  { name: "Blue Band", category: "Dairy", subcategory: "Butter", size: "100g", price: 200, icon: "🧈" },
  { name: "Dayfresh Butter", category: "Dairy", subcategory: "Butter", size: "200g", price: 800, icon: "🧈" },
  { name: "Lurpak Butter", category: "Dairy", subcategory: "Butter", size: "250g", price: 1470, icon: "🧈" },

  // SPICES & SAUCES
  { name: "Italia Mixed Herbs", category: "Spices & Sauces", subcategory: "Spices", size: "30g", price: 221.26, icon: "🌿" },
  { name: "Italia Garlic Paste", category: "Spices & Sauces", subcategory: "Spices", size: "330g", price: 384.8, icon: "🧄" },
  { name: "National Chilli Powder", category: "Spices & Sauces", subcategory: "Spices", size: "400g", price: 467.2, icon: "🌶️" },
  { name: "Shan Chicken Biryani Masala", category: "Spices & Sauces", subcategory: "Spices", size: "55g", price: 127.5, icon: "🌶️" },
  { name: "Italia White Pepper", category: "Spices & Sauces", subcategory: "Spices", size: "80g", price: 443.26, icon: "🧂" },
  { name: "National Hot Sauce", category: "Spices & Sauces", subcategory: "Sauces", size: "290g", price: 236.8, icon: "🌶️" },
  { name: "Dipitt Pizza Sauce", category: "Spices & Sauces", subcategory: "Sauces", size: "400g", price: 376.65, icon: "🍅" },
  { name: "Knorr Pizza/Pasta Sauce", category: "Spices & Sauces", subcategory: "Sauces", size: "400g", price: 474.3, icon: "🍅" },
  { name: "Dipitt Peri Peri", category: "Spices & Sauces", subcategory: "Sauces", size: "300g", price: 441.75, icon: "🌶️" },
  { name: "Shangrila Achari Mango Sauce", category: "Spices & Sauces", subcategory: "Sauces", size: "Bottle", price: 162.5, icon: "🥭" },
  { name: "Dipitt BBQ Sauce", category: "Spices & Sauces", subcategory: "Sauces", size: "400g", price: 390.6, icon: "🍅" },
];

function Dashboard({ user, onNavigate, onLogout }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [message, setMessage] = useState("");

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch =
        !selectedCategory || product.category === selectedCategory;

      const subcategoryMatch =
        !selectedSubcategory || product.subcategory === selectedSubcategory;

      const searchMatch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());

      return categoryMatch && subcategoryMatch && searchMatch;
    });
  }, [selectedCategory, selectedSubcategory, search]);

  const openCategory = (category) => {
    setSelectedCategory(category.name);
    setSelectedSubcategory(null);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (selectedSubcategory) {
      setSelectedSubcategory(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
    setSearch("");
  };

  const changeQuantity = (name, amount) => {
    setQuantities((previous) => ({
      ...previous,
      [name]: Math.max(1, (previous[name] || 1) + amount),
    }));
  };

  const addToCart = (product) => {
    if (product.price === null || product.price === undefined) {
      setMessage("Price is not available for this product yet.");
      return;
    }

    const quantity = quantities[product.name] || 1;

    setCart((previous) => {
      const found = previous.find((item) => item.name === product.name);
      if (found) {
        return previous.map((item) =>
          item.name === product.name
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...previous, { ...product, quantity }];
    });

    setMessage(`${product.name} added to cart.`);
    setTimeout(() => setMessage(""), 2200);
  };

  const updateCartQuantity = (name, amount) => {
    setCart((previous) =>
      previous
        .map((item) =>
          item.name === name
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (name) => {
    setCart((previous) => previous.filter((item) => item.name !== name));
  };

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const currentCategory = categories.find(
    (category) => category.name === selectedCategory
  );

  return (
    <div className="dashboard-page">
      <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="dashboard-container">
        {!selectedCategory ? (
          <>
            <section className="dashboard-welcome">
              <div>
                <p className="dashboard-label">WELCOME TO ASSANMART</p>
                <h1>Groceries made easy.</h1>
                <p>Choose a category to explore products.</p>
              </div>
              <button className="cart-open-button" onClick={() => setShowCart(true)}>
                🛒 Cart ({cartCount})
              </button>
            </section>

            <section className="category-page">
              <div className="section-heading">
                <div>
                  <h2>Shop by Category</h2>
                  <p>Explore all grocery categories</p>
                </div>
              </div>

              <div className="main-category-grid">
                {categories.map((category) => (
                  <button
                    className="main-category-card"
                    key={category.name}
                    onClick={() => openCategory(category)}
                  >
                    <span className="category-emoji">{category.icon}</span>
                    <strong>{category.name}</strong>
                    <small>{category.subcategories.length} subcategories</small>
                    <span className="category-arrow">Explore →</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <button className="back-button" onClick={goBack}>
              ← {selectedSubcategory ? "Back to subcategories" : "Back to categories"}
            </button>

            <section className="category-title-section">
              <div>
                <p className="dashboard-label">ASSANMART CATEGORIES</p>
                <h1>{selectedSubcategory || selectedCategory}</h1>
                <p>
                  {selectedSubcategory
                    ? `Products in ${selectedSubcategory}`
                    : `Explore ${selectedCategory} subcategories`}
                </p>
              </div>
              <button className="cart-open-button" onClick={() => setShowCart(true)}>
                🛒 Cart ({cartCount})
              </button>
            </section>

            {!selectedSubcategory ? (
              <section className="subcategory-section">
                <h2>Choose a subcategory</h2>
                <div className="subcategory-grid">
                  {currentCategory.subcategories.map((subcategory) => (
                    <button
                      className="subcategory-card"
                      key={subcategory}
                      onClick={() => {
                        setSelectedSubcategory(subcategory);
                        setSearch("");
                      }}
                    >
                      <span>🛍️</span>
                      <strong>{subcategory}</strong>
                      <small>
                        {products.filter(
                          (product) =>
                            product.category === selectedCategory &&
                            product.subcategory === subcategory
                        ).length}{" "}
                        products
                      </small>
                      <span className="category-arrow">View products →</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="products-section">
                <div className="products-toolbar">
                  <div>
                    <h2>Available Products</h2>
                    <p>{visibleProducts.length} products found</p>
                  </div>
                  <input
                    className="product-search"
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="product-grid">
                  {visibleProducts.map((product, index) => (
                    <article className="product-card" key={`${product.name}-${index}`}>
                      <div className="product-image-box">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <span
                          className="product-placeholder"
                          style={{ display: product.image ? "none" : "flex" }}
                        >
                          {product.icon || "🛒"}
                        </span>
                      </div>

                      <div className="product-information">
                        <small>{product.subcategory}</small>
                        <h3>{product.name}</h3>
                        <p className="product-size">{product.size}</p>

                        <strong className="product-price">
                          {product.price == null
                            ? "Price unavailable"
                            : `PKR ${Number(product.price).toLocaleString("en-PK")}`}
                        </strong>

                        <div className="product-actions">
                          <div className="quantity-control">
                            <button onClick={() => changeQuantity(product.name, -1)}>−</button>
                            <span>{quantities[product.name] || 1}</span>
                            <button onClick={() => changeQuantity(product.name, 1)}>+</button>
                          </div>
                          <button
                            className="add-cart-button"
                            onClick={() => addToCart(product)}
                            disabled={product.price == null}
                          >
                            {product.price == null ? "Unavailable" : "Add"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {visibleProducts.length === 0 && (
                  <p className="empty-message">No products found.</p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {message && <div className="toast-message">{message}</div>}

      {showCart && (
        <div className="cart-overlay" onClick={() => setShowCart(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>Your Cart ({cartCount})</h2>
              <button onClick={() => setShowCart(false)}>✕</button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <span>🛒</span>
                <h3>Your cart is empty</h3>
                <p>Add some products to get started.</p>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.name}>
                      <div className="cart-item-icon">{item.icon || "🛍️"}</div>
                      <div className="cart-item-details">
                        <strong>{item.name}</strong>
                        <small>PKR {item.price} × {item.quantity}</small>
                        <div className="cart-quantity">
                          <button onClick={() => updateCartQuantity(item.name, -1)}>−</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.name, 1)}>+</button>
                          <button
                            className="remove-item"
                            onClick={() => removeFromCart(item.name)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Subtotal</span>
                    <strong>PKR {cartTotal.toLocaleString("en-PK")}</strong>
                  </div>
                  <button
                    className="checkout-button"
                    onClick={() => alert("Checkout will be connected in the next step.")}
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default Dashboard;