import React from 'react';
import { X, Heart, Plus, Minus, Package } from 'lucide-react';
import { Product } from '../types';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];                                  // the favourite products
  cart: { [id: string]: number };
  onAddToCart: (product: Product, eventElement: HTMLElement) => void;
  onChangeQuantity: (productId: string, delta: number) => void;
  onToggleFavorite: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  products,
  cart,
  onAddToCart,
  onChangeQuantity,
  onToggleFavorite,
  onQuickView,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose}>
      <aside
        className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
        aria-label="My favourites"
      >
        {/* header */}
        <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            <h3 className="text-lg font-black text-slate-900">My Favourites</h3>
            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5">{products.length}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-500 px-6">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center">
                <Heart className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-slate-800">No favourites yet</p>
              <p className="text-xs">Tap the heart on any product to save it here.</p>
            </div>
          ) : (
            products.map((p) => {
              const qty = cart[p.id] || 0;
              const out = p.stock === 0 || p.price == null;
              return (
                <div key={p.id} className="flex items-center gap-3 border border-slate-200 rounded-2xl p-3">
                  <button
                    onClick={() => onQuickView(p)}
                    className="w-16 h-16 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                    aria-label={`View ${p.name}`}
                  >
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-contain" /> : <Package className="w-6 h-6 text-[#064e3b]/70" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.size}</p>
                    <p className="text-sm font-black text-[#064e3b] mt-0.5">{p.price != null ? `Rs. ${Math.round(p.price).toLocaleString('en-PK')}` : 'Price unavailable'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => onToggleFavorite(p)}
                      className="w-7 h-7 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center cursor-pointer hover:bg-rose-100"
                      title="Remove from favourites"
                      aria-label="Remove from favourites"
                    >
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                    </button>
                    {out ? (
                      <span className="text-[11px] font-semibold text-slate-400">Out of stock</span>
                    ) : qty === 0 ? (
                      <button
                        onClick={(e) => onAddToCart(p, e.currentTarget)}
                        className="px-3 h-8 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    ) : (
                      <div className="h-8 rounded-xl bg-[#064e3b] text-white flex items-center gap-1 px-1">
                        <button onClick={() => onChangeQuantity(p.id, -1)} className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white hover:text-[#064e3b] flex items-center justify-center cursor-pointer" aria-label="Remove one">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-black">{qty}</span>
                        <button onClick={(e) => onAddToCart(p, e.currentTarget)} className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white hover:text-[#064e3b] flex items-center justify-center cursor-pointer" aria-label="Add one">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};