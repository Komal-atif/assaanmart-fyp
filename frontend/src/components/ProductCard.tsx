
import React, { useState } from 'react';
import { Plus, Minus, Package, Heart, Eye, Leaf } from 'lucide-react';
import { FitImage } from './FitImage';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAddToCart: (product: Product, eventElement: HTMLElement) => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onQuickView: (product: Product) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
}

// Fresh badge only for fruits and vegetables
const isFreshProduce = (p: Product) =>
  /fruit|vegetable|veg/i.test(
    `${p.category || ''} ${p.subcategory || ''}`
  );

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
  const isOutOfStock = product.stock === 0;
  const isPriceUnavailable = product.price == null;

  const toggleWish = () => {
    if (onToggleFavorite) {
      onToggleFavorite(product);
    } else {
      setLocalWish((v) => !v);
    }
  };

  const formatPrice = (val: number | null) => {
    if (val == null) return null;

    const [whole, dec] = Number(val).toFixed(2).split('.');

    return {
      whole: Number(whole).toLocaleString('en-PK'),
      dec,
    };
  };

  const priceObj = formatPrice(product.price);
  return (
    <article
      className={`db-gcard relative flex flex-col justify-between bg-white rounded-2xl sm:rounded-3xl border border-[#e0f4e7] p-3 sm:p-3.5 shadow-2xs hover:shadow-xl hover:border-[#1daa61]/40 hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden ${
        isOutOfStock ? 'is-out opacity-80' : ''
      } ${quantity > 0 ? 'ring-2 ring-[#1daa61]/20 border-[#1daa61]' : ''}`}
    >
      {/* Top subtle emerald gradient line accent on hover */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#1daa61] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Top Section: Podium Image + Floating Overlays */}
      <div>
        <div
          className="db-gimg relative w-full rounded-xl sm:rounded-2xl border border-[#edf5f0] cursor-pointer overflow-hidden group/img"
          onClick={() => onQuickView(product)}
          title="Click to view details"
        >
          {/* Product Image with smooth hover scale */}
          {product.image && !imageError ? (
            <FitImage
              src={product.image}
              alt={product.name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="transition-transform duration-300 ease-out"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white border border-[#e0f4e7] flex items-center justify-center shadow-xs">
              <Package className="w-6 h-6 text-[#2a6b43]/70 stroke-[1.6]" />
            </div>
          )}

          {/* Top Left Badge: Stock or Fresh Deal Badge */}
          {isOutOfStock ? (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9.5px] font-bold shadow-2xs">
              Out of stock
            </span>
          ) : isFreshProduce(product) && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#fbf8f2] text-[#2a6b43] border border-[#ede3d4] text-[9.5px] font-bold shadow-2xs flex items-center gap-1">
              <Leaf className="w-3 h-3 text-[#148a4c] fill-[#b3e4c4]" strokeWidth={2.2} />
              <span>Fresh</span>
            </span>
          )}

        {/* Favourite Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWish();
          }}
          className={`absolute top-2 right-2 z-20
            w-8 h-8 rounded-full
            flex items-center justify-center
            shadow-sm border transition-all duration-200
            ${
              isWishlisted
                ? 'bg-rose-50 text-rose-600 border border-rose-200 opacity-100 scale-105'
                : 'bg-white/90 text-slate-400 hover:text-rose-600 border border-slate-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110'
            }`}
          title="Add to favorites"
          aria-label="Save to favorites"
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              isWishlisted ? 'fill-rose-500' : ''
            }`}
          />
        </button>

          {/* Bottom Quick View Reveal Pill on Hover */}
          <div className="absolute bottom-2 inset-x-0 flex justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 text-[#2a6b43] text-[10px] font-bold shadow-sm border border-[#e0f4e7]">
              <Eye className="w-3 h-3 text-[#148a4c]" />
              <span>Quick View</span>
            </span>
          </div>
        </div>

        {/* Product Meta: Category & Title */}
        <div className="mt-2.5 text-left w-full">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#148a4c] line-clamp-1 block">
            {product.subcategory || product.category}
          </span>
          
          <h3
            onClick={() => onQuickView(product)}
            title={product.name}
            className="text-xs sm:text-[13px] font-bold text-[#2a6b43] group-hover:text-[#0f6e3d] line-clamp-2 min-h-[2.5em] leading-snug cursor-pointer transition-colors mt-0.5"
          >
            {product.name}
          </h3>

          {/* Size / Weight Tag */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center text-[10px] font-semibold text-[#4d7a5c] bg-[#fbf8f2] px-2 py-0.5 rounded-md border border-[#ede3d4]">
              {product.size || 'Standard pack'}
            </span>
          </div>
        </div>
      </div>

      {/* Price and Cart Section */}
      <div
        className="mt-3 pt-3
        border-t border-[#edf2e9] w-full"
      >
        {/* Price */}
        <div
          className="flex items-center
          justify-between gap-1 mb-2.5"
        >
          {isPriceUnavailable || !priceObj ? (
            <span
              className="text-[11px]
              font-semibold text-[#91a18e]"
            >
              Price unavailable
            </span>
          ) : (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl font-black text-[#2a6b43] tracking-tight leading-none">
                Rs.&nbsp;{priceObj.whole}
              </span>
            </div>
          )}

        </div>

        {/* Add to Cart / Quantity Controls */}
        <div className="db-gaction w-full">
          {isOutOfStock || isPriceUnavailable ? (
            <button
              className="w-full h-11 sm:h-12 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center justify-center"
              disabled
            >
              {isOutOfStock ? 'Out of stock' : 'Unavailable'}
            </button>
          ) : quantity === 0 ? (
            <button
              className="add-btn group/btn relative w-full h-11 sm:h-12 mx-auto rounded-xl bg-gradient-to-r from-[#1daa61] to-[#3fc27b] hover:from-[#148a4c] hover:to-[#1daa61] text-white font-extrabold text-sm sm:text-[15px] tracking-wide overflow-hidden flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-[#1daa61]/25 hover:shadow-lg hover:shadow-[#1daa61]/35 hover:-translate-y-0.5 cursor-pointer transition-all active:scale-95"
              onClick={(e) => onAddToCart(product, e.currentTarget)}
              aria-label={`Add ${product.name} to cart`}
            >
              <span className="add-shine" aria-hidden="true" />
              <span className="relative">Add to Cart</span>
            </button>
          ) : (
            <div className="add-stepper w-full h-11 sm:h-12 mx-auto rounded-xl bg-[#1daa61] text-white flex items-center justify-between px-2 shadow-xs">
              <button
                onClick={() =>
                  onChangeQuantity(product.id, -1)
                }
                aria-label="Remove one"
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white hover:text-[#2a6b43] text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
              >
                <Minus size={15} strokeWidth={2.8} />
              </button>
              <span key={quantity} className="add-num font-black text-sm text-white px-2 select-none">
                {quantity}
              </span>

              <button
                onClick={(e) =>
                  onAddToCart(product, e.currentTarget)
                }
                aria-label="Add one"
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white hover:text-[#2a6b43] text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
              >
                <Plus size={15} strokeWidth={2.8} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
