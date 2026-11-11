
import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Package,
  Heart,
  Eye,
  Leaf,
} from 'lucide-react';
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
      className={`db-gcard relative flex flex-col justify-between
        bg-white rounded-2xl sm:rounded-3xl
        border border-[#e6eee5] p-3 sm:p-3.5
        shadow-sm hover:shadow-lg
        hover:border-[#b9d4b8]
        hover:-translate-y-1
        transition-all duration-300 group overflow-hidden
        ${isOutOfStock ? 'opacity-80' : ''}
        ${
          quantity > 0
            ? 'ring-2 ring-[#b9d4b8] border-[#a9cda9]'
            : ''
        }`}
    >
      {/* Soft pastel top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]
        bg-gradient-to-r from-transparent via-[#a9cda9]
        to-transparent opacity-0 group-hover:opacity-100
        transition-opacity duration-300"
      />

      {/* Product Image */}
      <div
        className="db-gimg relative w-full aspect-square
          rounded-xl sm:rounded-2xl
          border border-[#edf3eb]
          bg-[#f8fbf7] cursor-pointer overflow-hidden
          group/img flex items-center justify-center"
        onClick={() => onQuickView(product)}
        title="Click to view details"
      >
        {product.image && !imageError ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain p-2.5
              transition-transform duration-300
              group-hover/img:scale-105"
          />
        ) : (
          <Package className="w-8 h-8 text-[#a5bca3]" />
        )}

        {/* Fresh / Stock Badge */}
        {isOutOfStock ? (
          <span
            className="absolute top-2 left-2
            px-2 py-1 rounded-full
            bg-rose-50 text-rose-600
            text-[9px] font-bold border border-rose-100"
          >
            Out of stock
          </span>
        ) : isFreshProduce(product) ? (
          <span
            className="absolute top-2 left-2
            inline-flex items-center gap-1
            px-2 py-1 rounded-full
            bg-[#eaf4e8] text-[#638b61]
            text-[9.5px] font-bold
            border border-[#d6e7d2] shadow-sm"
          >
            <Leaf size={12} strokeWidth={2.2} />
            Fresh
          </span>
        ) : null}

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
                ? 'bg-rose-50 text-rose-500 border-rose-100'
                : 'bg-white/95 text-[#9aab99] border-[#e6eee5] hover:text-rose-500 hover:bg-rose-50'
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

        {/* Quick View */}
        <div
          className="absolute bottom-2 inset-x-0
          flex justify-center opacity-0
          group-hover/img:opacity-100
          transition-opacity duration-200
          pointer-events-none"
        >
          <span
            className="inline-flex items-center gap-1
            px-2.5 py-1 rounded-full
            bg-white/95 text-[#668765]
            text-[10px] font-bold shadow-sm"
          >
            <Eye size={12} />
            Quick View
          </span>
        </div>
      </div>

      {/* Product Details */}
      <div className="mt-3 text-left w-full">
        <span
          className="text-[9.5px] font-bold uppercase
          tracking-wider text-[#8baa86]
          line-clamp-1 block"
        >
          {product.subcategory || product.category}
        </span>

        <h3
          onClick={() => onQuickView(product)}
          title={product.name}
          className="text-xs sm:text-[13px]
            font-bold text-[#405b40]
            group-hover:text-[#638b61]
            line-clamp-2 min-h-[2.5em]
            leading-snug cursor-pointer
            transition-colors mt-1"
        >
          {product.name}
        </h3>

        {/* Size / Weight */}
        <div className="mt-2 flex items-center">
          <span
            className="inline-flex items-center
            text-[10px] font-medium
            text-[#7b8f78] bg-[#f5f8f2]
            px-2 py-1 rounded-lg
            border border-[#e9eee4]"
          >
            {product.size || 'Standard pack'}
          </span>
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
            <div className="flex items-baseline gap-1">
              <span
                className="text-base sm:text-lg
                font-extrabold text-[#456746]
                tracking-tight leading-none"
              >
                Rs. {priceObj.whole}
              </span>
              <span
                className="text-[10px]
                font-semibold text-[#789376]"
              >
                .{priceObj.dec}
              </span>
            </div>
          )}
        </div>

        {/* Add to Cart / Quantity Controls */}
        <div className="db-gaction w-full">
          {isOutOfStock || isPriceUnavailable ? (
            <button
              className="w-full h-9 rounded-xl
                bg-[#f1f3ef] text-[#9ba598]
                text-xs font-semibold cursor-not-allowed
                flex items-center justify-center"
              disabled
            >
              {isOutOfStock ? 'Out of stock' : 'Unavailable'}
            </button>
          ) : quantity === 0 ? (
            <button
              className="w-full h-9 sm:h-10
                rounded-xl bg-[#a9cda9]
                hover:bg-[#91b991]
                text-[#315533] font-bold text-xs
                flex items-center justify-center gap-1.5
                shadow-sm hover:shadow-md
                cursor-pointer transition-all
                active:scale-95 group/btn"
              onClick={(e) =>
                onAddToCart(product, e.currentTarget)
              }
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus
                size={16}
                strokeWidth={2.5}
                className="transition-transform
                  group-hover/btn:rotate-90 duration-200"
              />
              <span>Add to Cart</span>
            </button>
          ) : (
            <div
              className="w-full h-9 sm:h-10
              rounded-xl bg-[#a9cda9]
              text-[#315533]
              flex items-center justify-between
              px-2 shadow-sm"
            >
              <button
                onClick={() =>
                  onChangeQuantity(product.id, -1)
                }
                aria-label="Remove one"
                className="w-7 h-7 rounded-lg
                  bg-white/60 hover:bg-white
                  flex items-center justify-center
                  transition-all cursor-pointer
                  active:scale-90"
              >
                <Minus size={14} strokeWidth={2.8} />
              </button>

              <span
                key={quantity}
                className="font-extrabold text-sm
                  px-2 select-none"
              >
                {quantity}
              </span>

              <button
                onClick={(e) =>
                  onAddToCart(product, e.currentTarget)
                }
                aria-label="Add one"
                className="w-7 h-7 rounded-lg
                  bg-white/60 hover:bg-white
                  flex items-center justify-center
                  transition-all cursor-pointer
                  active:scale-90"
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
