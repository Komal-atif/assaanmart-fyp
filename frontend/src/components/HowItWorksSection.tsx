import React, { useEffect, useState } from 'react';
import { Mic, ShoppingCart, Check, Camera } from 'lucide-react';

/* "How AssanMart works": three steps on the left, a live voice demo on the right.
   - the active step follows the demo (speaking -> review cart -> confirmed)
   - all animation CSS is inside this file, so it does not depend on global CSS classes
   - uses the same greens as the rest of the site; mobile friendly
   LandingPage passes onOpenVoice / onOpenImageScanner, they power the two buttons under the steps. */

interface HowItWorksProps {
  onOpenVoice?: () => void;
  onOpenImageScanner?: () => void;
}

const PHRASES = [
  {
    text: 'Two kilos of tomatoes and a litre of milk',
    items: [
      { name: 'Tomatoes', qty: '2 kg' },
      { name: 'Milk', qty: '1 L' },
    ],
  },
  {
    text: 'One kilo of apples and half a kilo of grapes',
    items: [
      { name: 'Apples', qty: '1 kg' },
      { name: 'Grapes', qty: '500 g' },
    ],
  },
  {
    text: 'Add a dozen eggs and a fresh loaf of bread',
    items: [
      { name: 'Eggs', qty: '1 dozen' },
      { name: 'Bread', qty: '1 loaf' },
    ],
  },
];

const STEPS = [
  { icon: Mic, title: 'Speak or browse', text: 'Say what you need, or add products yourself from any category.' },
  { icon: ShoppingCart, title: 'Review your cart', text: 'Check items and quantities. Correct anything by voice or with a tap.' },
  { icon: Check, title: 'Confirm your order', text: 'Confirm when you’re happy and AssanMart handles the rest.' },
];

type Phase = 'typing' | 'review' | 'confirmed';

export const HowItWorks: React.FC<HowItWorksProps> = ({ onOpenVoice, onOpenImageScanner }) => {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [reduce] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const cur = PHRASES[idx];

  useEffect(() => {
    if (reduce) return; // static demo for people who asked for less motion
    let t: number;
    if (phase === 'typing') {
      t = chars < cur.text.length
        ? window.setTimeout(() => setChars((c) => c + 1), 45)
        : window.setTimeout(() => setPhase('review'), 350);
    } else if (phase === 'review') {
      t = window.setTimeout(() => setPhase('confirmed'), 2000);
    } else {
      t = window.setTimeout(() => {
        setIdx((p) => (p + 1) % PHRASES.length);
        setChars(0);
        setPhase('typing');
      }, 2300);
    }
    return () => window.clearTimeout(t);
  }, [phase, chars, idx, reduce, cur.text.length]);

  const shownPhase: Phase = reduce ? 'confirmed' : phase;
  const shownText = reduce ? cur.text : cur.text.slice(0, chars);
  const active = shownPhase === 'typing' ? 0 : shownPhase === 'review' ? 1 : 2;
  const showItems = shownPhase !== 'typing';

  const title = shownPhase === 'typing' ? 'Listening…' : shownPhase === 'review' ? 'Added to your cart' : 'Order confirmed';
  const sub = shownPhase === 'typing' ? 'Speak naturally' : shownPhase === 'review' ? 'Review before you confirm' : 'Pay cash on delivery';

  return (
    <section id="how-it-works" className="scroll-mt-24">
      {/* heading */}
      <div className="text-center mb-8 sm:mb-10">
        <span className="inline-block px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-[11px] font-bold tracking-wide">SIMPLE &amp; EASY</span>
        <h2 className="mt-3 text-2xl sm:text-4xl font-black text-[#1f5233] tracking-tight">How AssanMart works</h2>
        <p className="mt-2.5 text-sm sm:text-base text-[#4d7a5c] max-w-xl mx-auto leading-relaxed">
          Getting your groceries has never been this easy. Three steps, and you stay in control the whole way.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        {/* steps */}
        <div className="lg:col-span-6">
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const on = active === i;
              return (
                <div
                  key={s.title}
                  className={`hw-step flex items-start gap-4 rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${
                    on ? 'bg-white border-[#1DAA61] shadow-lg shadow-[#1DAA61]/10' : 'bg-white/70 border-[#e0f4e7]'
                  }`}
                >
                  <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                      on ? 'bg-[#1DAA61] text-white shadow-md shadow-[#1DAA61]/30' : 'bg-[#e0f4e7] text-[#1DAA61]'
                    }`}
                  >
                    <s.icon className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#1f5233]">{s.title}</h3>
                    <p className="text-xs sm:text-sm text-[#4d7a5c] mt-1 leading-relaxed">{s.text}</p>
                  </div>
                  <span className={`text-sm font-black tabular-nums select-none transition-colors ${on ? 'text-[#1DAA61]' : 'text-[#b3e4c4]'}`}>
                    0{i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {(onOpenVoice || onOpenImageScanner) && (
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              {onOpenVoice && (
                <button
                  onClick={onOpenVoice}
                  className="h-12 px-6 rounded-full bg-gradient-to-r from-[#1DAA61] to-[#3fc27b] hover:from-[#148a4c] hover:to-[#1DAA61] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1DAA61]/25 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mic className="w-5 h-5" /> Try it by voice
                </button>
              )}
              {onOpenImageScanner && (
                <button
                  onClick={onOpenImageScanner}
                  className="h-12 px-6 rounded-full bg-white text-[#2a6b43] font-bold text-sm sm:text-base border-2 border-[#b3e4c4] hover:border-[#1DAA61] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-5 h-5" /> Upload list photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* live demo */}
        <div className="lg:col-span-6">
          <div className="rounded-[28px] border border-[#cfeedb] bg-gradient-to-br from-[#f3fbf6] via-white to-[#e0f4e7] p-4 sm:p-7 shadow-[0_24px_50px_-28px_rgba(29,170,97,.55)] flex flex-col gap-4 min-h-[340px] sm:min-h-[380px]">
            {/* header: mic orb + status + equalizer */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`hw-orb ${shownPhase === 'typing' ? 'live' : ''}`}>
                  <i />
                  <i />
                  {shownPhase === 'confirmed' ? <Check className="w-5 h-5 text-white relative z-10 stroke-[3]" /> : <Mic className="w-5 h-5 text-white relative z-10" />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-[#1f5233] leading-tight truncate">{title}</h4>
                  <p className="text-xs text-[#4d7a5c] mt-0.5 truncate">{sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 h-6 shrink-0" aria-hidden="true">
                {[0.1, 0.35, 0.2, 0.45, 0.28].map((d, k) => (
                  <span key={k} className={`hw-bar ${shownPhase === 'typing' ? '' : 'off'}`} style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>

            {/* what the customer says */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[#e0f4e7] min-h-[84px] flex items-center">
              <p className="text-[15px] sm:text-lg font-medium text-[#1f5233] leading-snug">
                “{shownText}
                {shownPhase === 'typing' && <span className="hw-caret" />}”
              </p>
            </div>

            {/* what AssanMart understood */}
            <div className="space-y-2.5 min-h-[104px]">
              {showItems ? (
                <>
                  {cur.items.map((item, k) => (
                    <div
                      key={`${idx}-${item.name}`}
                      className="hw-in bg-white rounded-xl py-3 px-4 shadow-sm border border-[#e0f4e7] flex items-center justify-between"
                      style={{ animationDelay: `${k * 120}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#1DAA61] text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                        <span className="text-sm font-bold text-[#1f5233]">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#4d7a5c]">{item.qty}</span>
                    </div>
                  ))}
                  {shownPhase === 'confirmed' && (
                    <div className="hw-in rounded-xl py-2.5 px-4 bg-[#1DAA61] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#1DAA61]/25">
                      <Check className="w-4 h-4 stroke-[3]" /> Order confirmed
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs sm:text-sm font-medium text-[#4d7a5c] italic p-2">Listening for grocery items and quantities…</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hw-orb{position:relative;width:48px;height:48px;border-radius:999px;background:linear-gradient(135deg,#1DAA61,#3fc27b);display:grid;place-items:center;flex:none;box-shadow:0 8px 18px -6px rgba(29,170,97,.6)}
        .hw-orb i{position:absolute;inset:0;border-radius:999px;border:2px solid #1DAA61;opacity:0;pointer-events:none}
        .hw-orb.live i{animation:hw-rip 2s ease-out infinite}
        .hw-orb.live i:nth-child(2){animation-delay:1s}
        @keyframes hw-rip{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.7);opacity:0}}
        .hw-bar{display:block;width:4px;height:30%;border-radius:4px;background:#1DAA61;animation:hw-eq 1s ease-in-out infinite}
        .hw-bar.off{animation:none;height:22%;opacity:.45}
        @keyframes hw-eq{0%,100%{height:25%}50%{height:100%}}
        .hw-caret{display:inline-block;width:2px;height:1em;background:#1DAA61;margin-left:3px;vertical-align:text-bottom;animation:hw-blink 1s steps(2) infinite}
        @keyframes hw-blink{50%{opacity:0}}
        .hw-in{animation:hw-in .4s cubic-bezier(.3,1.2,.5,1) both}
        @keyframes hw-in{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.hw-orb i,.hw-bar,.hw-caret,.hw-in{animation:none}}
      `}</style>
    </section>
  );
};

/** old name, kept so existing imports keep working */
export const HowItWorksSection = HowItWorks;
export default HowItWorks;