import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Volume2, Sparkles, RotateCcw } from 'lucide-react';
import { AssistantBot, BotState, HeldItem } from './AssistantBot';
import type { VoicePhase } from './VoiceAvatar';

/* Voice stage.
   Top: title, "You said: ..." (shown correctly for Urdu and English) and a status pill.
   Middle: the assistant at a moderate, screen-based size, centred in the green card that fills the window height.
   No circle behind it, no spinning ring or waves while thinking. It speaks, listens, holds the products it
   offers in BOTH hands while the customer chooses, and hands over the item that was just added to the basket
   (without dancing). The floor shadow is shown under it.                                                   */

interface StageProps {
  phase: VoicePhase;
  started: boolean;
  reply: string;
  heard: string;
  lang: 'english' | 'urdu' | null;
  notice: string;
  options: any | null;      // VoiceOptions
  cart: any;                // VoiceCart
  levelRef?: React.MutableRefObject<any>;
  onPick: (value: string, qty?: number | null) => void;
  interrupt: boolean;
  onInterruptChange: (v: boolean) => void;
  onRetry: () => void;
}

const money = (n?: number, t?: string) => (t ? t : typeof n === 'number' ? `Rs. ${Math.round(n).toLocaleString()}` : '');

const toHeld = (it: any): HeldItem => ({
  image: it?.image_url || null,
  label: it?.label || it?.name || '',
  price: money(it?.price ?? it?.unit_price, it?.price_text),
  emoji: '🛒',
});

const STATUS: Record<string, { text: string; cls: string }> = {
  listening: { text: 'Listening…', cls: 'bg-[#1DAA61] text-white' },
  speaking: { text: 'Speaking…', cls: 'bg-[#f59e0b] text-white' },
  thinking: { text: 'One moment…', cls: 'bg-[#7fcf9a] text-white' },
  off: { text: 'Paused', cls: 'bg-[#e0f4e7] text-[#4d7a5c]' },
};

export const VoiceStage: React.FC<StageProps> = ({ phase, reply, heard, notice, options, cart, onPick, onRetry }) => {
  /* ---------- an item entered the basket: the bot passes it on (no dancing) ---------- */
  const prevQty = useRef<Map<string, number>>(new Map());
  const [adding, setAdding] = useState<HeldItem | null>(null);
  const addTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const now = new Map<string, number>();
    let hit: any = null;
    for (const it of cart?.items ?? []) {
      now.set(String(it.id), it.quantity);
      if (it.quantity > (prevQty.current.get(String(it.id)) ?? 0)) hit = it;
    }
    prevQty.current = now;
    if (hit) {
      setAdding(toHeld(hit));
      window.clearTimeout(addTimer.current);
      addTimer.current = window.setTimeout(() => setAdding(null), 1900);
    }
  }, [cart]);
  useEffect(() => () => window.clearTimeout(addTimer.current), []);

  /* ---------- products on offer: the first two are held up, all of them are tappable in the pop-up ---------- */
  const items: any[] = useMemo(() => (options?.items?.length ? options.items : options?.product ? [options.product] : []), [options]);
  const isProducts = items.length > 0 && options?.stage !== 'quantity';
  const holding = !adding && isProducts;
  const holdLeft = holding && items[0] ? toHeld(items[0]) : null;
  // while the quantity is asked the chosen product stays in the right hand
  const qtyProduct = options?.stage === 'quantity' && !adding && options?.product ? toHeld(options.product) : null;
  const holdRight = holding ? (items[1] ? toHeld(items[1]) : items.length === 1 ? toHeld(items[0]) : null) : qtyProduct;

  // no 'happy' pose: when an item is added the bot keeps its normal pose and just passes the item on
  const botState: BotState = phase === 'listening' ? 'listening' : phase === 'speaking' ? 'talking' : holding ? 'showing' : 'idle';
  const status = STATUS[phase] || STATUS.off;

  const hint = phase === 'listening' ? 'Listening… say your item' : reply ? 'Your words will appear here' : 'Connecting to your assistant…';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#e0f4e7] bg-gradient-to-b from-white via-[#f3fbf6] to-[#d6f0e0] flex flex-col flex-1 h-full lg:min-h-[calc(100dvh-10rem)]">
      {/* title, what the customer said, status */}
      <div className="shrink-0 flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3">
        <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-[#e0f4e7] text-[#1DAA61] flex items-center justify-center">
          <Mic className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1 text-left" dir="ltr" role="status" aria-live="polite">
          <h3 className="text-base sm:text-lg font-black text-[#1f5233] leading-tight">Voice order</h3>
          {/* the label stays on the left; the words are isolated so Urdu (right-to-left) never flips the line */}
          <p className="mt-1 text-[13px] sm:text-sm text-[#4d7a5c] leading-snug line-clamp-2 break-words">
            {heard ? (
              <>
                <span className="font-bold text-[#2a6b43]">You said: </span>
                <bdi className="font-semibold text-[#1f5233]">“{heard}”</bdi>
              </>
            ) : (
              <span className="italic">{hint}</span>
            )}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition-colors ${status.cls}`}>
          {phase === 'speaking' ? <Volume2 className="w-3.5 h-3.5" /> : phase === 'listening' ? <Mic className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span className="hidden xs:inline sm:inline">{status.text}</span>
        </span>
      </div>

      <div className="shrink-0 border-t border-[#e0f4e7]" />

      {/* the assistant: a fixed, screen-based size (never taller than ~40% of the screen), centred in the green card */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-2">
        <div className="relative w-full max-w-[400px] px-2" style={{ height: 'min(38dvh, 340px)', minHeight: 190 }}>
          <AssistantBot
            state={botState}
            viewBox="335 215 600 640"
            holdLeft={holdLeft}
            holdRight={holdRight}
            adding={adding}
            className="relative w-full h-full"
          />
        </div>
      </div>

      {/* choices are shown in the selection pop-up (VoiceProductModal) */}

      {notice && (
        <div className="shrink-0 mx-4 sm:mx-5 mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2 flex items-center justify-between gap-2 text-left">
          <span>{notice}</span>
          {phase === 'off' && (
            <button onClick={onRetry} className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-amber-300 hover:bg-amber-100 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> Try again
            </button>
          )}
        </div>
      )}

      <style>{`
        .am-bot .ring{display:none!important}
        @keyframes vs-opt{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
        .vs-opt{animation:vs-opt .4s cubic-bezier(.3,1.4,.5,1) both}
        @media (prefers-reduced-motion:reduce){.vs-opt{animation:none}}
      `}</style>
    </div>
  );
};