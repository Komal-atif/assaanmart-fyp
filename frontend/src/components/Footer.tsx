import React, { useState } from 'react';
import { Mail, Phone, CheckCircle2 } from 'lucide-react';
import { Category } from '../types';

interface FooterProps {
  categories: Category[];
  onSelectCategory: (categoryName: string) => void;
  onNavigateSection: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  categories,
  onSelectCategory,
  onNavigateSection,
}) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="relative z-20 w-full bg-[#fbf8f2] text-[#064e3b] text-xs border-t border-[#e2ede6] font-sans shrink-0 mt-auto">
      {/* Main Footer Grid */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10">
        
        {/* Brand & Newsletter Column */}
        <div className="md:col-span-5 space-y-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white p-1 flex items-center justify-center border border-[#d1fae5] shadow-xs">
              <img src="/logo.png" alt="AssanMart" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-black text-[#064e3b]">
              Assan<span className="text-[#059669]">Mart</span>
            </span>
          </div>

          <p className="text-[#4b6b60] text-xs leading-[1.7] max-w-sm font-normal">
            Pakistan&apos;s premier smart grocery platform. Speak your grocery list in Urdu or English with fast doorstep delivery across all major cities.
          </p>

          {/* Newsletter Form */}
          <div className="pt-2">
            <span className="font-bold text-[#064e3b] block mb-2">Subscribe for weekly discounts &amp; farm updates</span>
            {subscribed ? (
              <p className="text-[#059669] flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Thank you! You&apos;re subscribed to AssanMart weekly specials.
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm">
                <input
                  type="email"
                  required
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#d1fae5] rounded-full text-xs text-[#064e3b] placeholder-[#059669]/60 focus:outline-hidden focus:border-[#064e3b] shadow-2xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold rounded-full text-xs transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Categories Column */}
        <div className="md:col-span-3 text-left space-y-3">
          <h5 className="font-bold text-[#064e3b] text-xs uppercase tracking-wider">Top Categories</h5>
          <ul className="space-y-2">
            {categories.slice(0, 6).map((c) => (
              <li key={c.name}>
                <button
                  onClick={() => onSelectCategory(c.name)}
                  className="hover:text-[#047857] text-[#4b6b60] transition-colors cursor-pointer text-left flex items-center gap-2 font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                  <span>{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Links Column */}
        <div className="md:col-span-2 text-left space-y-3">
          <h5 className="font-bold text-[#064e3b] text-xs uppercase tracking-wider">Navigation</h5>
          <ul className="space-y-2 text-[#4b6b60] font-medium">
            <li>
              <button
                onClick={() => onNavigateSection('home')}
                className="hover:text-[#064e3b] transition-colors cursor-pointer"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSection('dashboard')}
                className="hover:text-[#064e3b] transition-colors cursor-pointer"
              >
                Supermarket Store
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSection('how-it-works')}
                className="hover:text-[#064e3b] transition-colors cursor-pointer"
              >
                How It Works
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSection('faq')}
                className="hover:text-[#064e3b] transition-colors cursor-pointer"
              >
                FAQ
              </button>
            </li>
          </ul>
        </div>

        {/* Support Column */}
        <div className="md:col-span-2 text-left space-y-3">
          <h5 className="font-bold text-[#064e3b] text-xs uppercase tracking-wider">Help &amp; Support</h5>
          <div className="space-y-2 text-[#4b6b60]">
            <div className="pt-1 flex items-center gap-2 text-[#064e3b] font-semibold">
              <Phone className="w-3.5 h-3.5 text-[#059669]" />
              <span>0800-ASSAN</span>
            </div>
            <div className="flex items-center gap-2 text-[#064e3b] font-semibold">
              <Mail className="w-3.5 h-3.5 text-[#059669]" />
              <span>support@assanmart.pk</span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#e2ede6] py-5 px-4 bg-white/60">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[#5d8174] text-[11px]">
          <p>© 2026 AssanMart. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#064e3b] cursor-pointer">Privacy Policy</span>
            <span>·</span>
            <span className="hover:text-[#064e3b] cursor-pointer">Terms of Service</span>
            <span>·</span>
            <span className="hover:text-[#064e3b] cursor-pointer">Returns Guarantee</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
