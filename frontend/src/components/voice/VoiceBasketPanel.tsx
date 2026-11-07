import React from 'react';
import { ShoppingBag, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';
import { VoiceCart } from '../../services/voiceApi';

interface VoiceBasketPanelProps {
  cart: VoiceCart;
  busy: boolean;
  message: string;
  onDismissMessage: () => void;
  onQty: (id: number, qty: number) => void;
  onConfirm: () => void;
  onDecline: () => void;
  onSyncToMainCart?: () => void;
}

const PENDING_TEXT: Record<string, string> = {
  brand: 'Choosing brand…',
  type: 'Choosing item type…',
  variant: 'Choosing product variant…',
  quantity: 'Choosing quantity…',
  waiting: 'Up next in line',
};

export const VoiceBasketPanel: React.FC<VoiceBasketPanelProps> = ({
  cart,
  busy,
  message,
  onDismissMessage,
  onQty,
  onConfirm,
  onDecline,
  onSyncToMainCart,
}) => {
  const items = cart.items || [];
  const pending = cart.pending || [];
  const isEmpty = items.length === 0 && pending.length === 0;

  return (
    <aside className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-emerald-950/5 border border-emerald-100 flex flex-col min-h-[460px] max-h-[82vh]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-emerald-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#064e3b] flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#064e3b]">Voice Basket</h2>
            <p className="text-xs text-slate-500">Live spoken items</p>
          </div>
        </div>

        <span className="min-w-6 h-6 px-2 rounded-full bg-[#064e3b] text-white text-xs font-bold flex items-center justify-center">
          {cart.count}
        </span>
      </div>

      {/* Temporary Notification Banner */}
      {message && (
        <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
          <span>{message}</span>
          <button
            type="button"
            onClick={onDismissMessage}
            className="text-amber-800 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Basket Items List */}
      <div className="flex-1 overflow-y-auto my-3 pr-1 space-y-2.5">
        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-400 flex items-center justify-center mb-2">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Your basket is empty</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Speak what you need (e.g. "2 kilo chawal") and it will appear here live.
            </p>
          </div>
        )}

        {items.map((item) => (
          <article
            key={item.id}
            className="flex items-center gap-3 p-2.5 rounded-2xl border border-emerald-100/90 bg-[#fafdfa] hover:bg-white transition-all shadow-2xs"
          >
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-xl bg-white border border-emerald-100/80 p-1 flex items-center justify-center shrink-0 overflow-hidden">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
              ) : (
                <ShoppingBag className="w-6 h-6 text-emerald-300" />
              )}
            </div>

            {/* Title & Unit */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                {item.name}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {item.unit || 'Pack'} · Rs. {Math.round(item.price_per_unit)}
              </p>

              {/* Stepper */}
              <div className="inline-flex items-center gap-2 mt-1.5 bg-white border border-emerald-200 rounded-full px-2 py-0.5">
                <button
                  type="button"
                  onClick={() => onQty(item.id, item.quantity - 1)}
                  className="w-4 h-4 text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center justify-center cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="text-xs font-bold text-[#064e3b] min-w-[14px] text-center">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQty(item.id, item.quantity + 1)}
                  className="w-4 h-4 text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center justify-center cursor-pointer"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total and Trash */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-xs font-extrabold text-[#064e3b]">
                Rs. {Math.round(item.line_total)}
              </span>
              <button
                type="button"
                onClick={() => onQty(item.id, 0)}
                className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        ))}

        {/* Pending Items */}
        {pending.length > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-2">
              Queue in Progress
            </h4>
            <div className="space-y-1.5">
              {pending.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="font-semibold text-slate-800 capitalize">{p.label}</span>
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium">
                    {PENDING_TEXT[p.status] || p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Confirmation */}
      <div className="pt-3 border-t border-emerald-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Total Amount:</span>
          <span className="text-base font-extrabold text-[#064e3b]">
            Rs. {Math.round(cart.total)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Payment: Cash on Delivery (COD)</span>
        </div>

        {cart.awaiting_confirmation ? (
          <div className="mt-2 p-3 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col gap-2">
            <p className="text-xs font-bold text-amber-950 text-center">
              Confirm your order for Rs. {Math.round(cart.total)}?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="h-9 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {busy ? 'Placing…' : 'Yes, Confirm'}
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                className="h-9 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold"
              >
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 mt-1">
            <button
              type="button"
              onClick={onConfirm}
              disabled={items.length === 0 || busy}
              className="w-full h-10 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Review & Place Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onSyncToMainCart && items.length > 0 && (
              <button
                type="button"
                onClick={onSyncToMainCart}
                className="w-full h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] text-xs font-semibold transition-colors border border-emerald-200"
              >
                Sync with Store Cart
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
