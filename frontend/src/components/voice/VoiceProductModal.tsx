import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronRight, SkipForward, Mic, Volume2 } from 'lucide-react';

/* The selection pop-up: brands, types, sizes and quantity are chosen here (tap), or just by speaking.
   It opens by itself whenever the agent offers choices and closes when the choice is made. */

interface Props {
  options: any | null;                       // VoiceOptions from the server
  phase: 'listening' | 'speaking' | 'thinking' | 'off' | string;
  onSelect: (value: string, qty?: number | null) => void;
}

const money = (n?: number, t?: string) => (t ? t : typeof n === 'number' ? `Rs. ${Math.round(n).toLocaleString()}` : '');

export const VoiceProductModal: React.FC<Props> = ({ options, phase, onSelect }) => {
  const [hidden, setHidden] = useState(false);
  const items: any[] = useMemo(() => options?.items ?? [], [options]);
  const isQty = options?.stage === 'quantity';
  const key = useMemo(() => JSON.stringify([options?.stage, options?.title, items.map((i) => i.value)]), [options, items]);

  // a new set of choices always opens the pop-up again
  useEffect(() => setHidden(false), [key]);

  const show = !!options && (items.length > 0 || isQty) && !hidden;
  if (!show) return null;

  const suggested = options?.suggested_qty ?? 1;
  const product = options?.product;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-[#0b2a18]/45 backdrop-blur-[2px] animate-[vpm-fade_.2s_ease-out]">
      <div className="relative w-full sm:max-w-3xl max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-gradient-to-b from-white to-[#f3fbf6] border border-[#b3e4c4] shadow-[0_30px_80px_-20px_rgba(20,138,76,.55)] animate-[vpm-pop_.35s_cubic-bezier(.3,1.3,.5,1)]">
        {/* header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#1DAA61] text-white flex items-center justify-center shadow">
            {phase === 'speaking' ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-[#1f5233] leading-tight" dir="auto">
              {options?.title || (isQty ? 'How many?' : 'Choose one')}
            </h3>
            <p className="text-xs text-[#4d7a5c] mt-0.5">Tap an option or say it out loud</p>
          </div>
          <button onClick={() => setHidden(true)} aria-label="Hide choices" className="w-8 h-8 shrink-0 rounded-full bg-white border border-[#b3e4c4] text-[#2a6b43] hover:bg-[#e0f4e7] flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {isQty ? (
            <div className="flex flex-col items-center gap-4 py-2">
              {product && (
                <div className="flex items-center gap-3 w-full max-w-md rounded-2xl bg-white border border-[#b3e4c4] p-3">
                  <div className="w-20 h-20 rounded-xl bg-[#f3fbf6] flex items-center justify-center overflow-hidden shrink-0">
                    {product.image_url ? <img src={product.image_url} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" /> : <span className="text-3xl">🛒</span>}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="font-extrabold text-[#1f5233] leading-tight line-clamp-2" dir="auto">{product.label || product.name}</p>
                    <p className="text-sm text-[#4d7a5c] mt-1">{[product.size, money(product.price ?? product.unit_price, product.price_text)].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => onSelect('', suggested)}
                className="px-6 py-3 rounded-full bg-[#1DAA61] hover:bg-[#148a4c] text-white font-extrabold flex items-center gap-2 shadow-lg active:scale-95 transition cursor-pointer"
              >
                Keep {suggested} &amp; go to next item <SkipForward className="w-4 h-4" />
              </button>
              <div className="flex flex-wrap justify-center gap-2">
                {(items.length ? items : [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: '', qty: n }))).map((it: any, i: number) => (
                  <button
                    key={`${it.value}-${i}`}
                    onClick={() => onSelect(it.value, it.qty ?? null)}
                    className="min-w-12 px-4 py-2 rounded-full bg-white border border-[#b3e4c4] text-sm font-extrabold text-[#2a6b43] hover:bg-[#1DAA61] hover:text-white hover:border-[#1DAA61] transition-colors cursor-pointer"
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((it: any, i: number) => (
                <button
                  key={`${it.value}-${i}`}
                  onClick={() => onSelect(it.value)}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="vpm-card group relative text-left rounded-2xl bg-white border border-[#b3e4c4] hover:border-[#1DAA61] hover:-translate-y-1 hover:shadow-xl p-3 transition-all cursor-pointer"
                >
                  <span className="absolute top-2 left-2 z-[1] w-6 h-6 rounded-full bg-[#1DAA61] text-white text-xs font-black flex items-center justify-center shadow">{i + 1}</span>
                  <div className="h-24 sm:h-28 rounded-xl bg-[#f3fbf6] flex items-center justify-center overflow-hidden">
                    {it.image_url ? (
                      <img src={it.image_url} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />
                    ) : (
                      <span className="text-4xl">🛒</span>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] font-extrabold text-[#1f5233] leading-tight line-clamp-2" dir="auto">{it.label || it.name}</p>
                  {(it.size || it.price_text || it.price != null) && (
                    <p className="mt-1 text-xs text-[#4d7a5c]">{[it.size, money(it.price, it.price_text)].filter(Boolean).join(' · ')}</p>
                  )}
                </button>
              ))}
              {options?.next_value && (
                <button onClick={() => onSelect(options.next_value)} className="rounded-2xl border-2 border-dashed border-[#96d9ae] text-[#2a6b43] text-sm font-bold flex flex-col items-center justify-center gap-1 min-h-32 hover:bg-white cursor-pointer">
                  More <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes vpm-fade{from{opacity:0}to{opacity:1}}
        @keyframes vpm-pop{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes vpm-card{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
        .vpm-card{animation:vpm-card .4s cubic-bezier(.3,1.4,.5,1) both}
        @media (prefers-reduced-motion:reduce){.vpm-card{animation:none}}
      `}</style>
    </div>
  );
};