import React, { useState, useMemo } from 'react';
import { ProductCard } from './ProductCard';
import { Product, Category } from '../types';
import {
  ArrowUpDown,
  Truck,
  Leaf,
  Shield,
  Smartphone,
  Store,
  Sparkles,
  Search,
  CheckCircle2,
  Apple,
  Milk,
  Cookie,
  CupSoda,
  Wheat,
  Croissant,
  Fish,
  Heart,
  Flame,
  Tag,
  ShoppingBag,
  Camera,
} from 'lucide-react';

interface StoreDashboardProps {
  categories: Category[];
  products: Product[];
  cart: { [id: string]: number };
  onAddToCart: (product: Product, eventElement: HTMLElement) => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onQuickView: (product: Product) => void;
  initialCategory?: string | null;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onOpenImageScanner?: () => void;
  onOpenVoice?: () => void;
}

const POPULAR_IDS = ["251", "256", "249", "250", "2", "325", "97", "83"];
const DAILY_IDS = ["177", "258", "278", "299"];

// Professional SVG Category Icon Helper (Zero Emojis)
export const getCategoryIcon = (categoryName: string, className: string = "w-5 h-5") => {
  switch (categoryName) {
    case 'Fruits & Vegetables':
      return <Apple className={className} />;
    case 'Dairy':
      return <Milk className={className} />;
    case 'Snacks & Biscuits':
      return <Cookie className={className} />;
    case 'Beverages':
      return <CupSoda className={className} />;
    case 'Commodities':
      return <Wheat className={className} />;
    case 'Bakery & Breakfast':
      return <Croissant className={className} />;
    case 'Meat & Sea Food':
      return <Fish className={className} />;
    case 'Personal Care':
      return <Heart className={className} />;
    case 'Spices & Sauces':
      return <Flame className={className} />;
    default:
      return <ShoppingBag className={className} />;
  }
};

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  categories,
  products,
  cart,
  onAddToCart,
  onChangeQuantity,
  onQuickView,
  initialCategory = null,
  searchTerm,
  onSearchChange,
  onOpenImageScanner,
  onOpenVoice,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'name'>('featured');
  const [visibleCount, setVisibleCount] = useState(30);

  const byId = (id: string) => products.find((p) => p.id === id);

  const currentCategoryData = useMemo(() => {
    return categories.find((c) => c.name === selectedCategory);
  }, [categories, selectedCategory]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let list = products.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (selectedSubcategory && p.subcategory !== selectedSubcategory) return false;
      if (term) {
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesSearch = p.search.toLowerCase().includes(term);
        const matchesCategory = p.category.toLowerCase().includes(term);
        const matchesSubcategory = p.subcategory.toLowerCase().includes(term);
        if (!matchesName && !matchesSearch && !matchesCategory && !matchesSubcategory) {
          return false;
        }
      }
      return true;
    });

    if (sortBy === 'price-low') {
      list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, searchTerm, selectedCategory, selectedSubcategory, sortBy]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const showSpecificResults = Boolean(selectedCategory || searchTerm.trim());

  return (
    <div className="bg-transparent min-h-screen pb-20 font-sans selection:bg-[#cde8dd] selection:text-[#064e3b]">
      
      {/* Sleek, Compact Single-Line Bar for "Browse Full Store" + "Sort by Size/Order" */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white/95 backdrop-blur-md border-b border-[#e2ede6] py-2 px-3 sm:px-6 shadow-2xs">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Left: Active Category / Filter Status */}
          <div className="flex items-center gap-2">
            {selectedCategory ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-bold text-[#064e3b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#064e3b]" />
                <span>{selectedCategory}</span>
                {selectedSubcategory && (
                  <span className="text-[#047857]">/ {selectedSubcategory}</span>
                )}
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                  }}
                  className="ml-1 text-[#064e3b] hover:text-[#043d2e] font-extrabold text-[11px]"
                  title="Clear category filter"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e2ede6] text-xs font-semibold text-[#064e3b]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Supermarket Catalog</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#ecfdf5] text-[#064e3b] rounded-full font-bold">
                  {products.length} Products
                </span>
              </div>
            )}
          </div>

          {/* Right: Compact "Sort by Size/Order" single line dropdown */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5 bg-white border border-[#d1fae5] rounded-full px-3 py-1 text-xs transition-colors hover:border-[#064e3b]">
              <ArrowUpDown className="w-3 h-3 text-[#064e3b] animate-bounce" style={{ animationDuration: '2s' }} />
              <span className="text-[11px] font-medium text-[#064e3b] hidden xs:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#064e3b] focus:outline-hidden cursor-pointer pr-1"
              >
                <option value="featured">Featured Order</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
            </div>

            <span className="text-[11px] font-semibold text-[#4b6b60] bg-[#fbf8f2] px-2.5 py-1 rounded-full border border-[#ede3d4] hidden md:inline-block">
              Cash on Delivery
            </span>
          </div>

        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-3 sm:px-6 pt-5 space-y-7">
        
        {/* Promotional Showcase Hero Banner - Requested 3D AssanMart Brand Banner */}
        {/* Promotional Showcase Hero Banner */}
<div
  onClick={() => onOpenVoice?.()}
  className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-[#e2ede6] shadow-md hover:shadow-lg bg-white cursor-pointer group transition-all p-0"
  title="Click to start voice grocery order"
>
  <img
    src="/banner.jpeg"
    alt="AssanMart - Your Voice. Your Groceries"
    className="block w-full h-[220px] sm:h-[260px] lg:h-[390px] object-cover object-center"
  />
</div>

        {/* Category Circles Row (Categories shown as circles with names underneath) */}
        <div className="bg-white/90 backdrop-blur-xs rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs border border-[#e2ede6]">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#064e3b]" />
              <h2 className="text-base sm:text-lg font-black text-[#064e3b]">
                Explore By Category
              </h2>
            </div>
            {selectedCategory && (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                }}
                className="text-xs font-bold text-[#064e3b] hover:text-[#047857] hover:underline cursor-pointer"
              >
                View all categories
              </button>
            )}
          </div>

          {/* Grid of Circular Category Avatars with Name strictly beneath the circle */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 sm:gap-4 justify-items-center">
            {categories.map((c) => {
              const isSelected = selectedCategory === c.name;
              const count = products.filter((p) => p.category === c.name).length;

              return (
                <button
                  key={c.name}
                  onClick={() => {
                    setSelectedCategory(isSelected ? null : c.name);
                    setSelectedSubcategory(null);
                  }}
                  className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-all duration-200 w-full"
                >
                  {/* Category Circle with border & picture/icon inside */}
                  <div className={`relative w-16 h-16 sm:w-20 sm:h-20 lg:w-22 lg:h-22 rounded-full p-1 transition-all duration-300 ${
                    isSelected
                      ? 'ring-3 ring-[#064e3b] shadow-md scale-105'
                      : 'ring-1 ring-[#e2ede6] hover:ring-2 hover:ring-[#064e3b] hover:shadow-md'
                  }`}>
                    <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#d1fae5] via-[#ecfdf5] to-[#fbf8f2]'
                        : 'bg-gradient-to-br from-[#ffffff] via-[#fbf8f2] to-[#f0fdf4] group-hover:scale-105'
                    }`}>
                      <div className={`flex items-center justify-center transition-transform group-hover:scale-110 ${
                        isSelected ? 'text-[#064e3b]' : 'text-[#064e3b]'
                      }`}>
                        {getCategoryIcon(c.name, 'w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 stroke-[1.8]')}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#064e3b] ring-2 ring-white" />
                    )}
                  </div>

                  {/* Category Name strictly UNDER the Circle */}
                  <div className="mt-2.5 text-center max-w-[85px] sm:max-w-[95px]">
                    <span className={`text-[11px] sm:text-xs font-bold leading-tight block line-clamp-2 transition-colors ${
                      isSelected ? 'text-[#064e3b] font-black' : 'text-[#1d3a33] group-hover:text-[#064e3b]'
                    }`}>
                      {c.name}
                    </span>
                    <span className="text-[10px] text-[#5d8174] font-semibold mt-0.5 block">
                      {count} items
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Minimal Clean Aisles Bar (Matching user reference image_46d9bfce.png) */}
          <div className="mt-5 pt-3.5 border-t border-[#e2ede6] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs sm:text-sm font-black tracking-wider text-[#064e3b] uppercase shrink-0 select-none mr-1">
              AISLES:
            </span>

            {currentCategoryData && currentCategoryData.subcategories.length > 0 ? (
              <>
                <button
                  onClick={() => setSelectedSubcategory(null)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                    selectedSubcategory === null
                      ? 'bg-[#064e3b] text-white shadow-xs'
                      : 'bg-white text-[#064e3b] hover:bg-[#f0fdf4] border border-[#a7f3d0] hover:border-[#064e3b]'
                  }`}
                >
                  All in {selectedCategory}
                </button>
                {currentCategoryData.subcategories.map((sub) => {
                  const isSubSelected = selectedSubcategory === sub;
                  return (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubcategory(isSubSelected ? null : sub)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                        isSubSelected
                          ? 'bg-[#064e3b] text-white shadow-xs'
                          : 'bg-white text-[#064e3b] hover:bg-[#f0fdf4] border border-[#a7f3d0] hover:border-[#064e3b]'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === null
                      ? 'bg-[#064e3b] text-white shadow-xs'
                      : 'bg-white text-[#064e3b] hover:bg-[#f0fdf4] border border-[#a7f3d0]'
                  }`}
                >
                  All Store Aisles
                </button>
                {[
                  { label: 'Cooking Oil', cat: 'Cooking & Baking', sub: 'Oil & Ghee' },
                  { label: 'Olive Oil', cat: 'Cooking & Baking', sub: 'Oil & Ghee' },
                  { label: 'Canola Oil', cat: 'Cooking & Baking', sub: 'Oil & Ghee' },
                  { label: 'Sunflower Oil', cat: 'Cooking & Baking', sub: 'Oil & Ghee' },
                  { label: 'Ghee', cat: 'Cooking & Baking', sub: 'Oil & Ghee' },
                  { label: 'Pulses', cat: 'Cooking & Baking', sub: 'Pulses' },
                  { label: 'Salt', cat: 'Cooking & Baking', sub: 'Sugar' },
                  { label: 'Sugar', cat: 'Cooking & Baking', sub: 'Sugar' },
                  { label: 'Atta / Flour', cat: 'Cooking & Baking', sub: 'Flour & Atta' },
                  { label: 'Rice', cat: 'Cooking & Baking', sub: 'Rice' },
                ].map((aisle) => (
                  <button
                    key={aisle.label}
                    onClick={() => {
                      setSelectedCategory(aisle.cat);
                      setSelectedSubcategory(aisle.sub);
                    }}
                    className="px-4 py-1.5 rounded-full text-xs font-bold shrink-0 bg-white text-[#064e3b] hover:bg-[#f0fdf4] border border-[#a7f3d0] hover:border-[#064e3b] transition-all cursor-pointer whitespace-nowrap"
                  >
                    {aisle.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* If category or search is active, show the filtered grid directly */}
        {showSpecificResults ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-[#d1fae5]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#064e3b]">
                  {selectedCategory || 'Search Results'}
                  {selectedSubcategory && <span className="text-[#377d67] font-normal"> / {selectedSubcategory}</span>}
                </h3>
                <p className="text-[11px] text-[#377d67]">
                  Showing <b>{filteredProducts.length}</b> verified product{filteredProducts.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                    onSearchChange('');
                  }}
                  className="px-3 py-1 rounded-full bg-[#f0fdf4] hover:bg-[#d1fae5] text-[#064e3b] font-bold text-xs border border-[#a7f3d0] cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#d1fae5] space-y-3">
                <Search className="w-10 h-10 text-emerald-500/60 mx-auto" />
                <h4 className="text-base font-bold text-[#064e3b]">No products found</h4>
                <p className="text-xs text-[#377d67]">Try searching for other brand names or clear your filter.</p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                    onSearchChange('');
                  }}
                  className="px-4 py-1.5 rounded-full bg-[#064e3b] text-white font-bold text-xs cursor-pointer hover:bg-[#065f46] shadow-xs"
                >
                  Show All Products
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {displayedProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    quantity={cart[p.id] || 0}
                    onAddToCart={onAddToCart}
                    onChangeQuantity={onChangeQuantity}
                    onQuickView={onQuickView}
                  />
                ))}
              </div>
            )}

            {filteredProducts.length > visibleCount && (
              <div className="text-center pt-4">
                <button
                  onClick={() => setVisibleCount((c) => c + 30)}
                  className="px-6 py-2.5 rounded-full bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm cursor-pointer transition-colors"
                >
                  Load More Products ({filteredProducts.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Default Dashboard View: Popular + Daily Best Sells + Clean Deals + Why */
          <div className="space-y-10">
            
            {/* Section: Popular Products */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#064e3b]">Popular Products</h2>
                  <p className="text-xs text-[#377d67]">Top grocery essentials ordered by families this week</p>
                </div>
                <button
                  onClick={() => setSelectedCategory('Fruits & Vegetables')}
                  className="text-xs font-bold text-[#064e3b] hover:text-[#047857] hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
                {POPULAR_IDS.map((id) => byId(id))
                  .filter((p): p is Product => Boolean(p))
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      quantity={cart[product.id] || 0}
                      onAddToCart={onAddToCart}
                      onChangeQuantity={onChangeQuantity}
                      onQuickView={onQuickView}
                    />
                  ))}
              </div>
            </div>

            {/* Section: Daily Best Sells */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#064e3b]">Daily Best Sells</h2>
                  <p className="text-xs text-[#377d67]">Everyday pantry items at official wholesale prices</p>
                </div>
                <button
                  onClick={() => setSelectedCategory('Commodities')}
                  className="text-xs font-bold text-[#064e3b] hover:text-[#047857] hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Green Nature Banner */}
                <div className="lg:col-span-4 relative overflow-hidden rounded-2xl min-h-[300px] bg-gradient-to-br from-[#fbf8f2] via-[#ecfdf5] to-[#d1fae5] flex flex-col justify-end p-6 border border-[#c6e5d2]">
                  <svg className="absolute top-0 left-0 w-full h-[70%] pointer-events-none" viewBox="0 0 300 320" aria-hidden="true">
                    <g className="db-sway a"><path d="M40 300 C 20 200, 60 90, 170 30 C 190 130, 150 250, 40 300z" fill="#064e3b" opacity="0.8" /></g>
                    <g className="db-sway b"><path d="M150 310 C 140 240, 190 160, 270 130 C 280 210, 240 280, 150 310z" fill="#047857" opacity="0.75" /></g>
                    <g className="db-sway c"><path d="M10 160 C 20 100, 70 60, 120 50 C 110 110, 70 150, 10 160z" fill="#6ee7b7" opacity="0.65" /></g>
                  </svg>

                  <div className="relative z-10 bg-white/95 backdrop-blur-xs p-5 rounded-xl border border-white shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase text-[#064e3b] tracking-wider block mb-1">
                      Freshly Packed
                    </span>
                    <h3 className="text-lg font-black text-[#064e3b] leading-tight">
                      Bring nature into your home
                    </h3>
                    <p className="text-xs text-[#047857] mt-1 mb-3.5">
                      Everyday freshness, picked and packed with care.
                    </p>
                    <button
                      onClick={() => setSelectedCategory('Fruits & Vegetables')}
                      className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      Shop Produce
                    </button>
                  </div>
                </div>

                {/* 4 Daily Cards Grid */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {DAILY_IDS.map((id) => byId(id))
                    .filter((p): p is Product => Boolean(p))
                    .map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        quantity={cart[product.id] || 0}
                        onAddToCart={onAddToCart}
                        onChangeQuantity={onChangeQuantity}
                        onQuickView={onQuickView}
                      />
                    ))}
                </div>
              </div>
            </div>

            {/* Section: Why Arches */}
            <div className="bg-gradient-to-r from-[#fdfbf7] via-[#f2faf5] to-[#fcfaf7] rounded-2xl p-6 sm:p-8 text-center border border-[#d8e6dd]">
              <div className="max-w-xl mx-auto mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-[#064e3b]">
                  We always provide the best in town
                </h2>
                <p className="text-xs sm:text-sm text-[#047857] mt-1">
                  From the first tap to your front door, we keep grocery shopping simple.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {[
                  { icon: <Truck className="w-6 h-6 text-white" />, title: 'Fast Delivery', desc: 'Doorstep arrival within 30-45 minutes.' },
                  { icon: <Leaf className="w-6 h-6 text-white" />, title: 'Fresh Quality', desc: 'Hand-sorted vegetables and farm milk.' },
                  { icon: <Smartphone className="w-6 h-6 text-white" />, title: 'Voice & Tap', desc: 'Speak your list in Urdu or add with one tap.' },
                  { icon: <Shield className="w-6 h-6 text-white" />, title: 'Confirm First', desc: 'Check all items before final confirmation.' },
                ].map((item, idx) => (
                  <div
                    key={item.title}
                    className="bg-[#064e3b] text-white rounded-t-[50px] rounded-b-2xl p-5 pt-8 flex flex-col items-center shadow-md hover:-translate-y-1 transition-transform border border-[#065f46]"
                    style={{ minHeight: idx % 2 === 1 ? '220px' : '200px' }}
                  >
                    <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-2.5 bg-white/10">
                      {item.icon}
                    </div>
                    <h3 className="text-sm font-bold mb-1">{item.title}</h3>
                    <p className="text-[11px] text-emerald-100 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};