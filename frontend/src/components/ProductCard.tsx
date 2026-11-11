import React, { useState } from 'react';
import { Plus, Minus, Package, Heart, Eye, Sparkles } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAddToCart: (product: Product, eventElement: HTMLElement) => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onQuickView: (product: Product) => void;
  /** favourites live in App (shared with the header and the dashboard); without them the heart works on this card only */
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
}

// the "Fresh" badge belongs to fruits and vegetables only
const isFreshProduce = (p: Product) => /fruit|veg/i.test(`${p.category || ''} ${p.subcategory || ''}`);

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity,
  onAddToCart,
  onChangeQuantity,
  onQuickView,
  isFavorite,
  onToggleFavorite,
}) => {
  const [imageError, setImageError] = useState(false);
  const [localWish, setLocalWish] = useState(false);
  const isWishlisted = isFavorite ?? localWish;
  const toggleWish = () => (onToggleFavorite ? onToggleFavorite(product) : setLocalWish((v) => !v));
  const isOutOfStock = product.stock === 0;
  const isPriceUnavailable = product.price == null;

  // Format price
  const formatPrice = (val: number | null) => {
    if (val == null) return null;
    const [whole, dec] = Number(val).toFixed(2).split('.');
    return {
      whole: Number(whole).toLocaleString('en-PK'),
      dec: dec || '00',
      num: Number(val),
    };
  };

  const priceObj = formatPrice(product.price);
  // Calculate a realistic regular market compare price (e.g. 14-18% higher) to highlight value
  const comparePrice = priceObj
    ? Math.round(priceObj.num * 1.15)
    : null;

  return (
    <article
      className={`db-gcard relative flex flex-col justify-between bg-white rounded-2xl sm:rounded-3xl border border-[#e2ede6] p-3 sm:p-3.5 shadow-2xs hover:shadow-xl hover:border-[#064e3b]/40 hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden ${
        isOutOfStock ? 'is-out opacity-80' : ''
      } ${quantity > 0 ? 'ring-2 ring-[#064e3b]/20 border-[#064e3b]' : ''}`}
    >
      {/* Top subtle emerald gradient line accent on hover */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#064e3b] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Top Section: Podium Image + Floating Overlays */}
      <div>
        <div
          className="db-gimg relative w-full rounded-xl sm:rounded-2xl border border-[#edf5f0] cursor-pointer overflow-hidden group/img"
          onClick={() => onQuickView(product)}
          title="Click to view details"
        >
          {/* Product Image with smooth hover scale */}
          {product.image && !imageError ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="transition-transform duration-300 ease-out"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white border border-[#d1fae5] flex items-center justify-center shadow-xs">
              <Package className="w-6 h-6 text-[#064e3b]/70 stroke-[1.6]" />
            </div>
          )}

          {/* Top Left Badge: Stock or Fresh Deal Badge */}
          {isOutOfStock ? (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9.5px] font-bold shadow-2xs">
              Out of stock
            </span>
          ) : isFreshProduce(product) && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#fbf8f2] text-[#064e3b] border border-[#ede3d4] text-[9.5px] font-bold shadow-2xs flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#059669]" />
              <span>Fresh</span>
            </span>
          )}

          {/* Top Right: Wishlist Heart Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWish();
            }}
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
              isWishlisted
                ? 'bg-rose-50 text-rose-600 border border-rose-200 opacity-100 scale-105'
                : 'bg-white/90 text-slate-400 hover:text-rose-600 border border-slate-100 opacity-0 group-hover:opacity-100 hover:scale-110'
            }`}
            title={isWishlisted ? 'Saved to favorites' : 'Add to favorites'}
            aria-label="Save to favorites"
          >
            <Heart
              className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500' : ''}`}
            />
          </button>

          {/* Bottom Quick View Reveal Pill on Hover */}
          <div className="absolute bottom-2 inset-x-0 flex justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 text-[#064e3b] text-[10px] font-bold shadow-sm border border-[#d1fae5]">
              <Eye className="w-3 h-3 text-[#059669]" />
              <span>Quick View</span>
            </span>
          </div>
        </div>

        {/* Product Meta: Category & Title */}
        <div className="mt-2.5 text-left w-full">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#059669] line-clamp-1 block">
            {product.subcategory || product.category}
          </span>
          
          <h3
            onClick={() => onQuickView(product)}
            title={product.name}
            className="text-xs sm:text-[13px] font-bold text-[#064e3b] group-hover:text-[#047857] line-clamp-2 min-h-[2.5em] leading-snug cursor-pointer transition-colors mt-0.5"
          >
            {product.name}
          </h3>

          {/* Size / Weight Tag */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center text-[10px] font-semibold text-[#4b6b60] bg-[#fbf8f2] px-2 py-0.5 rounded-md border border-[#ede3d4]">
              {product.size || 'Standard pack'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Price + Dark Green Action Button */}
      <div className="mt-3 pt-2 border-t border-[#edf5f0] w-full">
        {/* Creative Price Display with Compare Price & Savings */}
        <div className="flex items-baseline justify-between gap-1 mb-2">
          {isPriceUnavailable || !priceObj ? (
            <span className="text-[11px] font-semibold text-[#6d8e82]">
              Price unavailable
            </span>
          ) : (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base sm:text-lg font-black text-[#064e3b] tracking-tight leading-none">
                Rs.&nbsp;{priceObj.whole}
              </span>
              {comparePrice && (
                <span className="text-[11px] text-slate-400 line-through font-medium">
                  Rs.&nbsp;{comparePrice}
                </span>
              )}
            </div>
          )}

          {priceObj && !isOutOfStock && (
            <span className="text-[9.5px] font-extrabold text-[#047857] bg-[#ecfdf5] border border-[#a7f3d0] px-1.5 py-0.2 rounded-md shrink-0">
              -15%
            </span>
          )}
        </div>

        {/* Dark Green Action Button & Stepper */}
        <div className="db-gaction w-full">
          {isOutOfStock || isPriceUnavailable ? (
            <button
              className="w-full h-9 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center justify-center"
              disabled
            >
              {isOutOfStock ? 'Out of stock' : 'Unavailable'}
            </button>
          ) : quantity === 0 ? (
            <button
              className="w-full h-9 sm:h-10 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer transition-all active:scale-95 group/btn"
              onClick={(e) => onAddToCart(product, e.currentTarget)}
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus
                size={16}
                strokeWidth={2.4}
                className="transition-transform group-hover/btn:rotate-90 duration-200"
              />
              <span>Add to Cart</span>
            </button>
          ) : (
            <div className="w-full h-9 sm:h-10 rounded-xl bg-[#064e3b] text-white flex items-center justify-between px-2 shadow-xs animate-in zoom-in-95 duration-150">
              <button
                onClick={() => onChangeQuantity(product.id, -1)}
                aria-label="Remove one"
                className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white hover:text-[#064e3b] text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
              >
                <Minus size={14} strokeWidth={2.8} />
              </button>
              <span
                key={quantity}
                className="font-black text-sm text-white px-2 select-none"
              >
                {quantity}
              </span>
              <button
                onClick={(e) => onAddToCart(product, e.currentTarget)}
                aria-label="Add one"
                className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white hover:text-[#064e3b] text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
              >
                <Plus size={14} strokeWidth={2.8} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};