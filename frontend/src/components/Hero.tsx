import React from 'react';
import { ArrowRight, Mic, Truck, Wallet } from 'lucide-react';

interface HeroProps {
  onOpenVoice: () => void;
  onExploreStore: () => void;
  onQuickSearch?: (query: string) => void;
}

const Leaf: React.FC<{ className: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg viewBox="0 0 64 64" className={`am-leaf pointer-events-none absolute ${className}`} style={style} aria-hidden="true">
    <defs>
      <linearGradient id="amLeafG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="rgb(134,195,63)" />
        <stop offset="1" stopColor="rgb(74,154,42)" />
      </linearGradient>
    </defs>
    <path d="M8 56C8 28 26 8 56 8c0 30-18 48-48 48Z" fill="url(#amLeafG)" />
    <path d="M10 54C24 40 36 28 52 12" stroke="#ffffff" strokeOpacity=".55" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const Hero: React.FC<HeroProps> = ({ onOpenVoice, onExploreStore }) => {
  return (
    <section className="am-hero relative overflow-hidden bg-[#faf8f3] border-b border-[#ccfbf1]">
      <style>{`
        /* basket picture: fades into the page on the side that touches the text */
        .am-hero .am-basket{
          -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 16%,#000 94%,transparent 100%),linear-gradient(to right,transparent 0,#000 10%,#000 90%,transparent 100%);
          -webkit-mask-composite:source-in;
                  mask-image:linear-gradient(to bottom,transparent 0,#000 16%,#000 94%,transparent 100%),linear-gradient(to right,transparent 0,#000 10%,#000 90%,transparent 100%);
                  mask-composite:intersect;
        }
        @media (min-width:1024px){
          .am-hero .am-basket{
            -webkit-mask-image:linear-gradient(to right,transparent 0,#000 24%,#000 94%,transparent 100%),linear-gradient(to bottom,#000 92%,transparent 100%);
                    mask-image:linear-gradient(to right,transparent 0,#000 24%,#000 94%,transparent 100%),linear-gradient(to bottom,#000 92%,transparent 100%);
          }
        }
        @keyframes am-float{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-14px) rotate(calc(var(--r,0deg) + 10deg))}}
        @keyframes am-sway{0%,100%{transform:translate(0,0) rotate(var(--r,0deg))}50%{transform:translate(10px,-10px) rotate(calc(var(--r,0deg) - 14deg))}}
        @keyframes am-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes am-pop{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
        @keyframes am-mic{0%{box-shadow:0 0 0 0 rgba(255,255,255,.55)}100%{box-shadow:0 0 0 12px rgba(255,255,255,0)}}
        .am-hero .am-leaf{animation:am-float 6s ease-in-out infinite}
        .am-hero .am-leaf.b{animation-name:am-sway;animation-duration:8s}
        .am-hero .r1{animation:am-rise .7s ease-out both}
        .am-hero .r2{animation:am-rise .7s .12s ease-out both}
        .am-hero .r3{animation:am-rise .7s .24s ease-out both}
        .am-hero .r4{animation:am-rise .7s .36s ease-out both}
        .am-hero .pop{animation:am-pop .9s .1s ease-out both}
        .am-hero .mic-ring{animation:am-mic 1.8s ease-out infinite}
        @media (prefers-reduced-motion:reduce){
          .am-hero *{animation:none!important}
        }
      `}</style>

      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 items-center gap-2 lg:gap-0">
        <div className="relative z-10 pt-8 pb-4 sm:pt-12 lg:py-20 text-center lg:text-left">
          <h1 className="r1 font-black tracking-tight leading-[1.05] text-[2.4rem] sm:text-6xl lg:text-[4rem] text-[#115e59]">
            Fresh Groceries,
            <span className="block text-[#14b8a6]">Better Living</span>
          </h1>

          <div className="r2 mt-4 sm:mt-5 mx-auto lg:mx-0 h-[3px] w-40 sm:w-56 rounded-full bg-gradient-to-r from-[#0d9488] to-transparent" />

          <p className="r2 mt-4 sm:mt-5 text-[15px] sm:text-lg text-[#3f6e6a] max-w-md sm:max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Get the freshest fruits, vegetables, and daily essentials delivered to your doorstep. Just speak your order in Urdu or English.
          </p>

          {/* PRIMARY = voice order, SECONDARY = browse the store */}
          <div className="r3 mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 max-w-sm sm:max-w-none mx-auto lg:mx-0">
            <button
              onClick={onOpenVoice}
              className="group h-12 sm:h-[52px] px-6 sm:px-8 rounded-full bg-gradient-to-r from-[#0d9488] to-[#14b8a6] hover:from-[#0f766e] hover:to-[#0d9488] text-white font-bold text-sm sm:text-base shadow-lg shadow-teal-600/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
            >
              <span className="mic-ring w-7 h-7 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4" />
              </span>
              Start Voice Order
            </button>

            <button
              onClick={onExploreStore}
              className="group h-12 sm:h-[52px] px-6 sm:px-8 rounded-full bg-white hover:bg-[#f0fdfa] text-[#115e59] font-bold text-sm sm:text-base border-2 border-[#99f6e4] hover:border-[#14b8a6] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              Browse Full Store
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <ul className="r4 mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs sm:text-[13px] font-semibold text-[#3f6e6a]">
            <li className="flex items-center gap-1.5"><Mic className="w-3.5 h-3.5 text-[#14b8a6]" /> Urdu &amp; English voice</li>
            <li className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-[#14b8a6]" /> Cash on delivery</li>
            <li className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#14b8a6]" /> Free delivery over PKR 2,000</li>
          </ul>
        </div>

        {/* basket */}
        <div className="relative pop flex justify-center lg:justify-end">
          <Leaf className="w-9 sm:w-12 left-[6%] top-[10%]" style={{ ['--r' as any]: '-20deg' }} />
          <Leaf className="b w-7 sm:w-9 left-[2%] bottom-[24%]" style={{ ['--r' as any]: '30deg', animationDelay: '-2s' }} />
          <Leaf className="w-8 sm:w-10 right-[4%] top-[4%]" style={{ ['--r' as any]: '55deg', animationDelay: '-4s' }} />
          <img
            src="/images/hero-basket.jpg"
            alt="A basket of fresh fruit, vegetables, milk and bread"
            width={770}
            height={800}
            className="am-basket w-full max-w-[420px] sm:max-w-[520px] lg:max-w-none lg:w-[110%] lg:-mr-6 h-auto select-none"
            draggable={false}
          />
        </div>
      </div>
    </section>
  );
};
