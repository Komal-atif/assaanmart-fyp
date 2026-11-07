import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, ShieldCheck, Truck, RotateCcw, Check } from 'lucide-react';
import { Product } from '../types';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [qty, setQty] = useState(1);
  const [imageError, setImageError] = useState(false);

  if (!product) return null;

  const isOutOfStock = product.stock === 0;
  const isPriceUnavailable = product.price == null;
  const unitPrice = product.price || 0;
  const totalPrice = unitPrice * qty;

  const handleConfirm = () => {
    onAddToCart(product, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Column: Visual display */}
        <div className="md:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 relative">
          <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
            {product.image && !imageError ? (
              <img
                src={product.image}
                alt={product.name}
                onError={() => setImageError(true)}
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <ShoppingCart className="w-14 h-14 text-emerald-600/70 stroke-[1.5]" />
              </div>
            )}
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full">
              {product.category}
            </span>
            <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full">
              {product.subcategory}
            </span>
          </div>
        </div>

        {/* Right Column: Information & Actions */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between text-left space-y-6 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                AssanMart Fresh Item
              </span>
              {isOutOfStock ? (
                <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  Out of Stock
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> In Stock
                </span>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {product.name}
            </h3>

            <p className="text-sm text-slate-500 font-medium mt-1">
              Pack Size: <strong className="text-slate-800">{product.size || 'Standard pack'}</strong>
            </p>

            {/* Price Box */}
            <div className="mt-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-emerald-800 font-medium block">Price per pack</span>
                <span className="text-2xl font-black text-slate-900">
                  PKR {isPriceUnavailable ? 'N/A' : product.price?.toLocaleString()}
                </span>
              </div>
              {qty > 1 && (
                <div className="text-right">
                  <span className="text-xs text-emerald-800 font-medium block">Total ({qty} pcs)</span>
                  <span className="text-lg font-black text-emerald-700">
                    PKR {totalPrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quantity Selector */}
          {!isOutOfStock && !isPriceUnavailable && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">Select Quantity:</label>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-bold text-base text-slate-900">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  Max 20 units per order
                </span>
              </div>
            </div>
          )}

          {/* Quality Guarantees */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Genuine brand guarantee or full refund</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Same-day doorstep delivery available</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Hassle-free replacement at time of delivery</span>
            </div>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleConfirm}
            disabled={isOutOfStock || isPriceUnavailable}
            className={`w-full py-3.5 rounded-full font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
              !isOutOfStock && !isPriceUnavailable
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Add {qty} to Cart · PKR {totalPrice.toLocaleString()}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
