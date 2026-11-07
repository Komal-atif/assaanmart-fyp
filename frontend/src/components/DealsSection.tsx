import React, { useState, useEffect } from 'react';
import { Clock, Flame, Tag, ShoppingCart, ArrowRight } from 'lucide-react';
import { Product } from '../types';

interface DealsSectionProps {
  products: Product[];
  onAddToCart: (product: Product, element: HTMLElement) => void;
  onExploreCategory: (category: string) => void;
}

export const DealsSection: React.FC<DealsSectionProps> = ({
  products,
  onAddToCart,
  onExploreCategory,
}) => {
  // Countdown to midnight
  const calculateTimeLeft = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    return {
      hours: Math.floor(diff / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  const dealCards = [
    {
      id: 'deal-1',
      badge: '25% OFF',
      title: 'Fresh Orchard & Fruit Picks',
      subtitle: 'Seasonal Sunder Khani grapes, bananas & apples',
      category: 'Fruits & Vegetables',
      icons: ['🍌', '🍇', '🍎', '🍊'],
      bg: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/70',
      tagBg: 'bg-amber-600 text-white',
      featuredId: '250', // Sunder Khani Grapes
    },
    {
      id: 'deal-2',
      badge: '15% OFF',
      title: 'Commodities & Kitchen Staples',
      subtitle: 'Dalda cooking oil, premium chakki atta & sugar',
      category: 'Commodities',
      icons: ['🫒', '🌾', '🍚', '🧈'],
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/70',
      tagBg: 'bg-emerald-600 text-white',
      featuredId: '2', // Dalda Cooking Oil Pouch
    },
    {
      id: 'deal-3',
      badge: '20% OFF',
      title: 'Morning Breakfast & Dairy Pack',
      subtitle: 'Olper\'s fresh milk, Dawn bread & farm eggs',
      category: 'Dairy',
      icons: ['🥛', '🍞', '🥚', '🧀'],
      bg: 'bg-gradient-to-br from-sky-50 to-indigo-50 border-sky-200/70',
      tagBg: 'bg-sky-600 text-white',
      featuredId: '325', // Olpers Milk
    },
  ];

  return (
    <section id="deals" className="py-16 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading with Countdown */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
              <Flame className="w-4 h-4 fill-red-500" />
              <span>Limited Time Specials</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Deals Of The Day
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Grab high-value combo discounts before today&apos;s timer runs out.
            </p>
          </div>

          {/* Countdown Clock */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-2xl shadow-xs">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500">Ends in:</span>
            <div className="flex items-center gap-1.5 font-mono text-sm font-black text-slate-900">
              <span className="bg-slate-100 px-2 py-0.5 rounded-md">{pad(timeLeft.hours)}</span>
              <span>:</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md">{pad(timeLeft.minutes)}</span>
              <span>:</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md text-red-600">{pad(timeLeft.seconds)}</span>
            </div>
          </div>
        </div>

        {/* Deals Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dealCards.map((deal) => {
            const product = products.find((p) => p.id === deal.featuredId);

            return (
              <div
                key={deal.id}
                className={`rounded-3xl p-6 border ${deal.bg} shadow-md flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${deal.tagBg} shadow-xs`}>
                      {deal.badge}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">Daily Flash Deal</span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 leading-snug">
                    {deal.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {deal.subtitle}
                  </p>

                  {/* Visual Icons Cluster */}
                  <div className="flex items-center gap-2 my-6 p-4 bg-white/70 backdrop-blur-xs rounded-2xl border border-white justify-around shadow-2xs">
                    {deal.icons.map((emoji, idx) => (
                      <span key={idx} className="text-3xl hover:scale-125 transition-transform duration-200 cursor-default">
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between gap-3">
                  <button
                    onClick={() => onExploreCategory(deal.category)}
                    className="text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Explore Aisle</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {product && (
                    <button
                      onClick={(e) => onAddToCart(product, e.currentTarget)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Add Item ({product.price ? `PKR ${product.price}` : 'Deal'})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
