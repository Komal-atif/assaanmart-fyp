import React from 'react';
import { Hero } from './Hero';
import { HowItWorksSection } from './HowItWorksSection';
import { FAQSection } from './FAQSection';
import { Truck, ShieldCheck, Leaf, ArrowRight, Store, Mic, Sparkles, Headphones } from 'lucide-react';

interface LandingPageProps {
  onBrowseStore: () => void;
  onOpenVoice: () => void;
  onQuickSearch: (query: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onBrowseStore,
  onOpenVoice,
  onQuickSearch,
}) => {
  return (
    <div className="landing-page-wrapper bg-transparent font-sans">
      {/* 1. Hero with Mascot and "Groceries Made Simple" */}
      <Hero
        onOpenVoice={onOpenVoice}
        onExploreStore={onBrowseStore}
        onQuickSearch={onQuickSearch}
      />

      {/* Trust Highlights Strip */}
      <div className="bg-white border-b border-[#e3ece8] py-8">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0 shadow-2xs">
              <Truck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1d3a33]">Fast Delivery</h4>
              <p className="text-xs text-[#6d8179]">Groceries at your door</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1d3a33]">Secure Ordering</h4>
              <p className="text-xs text-[#6d8179]">Confirm before you pay</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0 shadow-2xs">
              <Leaf className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1d3a33]">Fresh Guarantee</h4>
              <p className="text-xs text-[#6d8179]">Quality you can trust</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0 shadow-2xs">
              <Headphones className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1d3a33]">Friendly Support</h4>
              <p className="text-xs text-[#6d8179]">Here when you need us</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. How AssanMart Works (Exact matching user screenshot image_315d12b2.png) */}
      <HowItWorksSection />

      {/* 3. Frequently Asked Questions (FAQ) Section */}
      <FAQSection />

      {/* 4. Bottom CTA banner inviting user to browse the full store */}
      <section className="py-20 bg-[#2a3a35] text-white">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#b7ed7c] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>354 Everyday Items In Stock</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white font-sans">
            Ready to make grocery shopping easier?
          </h2>

          <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto font-normal leading-relaxed font-sans">
            Experience a smarter way to shop. Browse our complete supermarket catalog or order with your voice in seconds.
          </p>

          <div
            className="flex flex-row items-center justify-center gap-3 sm:gap-4 flex-nowrap overflow-x-auto pb-1 scrollbar-none pt-4"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
          >
            <button
              onClick={onBrowseStore}
              className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-[#ffffff] hover:bg-[#cde8dd] text-[#1d3a33] font-bold text-xs sm:text-base shadow-xl transition-all duration-200 flex flex-row items-center gap-2.5 sm:gap-3 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap group"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <Store className="w-4 h-4 sm:w-5 sm:h-5 text-[#2f7d5b] shrink-0" />
              <span>Browse Full Store Dashboard</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#2f7d5b] group-hover:translate-x-1.5 transition-transform shrink-0" />
            </button>

            <button
              onClick={onOpenVoice}
              className="px-5 sm:px-7 py-3.5 sm:py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-base border border-white/20 transition-all duration-200 flex flex-row items-center gap-2 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-[#b7ed7c] shrink-0" />
              <span>Try Voice Assistant</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
