import React from 'react';
import { ShieldCheck, HeartHandshake, Mic2, Tag, Truck, Users } from 'lucide-react';

export const WhyAssanMartSection: React.FC = () => {
  const highlights = [
    {
      icon: <Mic2 className="w-6 h-6 text-emerald-600" />,
      title: 'Voice-First in Urdu & English',
      desc: 'Bilingual AI trained on everyday Pakistani grocery terms so you can speak as naturally as you talk at home.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      title: '100% Genuine Brands Only',
      desc: 'Authentic items sourced directly from certified distributors like Unilever, Nestle, Dalda, Shan, and Peek Freans.',
    },
    {
      icon: <Tag className="w-6 h-6 text-emerald-600" />,
      title: 'Honest Wholesale-Grade Prices',
      desc: 'No arbitrary surges. Clear retail pricing in PKR with daily discounts on family bundles and bulk commodities.',
    },
    {
      icon: <Truck className="w-6 h-6 text-emerald-600" />,
      title: '30-45 Minute Express Delivery',
      desc: 'Dedicated local riders deliver straight to your kitchen table with careful packaging for fragile goods.',
    },
    {
      icon: <HeartHandshake className="w-6 h-6 text-emerald-600" />,
      title: 'Confirm First, Pay on Delivery',
      desc: 'You always inspect and verify your items. Pay with Cash on Delivery or JazzCash/EasyPaisa upon arrival.',
    },
    {
      icon: <Users className="w-6 h-6 text-emerald-600" />,
      title: 'Built for the Entire Household',
      desc: 'Simple enough for grandparents, parents, and busy students. No confusing menus or small touch targets.',
    },
  ];

  return (
    <section id="why" className="py-16 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-2">
            The AssanMart Promise
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Why Pakistani Households Choose AssanMart
          </h2>
          <p className="text-base text-slate-500 mt-2 font-normal">
            Bringing convenience, trust, and freshness to grocery shopping across Pakistan.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="bg-white border border-slate-200/80 hover:border-emerald-300 rounded-3xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                {item.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
