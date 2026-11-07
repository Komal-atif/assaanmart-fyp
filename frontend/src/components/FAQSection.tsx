import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'How does voice ordering work?',
    answer:
      'Simply tap the microphone button and speak what you need in Urdu, English, or Roman Urdu (e.g. “2 kilo timatar aur 1 litre Olper’s doodh”). AssanMart parses your items, matches them against our 350+ products catalog, and automatically prepares your ready-to-review cart.',
  },
  {
    question: 'Can I still shop manually without voice?',
    answer:
      'Yes, absolutely! You can browse the full store, filter through all 9 categories (Dairy, Commodities, Fruits & Vegetables, Bakery, Snacks, etc.), search by name, and adjust quantities manually anytime.',
  },
  {
    question: 'What if voice recognition mishears an item?',
    answer:
      'Nothing is ever ordered until you explicitly review and confirm! You can review every item, change quantities, remove items, or add more products with a single tap before placing your order.',
  },
  {
    question: 'What payment methods do you support in Pakistan?',
    answer:
      'We support Cash on Delivery (COD) so you can pay at your doorstep after inspecting your items, as well as JazzCash, EasyPaisa, and Debit/Credit cards (Visa & Mastercard).',
  },
  {
    question: 'How fast is delivery?',
    answer:
      'We offer 30–45 minute express doorstep delivery in Karachi, Lahore, Islamabad, Rawalpindi, and other major cities. Orders above PKR 2,000 enjoy 100% Free Express Delivery!',
  },
  {
    question: 'What is your freshness and return guarantee?',
    answer:
      'If any vegetable, fruit, or item does not meet your quality expectations, our rider will replace it on the spot or deduct it from your bill with zero hassle.',
  },
];

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 bg-[#e8f4f0] border-b border-[#cde8dd]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-left mb-12">
          <span className="text-[13px] font-bold text-[#2f7d5b] tracking-[1.8px] uppercase block mb-3 font-sans">
            QUESTIONS &amp; ANSWERS
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#1d3a33] tracking-[-1px] font-sans leading-[1.12]">
            Frequently Asked Questions
          </h2>
          <p className="text-[16px] text-[#6d8179] max-w-xl mt-3 font-normal font-sans leading-[1.7]">
            Answers to the things people ask us most about voice shopping and ordering.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3.5 max-w-4xl">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#e3ece8] overflow-hidden shadow-[0_2px_12px_rgba(29,58,51,0.03)] transition-all hover:border-[#2f7d5b]/60"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <span className="text-base font-bold text-[#1d3a33] font-sans">
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-[#e8f4f0] text-[#2f7d5b] flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 bg-[#2f7d5b] text-white' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-sm text-[#6d8179] leading-[1.7] border-t border-slate-50 font-sans animate-in fade-in duration-200">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
