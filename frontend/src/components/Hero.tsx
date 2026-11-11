import React, { useState, useEffect } from 'react';
import { ArrowRight, Mic, Sparkles, Volume2, CheckCircle2 } from 'lucide-react';
import { MascotAnimation } from './MascotAnimation';

interface HeroProps {
  onOpenVoice: () => void;
  onExploreStore: () => void;
  onQuickSearch?: (query: string) => void;
}

const CYCLING_HEADLINES = [
  {
    main: "Fresh Vegetables",
    sub: "Hand-picked daily from certified farms across Pakistan at honest everyday prices.",
  },
  {
    main: "Big Discount",
    sub: "Special wholesale rates on top household commodities, cooking oil, rice and pantry staples.",
  },
  {
    main: "Groceries Made Easier With Your Voice",
    sub: "Simply speak your order in Urdu or English. AssanMart builds your confirmed basket instantly.",
  },
];

export const Hero: React.FC<HeroProps> = ({ onOpenVoice, onExploreStore }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % CYCLING_HEADLINES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const current = CYCLING_HEADLINES[index];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#fcfbf9] to-white pt-6 pb-12 sm:pt-10 sm:pb-16 border-b border-[#e2ede6]">
      {/* Subtle ambient light without green cast */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#fbf9f5] blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-[#ffffff] blur-3xl pointer-events-none" />

      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          
          {/* Left Column: Rotating Headline Bouncing in from Side of Screen & Aligned Buttons */}
          <div className="lg:col-span-7 text-left space-y-4">
            
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#064e3b] text-white text-xs font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Smart Voice Supermarket</span>
              <span className="text-emerald-300/80">•</span>
              <span className="text-emerald-200">Express Delivery</span>
            </div>

            {/* Rotating Headline - Bounces in from side of screen with slide-l animation */}
            <div className="min-h-[110px] sm:min-h-[135px] flex flex-col justify-center">
              <h1
                key={current.main}
                className="slide-l text-3xl sm:text-5xl lg:text-[52px] font-black text-[#064e3b] tracking-tight leading-[1.08] font-sans"
              >
                {current.main}
              </h1>
              <p
                key={current.sub}
                className="slide-l text-sm sm:text-base text-[#4b6b60] mt-3 max-w-xl font-normal leading-relaxed"
              >
                {current.sub}
              </p>
            </div>

            {/* Action Buttons - Strictly in a Single Horizontal Line Side-by-Side */}
            <div
              className="pt-4 flex flex-row items-center gap-3 sm:gap-4 flex-nowrap overflow-x-auto sm:overflow-visible pb-1 scrollbar-none"
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'nowrap',
                gap: '12px',
                width: '100%',
                maxWidth: '100%',
              }}
            >
              {/* Button 1: Browse Full Store - Solid Dark Green */}
              <button
                onClick={onExploreStore}
                className="h-11 px-4 sm:px-6 rounded-full bg-[#064e3b] hover:bg-[#043d2e] text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-950/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-row items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap group"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Browse Full Store</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* Button 2: Start Voice Order - Crisp White with Mint Border & Dark Green Text */}
              <button
                onClick={onOpenVoice}
                className="h-11 px-4 sm:px-6 rounded-full bg-white hover:bg-[#f2faf5] text-[#064e3b] font-bold text-xs sm:text-sm border-2 border-[#10b981] hover:border-[#064e3b] shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-row items-center justify-center gap-2.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap group"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <div className="w-5 h-5 rounded-full bg-[#d1fae5] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Mic className="w-3.5 h-3.5 text-[#064e3b]" />
                </div>
                <span>Start Voice Order</span>
              </button>
            </div>

          </div>

          {/* Right Column: 3D Mascot inside a Perfect Circle with Animated Circular Text & Circling Badges */}
          <div className="lg:col-span-5 flex justify-center relative py-6">
            <div className="slide-r relative flex items-center justify-center p-4">
              
              {/* Circular Badge Container */}
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                
                {/* 1. Outermost Animated Rotating Dashed Ring */}
                <div className="absolute -inset-6 sm:-inset-10 rounded-full border border-dashed border-emerald-300/50 pointer-events-none animate-[spin_40s_linear_infinite]" />

                {/* 2. Middle Animated Reverse Rotating Ring with Accent Orbit Dots */}
                <div className="absolute -inset-2 sm:-inset-4 rounded-full border border-emerald-200/40 pointer-events-none animate-[spin_30s_linear_infinite_reverse]">
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-xs" />
                </div>

                {/* 3. Inner Pulsing Glowing Ring */}
                <div className="absolute inset-2 sm:inset-3 rounded-full border-2 border-emerald-100/70 animate-pulse-glow-ring pointer-events-none" />

                {/* 4. Rotating Circular Text SVG around the circle */}
                <svg
                  className="absolute -inset-4 sm:-inset-6 w-[calc(100%+32px)] sm:w-[calc(100%+48px)] h-[calc(100%+32px)] sm:h-[calc(100%+48px)] animate-spin-slow pointer-events-none select-none"
                  viewBox="0 0 320 320"
                >
                  <defs>
                    <path
                      id="textCirclePath"
                      d="M 160, 160 m -130, 0 a 130,130 0 1,1 260,0 a 130,130 0 1,1 -260,0"
                    />
                  </defs>
                  <text className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[3.8px] fill-[#064e3b]/70">
                    <textPath href="#textCirclePath" startOffset="0%">
                      ASSANMART · SMART VOICE GROCERIES · URDU &amp; ENGLISH · ORDER IN SECONDS · 
                    </textPath>
                  </text>
                </svg>

                {/* 5. Perfect Center Circle Housing the 3D Mascot */}
                <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-full bg-gradient-to-b from-white via-[#fcfbf9] to-[#f4fbf6] border-4 border-emerald-100 shadow-2xl overflow-hidden p-3 flex items-center justify-center relative z-20 transition-transform duration-300 hover:scale-105">
                  <MascotAnimation className="w-full h-full" />
                </div>

                {/* 6. Circling Small Voice Automation Cards */}
                {/* Card 1: Top Left */}
                <div className="absolute -top-3 -left-6 sm:-left-12 z-30 animate-float-badge-1 bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-emerald-100/90 shadow-lg shadow-emerald-950/5 flex items-center gap-2 hover:scale-105 transition-transform select-none">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-100 text-[#064e3b] flex items-center justify-center shrink-0">
                    <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#059669]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] sm:text-[11px] font-bold text-[#064e3b] leading-tight">Urdu &amp; English Voice</p>
                    <p className="text-[8px] sm:text-[9px] text-[#4b6b60]">"2 kilo aalo aur doodh"</p>
                  </div>
                </div>

                {/* Card 2: Top Right */}
                <div className="absolute -top-2 -right-6 sm:-right-12 z-30 animate-float-badge-2 bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-emerald-100/90 shadow-lg shadow-emerald-950/5 flex items-center gap-2 hover:scale-105 transition-transform select-none">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] sm:text-[11px] font-bold text-[#064e3b] leading-tight">Instant Smart Cart</p>
                    <p className="text-[8px] sm:text-[9px] text-[#4b6b60]">Auto-detects items &amp; sizes</p>
                  </div>
                </div>

                {/* Card 3: Bottom Right */}
                <div className="absolute -bottom-3 -right-4 sm:-right-10 z-30 animate-float-badge-1 bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-emerald-100/90 shadow-lg shadow-emerald-950/5 flex items-center gap-2 hover:scale-105 transition-transform select-none">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-50 border border-emerald-200 text-[#064e3b] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] sm:text-[11px] font-bold text-[#064e3b] leading-tight">Hands-Free Order</p>
                    <p className="text-[8px] sm:text-[9px] text-[#4b6b60]">Confirm with 1 spoken word</p>
                  </div>
                </div>

                {/* Card 4: Bottom Left */}
                <div className="absolute -bottom-3 -left-4 sm:-left-10 z-30 animate-float-badge-3 bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-[#ede6da] shadow-lg shadow-emerald-950/5 flex items-center gap-2 hover:scale-105 transition-transform select-none">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#fbf8f2] border border-[#e5dacf] flex items-center justify-center shrink-0">
                    <Volume2 className="w-3.5 h-3.5 text-[#064e3b]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] sm:text-[11px] font-bold text-[#064e3b] leading-tight">Voice Automation</p>
                    <p className="text-[8px] sm:text-[9px] text-[#4b6b60]">Zero typing needed</p>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};