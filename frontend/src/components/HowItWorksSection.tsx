import React, { useState, useEffect } from 'react';
import { Mic, ShoppingCart, Check } from 'lucide-react';

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

export const HowItWorksSection: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  const currentPhrase = PHRASES[phraseIndex];
  const isTypingDone = typedChars >= currentPhrase.text.length;

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (!isTypingDone) {
          setTypedChars((c) => c + 1);
        } else {
          setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
          setTypedChars(0);
        }
      },
      isTypingDone ? 3800 : 45
    );

    return () => clearTimeout(timer);
  }, [typedChars, isTypingDone, phraseIndex]);

  return (
    <section id="how-it-works" className="py-20 bg-white border-b border-[#e3ece8] overflow-hidden">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading matching image_315d12b2.png */}
        <div className="text-left mb-12">
          <span className="text-[13px] font-bold text-[#2f7d5b] tracking-[1.8px] uppercase block mb-3 font-sans">
            SIMPLE &amp; EASY
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#1d3a33] tracking-[-1px] font-sans leading-[1.12]">
            How AssanMart Works
          </h2>
          <p className="text-[16px] text-[#6d8179] max-w-2xl mt-3.5 font-normal leading-[1.7] font-sans">
            Getting your groceries has never been this easy. Three steps, and you stay in control the whole way.
          </p>
        </div>

        {/* 2-Column Layout matching image_315d12b2.png */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: 3 Steps Cards */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Step 01 */}
            <div className="relative bg-white border border-[#e3ece8] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(29,58,51,0.03)] hover:shadow-md transition-all flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex-1 pr-8">
                <h3 className="text-base sm:text-lg font-bold text-[#1d3a33]">
                  Speak or browse
                </h3>
                <p className="text-xs sm:text-sm text-[#6d8179] mt-1 leading-relaxed">
                  Say what you need, or add products yourself from any category.
                </p>
              </div>
              <span className="text-sm font-bold text-[#c4d6cd] font-mono select-none">
                01
              </span>
            </div>

            {/* Step 02 */}
            <div className="relative bg-white border border-[#e3ece8] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(29,58,51,0.03)] hover:shadow-md transition-all flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex-1 pr-8">
                <h3 className="text-base sm:text-lg font-bold text-[#1d3a33]">
                  Review your cart
                </h3>
                <p className="text-xs sm:text-sm text-[#6d8179] mt-1 leading-relaxed">
                  Check items and quantities. Correct anything by voice or with a tap.
                </p>
              </div>
              <span className="text-sm font-bold text-[#c4d6cd] font-mono select-none">
                02
              </span>
            </div>

            {/* Step 03 */}
            <div className="relative bg-white border border-[#e3ece8] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(29,58,51,0.03)] hover:shadow-md transition-all flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[2.6]" />
              </div>
              <div className="flex-1 pr-8">
                <h3 className="text-base sm:text-lg font-bold text-[#1d3a33]">
                  Confirm your order
                </h3>
                <p className="text-xs sm:text-sm text-[#6d8179] mt-1 leading-relaxed">
                  Confirm when you’re happy and AssanMart handles the rest.
                </p>
              </div>
              <span className="text-sm font-bold text-[#c4d6cd] font-mono select-none">
                03
              </span>
            </div>

          </div>

          {/* Right Column: Live Voice Recognition Display with Animated Mic Ripple matching image_315d12b2.png */}
          <div className="lg:col-span-6">
            <div className="bg-[#efe7d6] rounded-[28px] p-6 sm:p-8 shadow-xl border border-[#efe7d6] flex flex-col justify-between min-h-[360px]">
              
              {/* Header inside the cream card with animated mic orb */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Animated Mic with expanding ripples */}
                  <div className="mic-orb live">
                    <i />
                    <i />
                    <Mic className="w-5 h-5 text-white relative z-10 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#1d3a33] leading-tight">
                      {isTypingDone ? 'Added to your cart' : 'Listening...'}
                    </h4>
                    <p className="text-xs text-[#6d8179] mt-0.5">
                      {isTypingDone ? 'Review before you confirm' : 'Speak naturally'}
                    </p>
                  </div>
                </div>

                {/* Animated Green Equalizer Waves */}
                <div className="flex items-center gap-1 h-6">
                  <span className="w-1 bg-[#2f7d5b] rounded-full soundwave-bar" style={{ animationDelay: '0.1s' }} />
                  <span className="w-1 bg-[#2f7d5b] rounded-full soundwave-bar" style={{ animationDelay: '0.35s' }} />
                  <span className="w-1 bg-[#2f7d5b] rounded-full soundwave-bar" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1 bg-[#2f7d5b] rounded-full soundwave-bar" style={{ animationDelay: '0.45s' }} />
                </div>
              </div>

              {/* Spoken Quote Box */}
              <div className="my-6 bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-white/60 min-h-[86px] flex items-center">
                <p className="text-base sm:text-lg font-medium text-[#1d3a33]">
                  “{currentPhrase.text.slice(0, typedChars)}
                  <span className="inline-block w-0.5 h-4 bg-[#2f7d5b] ml-1 animate-blink align-middle" />”
                </p>
              </div>

              {/* Recognized Checklist Items */}
              <div className="space-y-2.5 min-h-[96px]">
                {isTypingDone ? (
                  currentPhrase.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-3.5 px-4 shadow-xs flex items-center justify-between transition-all duration-300 animate-in fade-in slide-in-from-left-4"
                      style={{ animationDelay: `${idx * 120}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2f7d5b] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-sm font-bold text-[#1d3a33]">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#6d8179]">
                        {item.qty}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs font-medium text-[#6d8179] italic p-2">
                    Listening for grocery items and quantities...
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
