import React, { useEffect, useState } from 'react';
import {
  Mic, Camera, Languages, MessageSquareText, ListChecks, PackageCheck, ScanText, Volume2, ImagePlus, Wallet,
  ArrowRight, Check, ShoppingBasket, FileText,
} from 'lucide-react';

interface HowItWorksProps {
  onOpenVoice?: () => void;
  onOpenImageScanner?: () => void;
}

type Step = { icon: React.ElementType; title: string; text: string };
type Flow = 'voice' | 'photo';

const FLOWS: Record<Flow, { label: string; icon: React.ElementType; intro: string; steps: Step[] }> = {
  voice: {
    label: 'Order by voice',
    icon: Mic,
    intro: '',
    steps: [
      { icon: Languages, title: 'Pick your language', text: 'Tap the Voice button and choose English or اردو. Roman Urdu and mixed sentences work too.' },
      { icon: Mic, title: 'Say your list', text: 'For example "2 kilo aata, 1 dozen anday aur ek doodh". Quantities and brands are picked up as you speak.' },
      { icon: Volume2, title: 'Confirm item by item', text: 'AssanMart repeats each product it found. Say yes, no, or choose another size or brand.' },
      { icon: PackageCheck, title: 'Review and checkout', text: 'Your basket opens with everything added. Check it once, then place the order and pay on delivery.' },
    ],
  },
  photo: {
    label: 'Photo + voice',
    icon: Camera,
    intro: 'Already wrote your list on paper? Take a photo and let AssanMart do the typing.',
    steps: [
      { icon: ImagePlus, title: 'Upload a photo', text: 'Tap Upload Grocery Photo and choose a clear picture of your handwritten or printed list.' },
      { icon: ScanText, title: 'We read the list', text: 'Every line is read, then matched with products we sell, including Urdu and English words.' },
      { icon: ListChecks, title: 'Confirm by voice', text: 'The voice assistant goes through the matches with you, so a wrong product never reaches your basket.' },
      { icon: Wallet, title: 'Place your order', text: 'Confirmed items go to the basket. Check out and pay cash when your groceries arrive.' },
    ],
  },
};

const ITEMS = ['Atta 5 kg', 'Eggs 12', 'Milk 1 L'];
const STEP_MS = 3200;

/* ------------------------------------------------------------------ the little animated scenes */

const Basket: React.FC<{ count: number }> = ({ count }) => (
  <div className="relative">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1DAA61] to-[#3fc27b] text-white flex items-center justify-center shadow-lg shadow-[#1DAA61]/30 hiw-pop">
      <ShoppingBasket className="w-8 h-8" />
    </div>
    <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-[#f59e0b] text-white text-xs font-black flex items-center justify-center border-2 border-white hiw-pop" style={{ animationDelay: '.3s' }}>
      {count}
    </span>
  </div>
);

const Chip: React.FC<{ text: string; delay: number; done?: boolean }> = ({ text, delay, done }) => (
  <div className="hiw-slide flex items-center gap-2 rounded-xl bg-white border border-[#b3e4c4] px-3 py-2 text-xs font-bold text-[#2a6b43] shadow-sm" style={{ animationDelay: `${delay}ms` }}>
    <span className={`w-5 h-5 rounded-full flex items-center justify-center ${done ? 'bg-[#1DAA61] text-white hiw-pop' : 'bg-[#e0f4e7] text-[#1DAA61]'}`} style={done ? { animationDelay: `${delay + 350}ms` } : undefined}>
      <Check className="w-3 h-3" />
    </span>
    {text}
  </div>
);

const Scene: React.FC<{ flow: Flow; phase: number }> = ({ flow, phase }) => {
  if (flow === 'voice') {
    if (phase === 0) {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <span className="hiw-slide px-5 py-2.5 rounded-full bg-[#1DAA61] text-white text-sm font-bold shadow-lg shadow-[#1DAA61]/30 hiw-select">English</span>
            <span className="hiw-slide px-5 py-2.5 rounded-full bg-white border-2 border-[#b3e4c4] text-[#2a6b43] text-sm font-bold" style={{ animationDelay: '120ms' }}>اردو</span>
          </div>
          <p className="text-[11px] font-semibold text-[#4d7a5c] hiw-slide" style={{ animationDelay: '250ms' }}>Choose how you want to speak</p>
        </div>
      );
    }
    if (phase === 1) {
      return (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <span className="hiw-ring absolute inset-0 rounded-full bg-[#1DAA61]/25" />
            <span className="hiw-ring absolute inset-0 rounded-full bg-[#1DAA61]/25" style={{ animationDelay: '.7s' }} />
            <span className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#1DAA61] to-[#3fc27b] text-white flex items-center justify-center shadow-lg">
              <Mic className="w-7 h-7" />
            </span>
          </div>
          <div className="flex items-end gap-1 h-6">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} className="hiw-bar w-1 rounded-full bg-[#1DAA61]" style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white border border-[#b3e4c4] px-3 py-2 text-xs font-semibold text-[#2a6b43] shadow-sm max-w-full">
            <span className="hiw-type inline-block overflow-hidden whitespace-nowrap align-bottom">"2 kilo aata, 1 dozen anday…"</span>
          </div>
        </div>
      );
    }
    if (phase === 2) {
      return (
        <div className="flex flex-col gap-2 w-full max-w-[260px]">
          <div className="hiw-slide rounded-2xl rounded-bl-sm bg-[#e0f4e7] px-3 py-2 text-xs font-semibold text-[#2a6b43] flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#1DAA61] shrink-0" /> Aashirvaad Atta 5 kg. Is that right?
          </div>
          <div className="hiw-slide self-end rounded-full bg-[#1DAA61] text-white px-4 py-1.5 text-xs font-bold" style={{ animationDelay: '900ms' }}>Yes</div>
          <Chip text="Atta 5 kg added" delay={1500} done />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3">
        <Basket count={3} />
        <div className="flex flex-wrap justify-center gap-2">
          {ITEMS.map((t, i) => <Chip key={t} text={t} delay={i * 160} done />)}
        </div>
        <span className="hiw-slide px-3 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-[11px] font-bold" style={{ animationDelay: '700ms' }}>Cash on delivery</span>
      </div>
    );
  }

  // photo + voice
  const Paper: React.FC<{ scan?: boolean; tick?: boolean }> = ({ scan, tick }) => (
    <div className="relative w-40 rounded-xl bg-white border border-[#b3e4c4] shadow-md px-4 py-3 overflow-hidden rotate-[-2deg]">
      {ITEMS.map((t, i) => (
        <div key={t} className="flex items-center gap-2 py-1.5 border-b border-dashed border-[#b3e4c4] last:border-0">
          <span className={`w-3.5 h-3.5 rounded-full border ${tick ? 'bg-[#1DAA61] border-[#1DAA61] hiw-pop' : 'border-[#96d9ae]'} flex items-center justify-center`} style={tick ? { animationDelay: `${i * 220}ms` } : undefined}>
            {tick && <Check className="w-2.5 h-2.5 text-white" />}
          </span>
          <span className="text-[11px] font-semibold text-[#2a6b43] italic" style={{ fontFamily: 'cursive' }}>{t}</span>
        </div>
      ))}
      {scan && <span className="hiw-scan absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-[#1DAA61]/35 to-transparent border-b-2 border-[#1DAA61]" />}
    </div>
  );

  if (phase === 0) {
    return (
      <div className="flex items-center gap-3">
        <div className="hiw-fly"><Paper /></div>
        <div className="w-24 h-28 rounded-2xl border-2 border-dashed border-[#1DAA61] bg-[#f3fbf6] flex flex-col items-center justify-center gap-1 text-[#1DAA61] hiw-glow">
          <Camera className="w-7 h-7" />
          <span className="text-[10px] font-bold">Drop photo</span>
        </div>
      </div>
    );
  }
  if (phase === 1) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Paper scan />
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#2a6b43] hiw-slide"><FileText className="w-3.5 h-3.5 text-[#1DAA61]" /> Reading your list…</span>
      </div>
    );
  }
  if (phase === 2) {
    return (
      <div className="flex items-center gap-4">
        <Paper tick />
        <div className="relative w-14 h-14 flex items-center justify-center">
          <span className="hiw-ring absolute inset-0 rounded-full bg-[#1DAA61]/25" />
          <span className="relative w-11 h-11 rounded-full bg-[#1DAA61] text-white flex items-center justify-center shadow-lg"><Mic className="w-5 h-5" /></span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <Basket count={3} />
      <span className="hiw-slide px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-[11px] font-bold flex items-center gap-1"><Check className="w-3 h-3 text-[#1DAA61]" /> Order placed</span>
    </div>
  );
};

/* ------------------------------------------------------------------ the section */

export const HowItWorks: React.FC<HowItWorksProps> = ({ onOpenVoice, onOpenImageScanner }) => {
  const [tab, setTab] = useState<Flow>('voice');
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const flow = FLOWS[tab];

  // the story plays through the 4 steps on its own, then starts over
  useEffect(() => {
    if (paused) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setPhase((p) => (p + 1) % 4), STEP_MS);
    return () => window.clearInterval(t);
  }, [paused, tab]);

  const choose = (k: Flow) => { setTab(k); setPhase(0); };

  return (
    <section id="how-it-works" className="scroll-mt-28 rounded-2xl border border-[#e0f4e7] bg-white p-4 sm:p-8 shadow-sm">
      <div className="text-center max-w-xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-[11px] font-bold tracking-wide">
          <MessageSquareText className="w-3.5 h-3.5 text-[#1DAA61]" /> HOW IT WORKS
        </span>
        <h2 className="mt-3 text-xl sm:text-3xl font-black text-[#2a6b43]">
          Your grocery list, <span className="text-[#1DAA61]">just say it</span>
        </h2>
        {flow.intro && <p className="mt-1.5 text-xs sm:text-sm text-[#4d7a5c]">{flow.intro}</p>}
      </div>

      <div className="mt-5 flex justify-center">
        <div className="inline-flex p-1 rounded-full bg-[#f3fbf6] border border-[#e0f4e7]" role="tablist">
          {(Object.keys(FLOWS) as Flow[]).map((k) => {
            const Ico = FLOWS[k].icon;
            const on = tab === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={on}
                onClick={() => choose(k)}
                className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  on ? 'bg-[#1DAA61] text-white shadow-md shadow-[#1DAA61]/25' : 'text-[#4d7a5c] hover:text-[#1DAA61]'
                }`}
              >
                <Ico className="w-4 h-4" /> {FLOWS[k].label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* animated picture */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#f3fbf6] via-white to-[#e0f4e7] border border-[#e0f4e7] min-h-[260px] sm:min-h-[300px] flex items-center justify-center p-5">
          <span className="hiw-blob absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#1DAA61]/10" />
          <span className="hiw-blob absolute -bottom-12 -right-8 w-44 h-44 rounded-full bg-[#f59e0b]/10" style={{ animationDelay: '1.2s' }} />
          <div key={`${tab}-${phase}`} className="relative z-10 w-full flex items-center justify-center">
            <Scene flow={tab} phase={phase} />
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === phase ? 'w-6 bg-[#1DAA61]' : 'w-1.5 bg-[#b3e4c4]'}`} />
            ))}
          </div>
        </div>

        {/* the four steps; the current one lights up with the picture */}
        <ol className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {flow.steps.map((s, i) => {
            const on = i === phase;
            return (
              <li key={`${tab}-${s.title}`}>
                <button
                  onClick={() => { setPhase(i); setPaused(true); }}
                  className={`relative w-full h-full text-left rounded-2xl border p-4 pt-5 transition-all duration-300 cursor-pointer ${
                    on ? 'bg-white border-[#1DAA61] shadow-lg -translate-y-0.5' : 'bg-[#f3fbf6] border-[#e0f4e7] hover:border-[#96d9ae]'
                  }`}
                >
                  <span className={`absolute -top-3 left-4 w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shadow-md ring-4 ring-white transition-colors ${on ? 'bg-[#1DAA61] text-white' : 'bg-[#b3e4c4] text-[#2a6b43]'}`}>
                    {i + 1}
                  </span>
                  <span className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${on ? 'bg-[#1DAA61] text-white border-[#1DAA61]' : 'bg-white text-[#1DAA61] border-[#b3e4c4]'}`}>
                    <s.icon className="w-5 h-5" />
                  </span>
                  <h3 className="mt-2.5 font-bold text-[#2a6b43] text-sm sm:text-base">{s.title}</h3>
                  <p className="mt-1 text-xs text-[#4d7a5c] leading-relaxed">{s.text}</p>
                  {on && !paused && <span key={`bar-${tab}-${phase}`} className="hiw-timer absolute left-4 right-4 bottom-0 h-[3px] rounded-full bg-[#f59e0b] origin-left" />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={tab === 'voice' ? onOpenVoice : onOpenImageScanner}
          className="h-11 px-7 rounded-full bg-gradient-to-r from-[#1DAA61] to-[#3fc27b] text-white font-bold text-sm shadow-lg shadow-[#1DAA61]/25 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          {tab === 'voice' ? <Mic className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {tab === 'voice' ? 'Try voice order' : 'Upload list photo'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <style>{`
        @keyframes hiw-pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
        @keyframes hiw-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes hiw-ring{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.9);opacity:0}}
        @keyframes hiw-bar{0%,100%{height:6px}50%{height:24px}}
        @keyframes hiw-type{from{width:0}to{width:100%}}
        @keyframes hiw-scan{0%{top:-30%}100%{top:105%}}
        @keyframes hiw-fly{0%{transform:translateX(-30px) rotate(-8deg);opacity:0}40%{opacity:1}100%{transform:translateX(6px) rotate(0)}}
        @keyframes hiw-glow{0%,100%{box-shadow:0 0 0 0 rgba(29,170,97,.35)}50%{box-shadow:0 0 0 10px rgba(29,170,97,0)}}
        @keyframes hiw-blob{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(10px,8px) scale(1.08)}}
        @keyframes hiw-timer{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes hiw-select{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        .hiw-pop{animation:hiw-pop .5s cubic-bezier(.34,1.56,.64,1) both}
        .hiw-slide{animation:hiw-slide .5s ease-out both}
        .hiw-ring{animation:hiw-ring 1.6s ease-out infinite}
        .hiw-bar{height:6px;animation:hiw-bar .9s ease-in-out infinite}
        .hiw-type{width:0;animation:hiw-type 2s steps(26) .3s forwards;max-width:100%}
        .hiw-scan{animation:hiw-scan 1.6s ease-in-out infinite}
        .hiw-fly{animation:hiw-fly 1.2s ease-out both}
        .hiw-glow{animation:hiw-glow 1.4s ease-in-out infinite}
        .hiw-blob{animation:hiw-blob 7s ease-in-out infinite}
        .hiw-timer{animation:hiw-timer ${STEP_MS}ms linear both}
        .hiw-select{animation:hiw-slide .5s ease-out both, hiw-select 1.4s ease-in-out .6s infinite}
        @media (prefers-reduced-motion:reduce){
          .hiw-pop,.hiw-slide,.hiw-ring,.hiw-bar,.hiw-type,.hiw-scan,.hiw-fly,.hiw-glow,.hiw-blob,.hiw-timer,.hiw-select{animation:none!important}
          .hiw-type{width:100%}
        }
      `}</style>
    </section>
  );
};