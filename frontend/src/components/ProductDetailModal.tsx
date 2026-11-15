import React, { useEffect, useState } from 'react';
import { X, Plus, Minus, Check, Leaf, Wallet, Truck, Mic } from 'lucide-react';
import { Product } from '../types';
import { FitImage } from './FitImage';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

// the leaf badge belongs to fruits and vegetables only
const isFreshProduce = (p: Product) => /fruit|veg/i.test(`${p.category || ''} ${p.subcategory || ''}`);

const INFO = [
  { icon: Wallet, title: 'Cash on delivery', note: 'Pay at your door' },
  { icon: Truck, title: 'Free delivery', note: 'Over PKR 2,000' },
  { icon: Mic, title: 'Order by voice', note: 'Urdu or English' },
];

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, onAddToCart }) => {
  const [qty, setQty] = useState(1);
  const [imageError, setImageError] = useState(false);

  // a new product always starts again at 1
  useEffect(() => {
    setQty(1);
    setImageError(false);
  }, [product?.id]);

  if (!product) return null;

  const isOutOfStock = product.stock === 0;
  const isPriceUnavailable = product.price == null;

  const unitPrice = product.price ?? 0;
  const totalPrice = unitPrice * qty;
  const canBuy = !isOutOfStock && !isPriceUnavailable;
  const fresh = isFreshProduce(product);

  const handleConfirm = () => {
    if (isOutOfStock || isPriceUnavailable) return;

    onAddToCart(product, qty);
    setQty(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row max-h-[94dvh] sm:max-h-[92vh] md:h-[580px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur border border-[#e0f4e7] hover:bg-[#e0f4e7] text-[#2a6b43] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ---------- left: the picture fills the panel from the top down to the category row ---------- */}
        <div className="md:w-[46%] shrink-0 flex flex-col bg-gradient-to-br from-[#f3fbf6] via-white to-[#e0f4e7] md:border-r border-[#e0f4e7]">
          <div className="db-gimg fill relative flex-1 min-h-[270px] sm:min-h-[320px]">
            {product.image && !imageError ? (
              <FitImage
                src={product.image}
                alt={product.name}
                pad={0.1}
                onError={() => setImageError(true)}
                className="mix-blend-multiply"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-3xl bg-[#e0f4e7] border border-[#b3e4c4] flex items-center justify-center text-[#148a4c] text-5xl">
                  {product.icon || '🛒'}
                </div>
              </div>
            )}

            {/* badges on the picture */}
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
              {isOutOfStock ? (
                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">Out of stock</span>
              ) : (
                fresh && (
                  <span className="px-2.5 py-1 rounded-full bg-white/90 text-[#2a6b43] border border-[#b3e4c4] text-[11px] font-bold flex items-center gap-1 shadow-sm">
                    <Leaf className="w-3.5 h-3.5 text-[#148a4c] fill-[#b3e4c4]" strokeWidth={2.2} /> Fresh
                  </span>
                )
              )}
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-center flex-wrap gap-2 border-t border-[#e0f4e7] bg-white/70 backdrop-blur">
            <span className="text-xs font-bold text-[#2a6b43] bg-[#e0f4e7] px-3 py-1 rounded-full">{product.category}</span>
            {product.subcategory && (
              <span className="text-xs font-semibold text-[#4d7a5c] bg-white border border-[#b3e4c4] px-3 py-1 rounded-full">{product.subcategory}</span>
            )}
          </div>
        </div>

        {/* ---------- right: details ---------- */}
        <div className="flex-1 min-w-0 p-5 sm:p-8 flex flex-col gap-5 text-left md:overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-2 pr-10">
              <span className="text-[11px] font-bold text-[#148a4c] uppercase tracking-wider">AssanMart</span>
              {isOutOfStock ? (
                <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Out of Stock</span>
              ) : (
                <span className="text-[11px] font-bold text-[#2a6b43] bg-[#e0f4e7] px-2 py-0.5 rounded-full border border-[#b3e4c4] flex items-center gap-1">
                  <Check className="w-3 h-3" /> In Stock
                </span>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-[#1f5233] leading-snug">{product.name}</h3>
            <p className="text-sm text-[#4d7a5c] font-medium mt-1.5">
              Pack size: <strong className="text-[#2a6b43]">{product.size || 'Standard pack'}</strong>
            </p>
          </div>

          {/* price */}
          <div className="rounded-xl bg-gradient-to-r from-[#f3fbf6] to-[#e0f4e7] border border-[#b3e4c4] px-4 py-3 flex items-end justify-between gap-3">
            <div>
              <span className="text-xs text-[#4d7a5c] font-semibold block">Price per pack</span>
              <span className="text-2xl font-extrabold text-[#1f5233] leading-none">{isPriceUnavailable ? 'N/A' : `PKR ${product.price?.toLocaleString()}`}</span>
            </div>
            {qty > 1 && canBuy && (
              <div className="text-right">
                <span className="text-xs text-[#4d7a5c] font-semibold block">Total ({qty})</span>
                <span className="text-xl font-black text-[#148a4c]">PKR {totalPrice.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* quantity */}
          {canBuy && (
            <div>
              <label className="text-xs font-bold text-[#4d7a5c] block mb-2">Quantity</label>
              <div className="inline-flex items-center rounded-full border border-[#b3e4c4] bg-white p-1 shadow-sm">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-9 h-9 rounded-full bg-[#f3fbf6] hover:bg-[#e0f4e7] flex items-center justify-center text-[#2a6b43] transition-colors cursor-pointer active:scale-90"
                  aria-label="Less"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-black text-lg text-[#1f5233]">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(99, qty + 1))}
                  className="w-9 h-9 rounded-full bg-[#1daa61] hover:bg-[#148a4c] flex items-center justify-center text-white transition-colors cursor-pointer active:scale-90"
                  aria-label="More"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* why order here */}
          <div className="grid grid-cols-3 gap-2 mt-auto">
            {INFO.map((i) => (
              <div key={i.title} className="rounded-2xl bg-[#f3fbf6] border border-[#e0f4e7] px-2 py-3 text-center">
                <span className="mx-auto w-8 h-8 rounded-full bg-white text-[#148a4c] flex items-center justify-center shadow-sm">
                  <i.icon className="w-4 h-4" />
                </span>
                <p className="mt-1.5 text-[11px] font-bold text-[#2a6b43] leading-tight">{i.title}</p>
                <p className="text-[10px] text-[#4d7a5c] leading-tight mt-0.5">{i.note}</p>
              </div>
            ))}
          </div>

          {/* add to cart */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canBuy}
            className={`w-full h-12 rounded-full font-bold text-[15px] tracking-wide flex items-center justify-center transition-all cursor-pointer ${
              canBuy
                ? 'bg-gradient-to-r from-[#1daa61] to-[#3fc27b] hover:from-[#148a4c] hover:to-[#1daa61] text-white shadow-lg shadow-[#1daa61]/30 active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isOutOfStock ? 'Out of stock' : isPriceUnavailable ? 'Unavailable' : 'Add to Cart'}
          </button>

        </div>
      </div>
    </div>
  );
};