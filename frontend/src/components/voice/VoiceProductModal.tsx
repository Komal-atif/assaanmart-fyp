import React, { useState, useEffect } from 'react';
import { X, Check, Volume2, ShoppingBag } from 'lucide-react';
import { VoiceOptions, VoiceOptionItem } from '../../services/voiceApi';
import { VoicePhase } from './VoiceAvatar';

interface VoiceProductModalProps {
  options: VoiceOptions | null;
  phase: VoicePhase;
  onSelect: (value: string, qty?: number | null) => void;
}

const STEPS = ['Brand', 'Product', 'Quantity'];
const STEP_OF: Record<string, number> = { brand: 0, type: 1, variant: 1, quantity: 2 };

const STATUS_TEXT: Record<VoicePhase, string> = {
  listening: 'Listening — say a brand, "next" or "cheapest"',
  speaking: 'Reading available choices aloud…',
  thinking: 'Processing your selection…',
  off: 'Microphone is paused — you can still tap directly',
};

export const VoiceProductModal: React.FC<VoiceProductModalProps> = ({
  options,
  phase,
  onSelect,
}) => {
  const [qty, setQty] = useState(1);
  const [dismissed, setDismissed] = useState(false);

  // Every new question re-opens the pop-up
  useEffect(() => {
    setDismissed(false);
    setQty(1);
  }, [options]);

  useEffect(() => {
    if (!options || dismissed) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, dismissed]);

  if (!options || dismissed) return null;

  const {
    stage,
    title,
    items = [],
    product,
    next_value: nextValue,
    total,
    paged,
    up_next: upNext = [],
  } = options;
  const step = STEP_OF[stage] ?? 0;
  const isSpeaking = phase === 'speaking';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={() => setDismissed(true)}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-emerald-100 flex items-start justify-between bg-emerald-50/40">
          <div>
            {/* Step Indicators */}
            <ol className="flex items-center gap-3 mb-1.5 text-xs font-bold text-slate-400">
              {STEPS.map((s, idx) => (
                <li
                  key={s}
                  className={`flex items-center gap-1.5 ${
                    idx === step
                      ? 'text-[#064e3b]'
                      : idx < step
                      ? 'text-emerald-600'
                      : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      idx === step
                        ? 'bg-[#064e3b] text-white'
                        : idx < step
                        ? 'bg-emerald-200 text-[#064e3b]'
                        : 'border border-slate-300'
                    }`}
                  >
                    {idx < step ? '✓' : idx + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            <h2 className="text-lg font-bold text-[#064e3b] capitalize">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {stage === 'brand' && `${total || items.length} brands available — tap or speak one`}
              {stage === 'type' && 'Choose which type you need'}
              {stage === 'variant' && `${total || items.length} variants — tap or speak size/name`}
              {stage === 'quantity' && 'How many packs would you like?'}
            </p>
            {upNext.length > 0 && (
              <span className="inline-block mt-1 text-[11px] px-2 py-0.5 bg-emerald-100 text-[#064e3b] font-medium rounded-full">
                Then: {upNext.join(', ')}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-8 h-8 rounded-full bg-white hover:bg-emerald-100 text-slate-500 hover:text-emerald-900 border border-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Stage: Brand or Type List */}
          {(stage === 'brand' || stage === 'type') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {items.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => onSelect(b.value)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    b.spoken
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-200'
                      : 'border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/50'
                  }`}
                >
                  <span className="w-8 h-8 rounded-full bg-emerald-100 text-[#064e3b] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    {String(b.label).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {b.label}
                    </span>
                    {b.spoken && isSpeaking && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Volume2 className="w-3 h-3 animate-pulse" />
                        Speaking
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Stage: Variant Cards */}
          {stage === 'variant' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((v) => (
                <button
                  key={v.id || v.value}
                  type="button"
                  onClick={() => onSelect(v.value)}
                  className={`flex flex-col p-3 rounded-2xl border text-left transition-all cursor-pointer relative group ${
                    v.spoken
                      ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200'
                      : 'border-slate-200 hover:border-emerald-300 bg-white hover:shadow-xs'
                  }`}
                >
                  {/* Image container */}
                  <div className="w-full aspect-4/3 rounded-xl bg-white border border-slate-100 p-2 flex items-center justify-center overflow-hidden mb-2">
                    {v.image_url ? (
                      <img
                        src={v.image_url}
                        alt={v.name || v.label}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-emerald-300" />
                    )}
                  </div>

                  {v.spoken && isSpeaking && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-bold text-[10px] flex items-center gap-1 shadow-xs">
                      <Volume2 className="w-2.5 h-2.5 animate-pulse" />
                      Reading
                    </span>
                  )}

                  <span className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[32px]">
                    {v.label}
                  </span>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">{v.size || 'Pack'}</span>
                    <span className="text-xs font-extrabold text-[#064e3b]">
                      {v.price_text || `Rs. ${v.price}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Stage: Quantity */}
          {stage === 'quantity' && product && (
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <div className="w-32 h-32 rounded-2xl bg-white border border-emerald-200 p-2 flex items-center justify-center shrink-0">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name || product.label}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ShoppingBag className="w-12 h-12 text-emerald-400" />
                )}
              </div>

              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-base font-bold text-[#064e3b]">
                  {product.name || product.label}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{product.size}</p>
                <p className="text-sm font-extrabold text-emerald-800 mt-0.5">
                  {product.price_text || `Rs. ${product.price}`} each
                </p>

                {/* Quantity Stepper */}
                <div className="mt-4 flex items-center gap-3 justify-center sm:justify-start">
                  <div className="inline-flex items-center border border-emerald-300 rounded-full bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-8 h-8 rounded-full bg-emerald-100 text-[#064e3b] font-bold text-sm flex items-center justify-center hover:bg-emerald-200"
                    >
                      −
                    </button>
                    <span className="px-4 text-sm font-extrabold text-slate-800">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(Math.min(100, qty + 1))}
                      className="w-8 h-8 rounded-full bg-emerald-100 text-[#064e3b] font-bold text-sm flex items-center justify-center hover:bg-emerald-200"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-xs text-slate-600">
                    Total: <strong className="text-slate-900 text-sm">Rs. {Math.round((product.price || 0) * qty)}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3.5 border-t border-emerald-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{STATUS_TEXT[phase]}</span>
          </div>

          <div>
            {stage === 'quantity' ? (
              <button
                type="button"
                onClick={() => onSelect('', qty)}
                className="h-10 px-6 rounded-full bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Add to Basket
              </button>
            ) : nextValue ? (
              <button
                type="button"
                onClick={() => onSelect(nextValue)}
                className="h-9 px-4 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#064e3b] text-xs font-bold transition-colors"
              >
                Next Choices →
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
};
