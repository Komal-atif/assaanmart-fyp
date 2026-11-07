import React from 'react';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, Truck, CheckCircle2 } from 'lucide-react';
import { CartItem } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onChangeQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}

const FREE_DELIVERY_THRESHOLD = 2000;
const DELIVERY_FEE = 150;

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onChangeQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const progressPercent = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Drawer Header */}
          <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Your Grocery Cart</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {cart.reduce((total, item) => total + item.quantity, 0)} items
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Goal Bar */}
          <div className="p-4 px-6 bg-emerald-50/50 border-b border-emerald-100">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-950 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-700" />
                {remainingForFree === 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> You unlocked FREE delivery!
                  </span>
                ) : (
                  <span>
                    Add <strong>PKR {remainingForFree.toLocaleString()}</strong> more for FREE delivery
                  </span>
                )}
              </span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full h-2 bg-emerald-200/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Your basket is empty</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Start adding farm-fresh produce, daily dairy, cooking oil or use voice ordering.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="pt-4 first:pt-0 flex gap-4 items-center">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-center shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-emerald-600/70" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-bold text-slate-900 truncate">{item.name}</h5>
                    <p className="text-xs text-slate-500 font-medium">
                      {item.size} · PKR {item.price?.toLocaleString()} each
                    </p>
                    
                    {/* Stepper */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                        <button
                          onClick={() => onChangeQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onChangeQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-slate-900 block">
                      PKR {((item.price || 0) * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer / Checkout summary */}
          {cart.length > 0 && (
            <div className="p-5 px-6 border-t border-slate-100 bg-slate-50/80 space-y-4">
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Cart Subtotal</span>
                  <span className="font-semibold text-slate-900">PKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Delivery</span>
                  <span className="font-semibold text-slate-900">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      `PKR ${deliveryFee}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span className="text-emerald-700 font-sans">PKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onProceedToCheckout}
                  className="flex-1 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onClearCart}
                  className="p-3 text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  title="Empty Cart"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
