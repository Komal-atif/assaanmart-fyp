import React, { useState, useMemo } from 'react';
import { ProductCard } from './ProductCard';
import { Product, Category } from '../types';
import {
  ArrowUpDown,
  Store,
  Sparkles,
  Search,
  Apple,
  Milk,
  Cookie,
  CupSoda,
  Wheat,
  Croissant,
  Fish,
  Heart,
  Flame,
  ShoppingBag,
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
  favorites?: string[];
  onToggleFavorite?: (product: Product) => void;
}

const POPULAR_IDS = ["251", "256", "249", "250", "2", "325", "97", "83"];

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

/* ---------------------------------------------------------------------------
   Category pictures (shown inside the round category buttons instead of icons).
   Save the files in:   public/products/categories/
   They are then served from  /products/categories/<file>
   Square pictures (about 400 x 400 px) work best. To use .webp or .jpg, change CATEGORY_IMAGE_EXT.
   If a picture is missing the old icon is shown, so nothing breaks while you add them.
--------------------------------------------------------------------------- */
const CATEGORY_IMAGE_DIR = '/products/categories';
const CATEGORY_IMAGE_EXT = 'png';

const CATEGORY_IMAGES: Record<string, string> = {
  'Fruits & Vegetables': `${CATEGORY_IMAGE_DIR}/fruits-and-vegetables.${CATEGORY_IMAGE_EXT}`,
  'Dairy': `${CATEGORY_IMAGE_DIR}/dairy.${CATEGORY_IMAGE_EXT}`,
  'Snacks & Biscuits': `${CATEGORY_IMAGE_DIR}/snacks-and-biscuits.${CATEGORY_IMAGE_EXT}`,
  'Beverages': `${CATEGORY_IMAGE_DIR}/beverages.${CATEGORY_IMAGE_EXT}`,
  'Commodities': `${CATEGORY_IMAGE_DIR}/commodities.${CATEGORY_IMAGE_EXT}`,
  'Bakery & Breakfast': `${CATEGORY_IMAGE_DIR}/bakery-and-breakfast.${CATEGORY_IMAGE_EXT}`,
  'Meat & Sea Food': `${CATEGORY_IMAGE_DIR}/meat-and-sea-food.${CATEGORY_IMAGE_EXT}`,
  'Personal Care': `${CATEGORY_IMAGE_DIR}/personal-care.${CATEGORY_IMAGE_EXT}`,
  'Spices & Sauces': `${CATEGORY_IMAGE_DIR}/spices-and-sauces.${CATEGORY_IMAGE_EXT}`,
  'Cooking & Baking': `${CATEGORY_IMAGE_DIR}/cooking-and-baking.${CATEGORY_IMAGE_EXT}`,
};

// any other category name becomes a file name automatically, e.g. "Home Care" -> home-care.png
const slugify = (name: string) =>
  name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const getCategoryImage = (categoryName: string) =>
  CATEGORY_IMAGES[categoryName] ?? `${CATEGORY_IMAGE_DIR}/${slugify(categoryName)}.${CATEGORY_IMAGE_EXT}`;

const CategoryImage: React.FC<{ name: string; iconClass: string }> = ({ name, iconClass }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return getCategoryIcon(name, iconClass);
  return (
    <img
      src={getCategoryImage(name)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
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
  favorites = [],
  onToggleFavorite,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(initialCategory);

  const [selectedSubcategory, setSelectedSubcategory] =
    useState<string | null>(null);

  const [sortBy, setSortBy] = useState<
    'featured' | 'price-low' | 'price-high' | 'name'
  >('featured');

  const [visibleCount, setVisibleCount] = useState(30);

  // the header's "How it works" link asks us to leave any search / category so the section is on screen
  React.useEffect(() => {
    const reset = () => { setSelectedCategory(null); setSelectedSubcategory(null); onSearchChange(''); };
    window.addEventListener('assanmart:show-home', reset);
    return () => window.removeEventListener('assanmart:show-home', reset);
  }, [onSearchChange]);

  const byId = (id: string) => products.find((p) => p.id === id);

  const currentCategoryData = useMemo(() => {
    return categories.find((c) => c.name === selectedCategory);
  }, [categories, selectedCategory]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let list = products.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false;

      if (selectedSubcategory && p.subcategory !== selectedSubcategory) {
        return false;
      }

      if (term) {
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesSearch = p.search.toLowerCase().includes(term);
        const matchesCategory = p.category.toLowerCase().includes(term);
        const matchesSubcategory = p.subcategory.toLowerCase().includes(term);

        if (
          !matchesName &&
          !matchesSearch &&
          !matchesCategory &&
          !matchesSubcategory
        ) {
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

  const popularProducts = useMemo(() => {
    const favs = favorites
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));

    const rest = POPULAR_IDS
      .filter((id) => !favorites.includes(id))
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));

    return [...favs, ...rest];
  }, [favorites, products]);

  const favProps = (p: Product) => ({
    isFavorite: favorites.includes(p.id),
    onToggleFavorite,
  });

  return (
    <div className="bg-transparent min-h-screen pb-20 font-sans selection:bg-[#e0f4e7] selection:text-[#2a6b43]">
      
      {/* Sleek, Compact Single-Line Bar for "Browse Full Store" + "Sort by Size/Order" */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white/95 backdrop-blur-md border-b border-[#e0f4e7] py-2 px-3 sm:px-6 shadow-2xs">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-2">
          
          {/* Left: Active Category / Filter Status */}
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            {selectedCategory ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3fbf6] border border-[#b3e4c4] text-xs font-bold text-[#2a6b43]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1daa61]" />
                <span>{selectedCategory}</span>

                {selectedSubcategory && (
                  <span className="text-[#0f6e3d]">/ {selectedSubcategory}</span>
                )}

                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                  }}
                  className="ml-1 text-[#2a6b43] hover:text-[#1f5233] font-extrabold text-[11px]"
                  title="Clear category filter"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#e0f4e7] text-xs font-semibold text-[#2a6b43] max-w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fc27b] animate-pulse" />
                <span>Supermarket Catalog</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#f3fbf6] text-[#2a6b43] rounded-full font-bold">
                  {products.length} Products
                </span>
              </div>
            )}
          </div>

          {/* Right: Compact "Sort by Size/Order" single line dropdown */}
          <div className="flex items-center gap-2 ml-auto max-w-full">
            <div className="flex items-center gap-1.5 bg-white border border-[#e0f4e7] rounded-full px-3 py-1 text-xs transition-colors hover:border-[#1daa61]">
              <ArrowUpDown className="w-3 h-3 text-[#2a6b43] animate-bounce" style={{ animationDuration: '2s' }} />
              <span className="text-[11px] font-medium text-[#2a6b43] hidden xs:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#2a6b43] focus:outline-hidden cursor-pointer pr-1 max-w-[140px] sm:max-w-none sort-select"
              >
                <option value="featured">Featured Order</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
            </div>

            <span className="text-[11px] font-semibold text-[#4d7a5c] bg-[#fbf8f2] px-2.5 py-1 rounded-full border border-[#ede3d4] hidden md:inline-block">
              Cash on Delivery
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-3 sm:px-6 pt-5 space-y-7">
        
        {/* Promotional Showcase Hero Banner */}
        <div
          onClick={() => onOpenVoice?.()}
          className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-[#e0f4e7] shadow-md hover:shadow-lg bg-white cursor-pointer group transition-all p-0"
          title="Click to start voice grocery order"
        >
          <img
            src="/banner.jpeg"
            alt="AssanMart - Your Voice. Your Groceries"
            className="block w-full h-auto sm:h-[260px] lg:h-[390px] object-cover object-center"
          />
        </div>

        {/* Category Circles Row (Categories shown as circles with names underneath) */}
        <div className="bg-white/90 backdrop-blur-xs rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-xs border border-[#e0f4e7]">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1daa61]" />
              <h2 className="text-base sm:text-lg font-black text-[#2a6b43]">
                Explore By Category
              </h2>
            </div>

            {selectedCategory && (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                }}
                className="text-xs font-bold text-[#2a6b43] hover:text-[#0f6e3d] hover:underline cursor-pointer"
              >
                View all categories
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 sm:gap-4 justify-items-center">
            {categories.map((c) => {
              const isSelected = selectedCategory === c.name;

              const count = products.filter(
                (p) => p.category === c.name
              ).length;

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
                      ? 'ring-3 ring-[#1daa61] shadow-md scale-105'
                      : 'ring-1 ring-[#e0f4e7] hover:ring-2 hover:ring-[#1daa61] hover:shadow-md'
                  }`}>
                    <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#e0f4e7] via-[#f3fbf6] to-[#fbf8f2]'
                        : 'bg-gradient-to-br from-[#ffffff] via-[#fbf8f2] to-[#f3fbf6] group-hover:scale-105'
                    }`}>
                      <div className="w-full h-full flex items-center justify-center text-[#2a6b43] transition-transform duration-300 group-hover:scale-110">
                        <CategoryImage name={c.name} iconClass="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 stroke-[1.8]" />
                      </div>
                    </div>

                    {isSelected && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#1daa61] ring-2 ring-white" />
                    )}
                  </div>

                  <div className="mt-2.5 text-center max-w-[85px] sm:max-w-[95px]">
                    <span className={`text-[11px] sm:text-xs font-bold leading-tight block line-clamp-2 transition-colors ${
                      isSelected ? 'text-[#2a6b43] font-black' : 'text-[#0f6e3d] group-hover:text-[#2a6b43]'
                    }`}>
                      {c.name}
                    </span>

                    <span className="text-[10px] text-[#91A992] font-semibold mt-0.5 block">
                      {count} items
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Minimal Clean Aisles Bar (Matching user reference image_46d9bfce.png) */}
          <div className="mt-5 pt-3.5 border-t border-[#e0f4e7] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs sm:text-sm font-black tracking-wider text-[#2a6b43] uppercase shrink-0 select-none mr-1">
              AISLES:
            </span>

            {currentCategoryData && currentCategoryData.subcategories.length > 0 ? (
              <>
                <button
                  onClick={() => setSelectedSubcategory(null)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                    selectedSubcategory === null
                      ? 'bg-[#1daa61] text-white shadow-xs'
                      : 'bg-white text-[#2a6b43] hover:bg-[#f3fbf6] border border-[#b3e4c4] hover:border-[#1daa61]'
                  }`}
                >
                  All in {selectedCategory}
                </button>

                {currentCategoryData.subcategories.map((sub) => {
                  const isSubSelected = selectedSubcategory === sub;

                  return (
                    <button
                      key={sub}
                      onClick={() =>
                        setSelectedSubcategory(isSubSelected ? null : sub)
                      }
                      className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                        isSubSelected
                          ? 'bg-[#1daa61] text-white shadow-xs'
                          : 'bg-white text-[#2a6b43] hover:bg-[#f3fbf6] border border-[#b3e4c4] hover:border-[#1daa61]'
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
                      ? 'bg-[#1daa61] text-white shadow-xs'
                      : 'bg-white text-[#2a6b43] hover:bg-[#f3fbf6] border border-[#b3e4c4]'
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
                    className="px-4 py-1.5 rounded-full text-xs font-bold shrink-0 bg-white text-[#2a6b43] hover:bg-[#f3fbf6] border border-[#b3e4c4] hover:border-[#1daa61] transition-all cursor-pointer whitespace-nowrap"
                  >
                    {aisle.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* FILTERED PRODUCTS */}
        {showSpecificResults ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-[#e0f4e7]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#2a6b43]">
                  {selectedCategory || 'Search Results'}
                  {selectedSubcategory && <span className="text-[#148a4c] font-normal"> / {selectedSubcategory}</span>}
                </h3>
                <p className="text-[11px] text-[#148a4c]">
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
                  className="px-3 py-1 rounded-full bg-[#f3fbf6] hover:bg-[#e0f4e7] text-[#2a6b43] font-bold text-xs border border-[#b3e4c4] cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#e0f4e7] space-y-3">
                <Search className="w-10 h-10 text-[#1daa61]/60 mx-auto" />
                <h4 className="text-base font-bold text-[#2a6b43]">No products found</h4>
                <p className="text-xs text-[#148a4c]">Try searching for other brand names or clear your filter.</p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                    onSearchChange('');
                  }}
                  className="px-4 py-1.5 rounded-full bg-[#1daa61] text-white font-bold text-xs cursor-pointer hover:bg-[#148a4c] shadow-xs"
                >
                  Show All Products
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {displayedProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    quantity={cart[p.id] || 0}
                    onAddToCart={onAddToCart}
                    onChangeQuantity={onChangeQuantity}
                    onQuickView={onQuickView}
                    {...favProps(p)}
                  />
                ))}
              </div>
            )}

            {filteredProducts.length > visibleCount && (
              <div className="text-center pt-4">
                <button
                  onClick={() => setVisibleCount((c) => c + 30)}
                  className="px-6 py-2.5 rounded-full bg-[#1daa61] hover:bg-[#148a4c] text-white font-bold text-xs shadow-sm cursor-pointer transition-colors"
                >
                  Load More Products ({filteredProducts.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Default Dashboard View: Popular + How it works */
          <div className="space-y-10">

            {/* POPULAR PRODUCTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#2a6b43]">Popular Products</h2>
                  <p className="text-xs text-[#148a4c]">{favorites.length > 0 ? 'Your favourites first, then top grocery essentials' : 'Top grocery essentials ordered by families this week'}</p>
                </div>

                <button
                  onClick={() => setSelectedCategory('Fruits & Vegetables')}
                  className="text-xs font-bold text-[#2a6b43] hover:text-[#0f6e3d] hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {popularProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] || 0}
                    onAddToCart={onAddToCart}
                    onChangeQuantity={onChangeQuantity}
                    onQuickView={onQuickView}
                    {...favProps(product)}
                  />
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};