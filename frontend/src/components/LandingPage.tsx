import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Mic,
  Store,
  Truck,
  ShieldCheck,
  Leaf,
  Headphones,
  ChevronDown,
  Apple,
  Milk,
  Cookie,
  CupSoda,
  Wheat,
  Croissant,
  Fish,
  Heart,
  Flame,
  Wallet,
} from 'lucide-react';
import { HowItWorks } from './HowItWorks';

interface LandingPageProps {
  onBrowseStore: () => void;
  onOpenVoice: () => void;
  onOpenImageScanner?: () => void;
  /** optional: used by the aisle chips to open the store filtered by that aisle */
  onQuickSearch?: (query: string) => void;
}

/** Put grocery-basket.webp inside your /public folder */
const BASKET_SRC = '/grocery-basket.webp';

const HEADLINES = [
  { main: 'Fresh Vegetables', sub: 'Hand-picked daily from certified farms across Pakistan at honest everyday prices.' },
  { main: 'Big Discount', sub: 'Special wholesale rates on household commodities, cooking oil, rice and pantry staples.' },
  { main: 'Groceries Made Easier With Your Voice', sub: 'Simply speak your order in Urdu or English. AssanMart builds your confirmed basket instantly.' },
];

const TRUST = [
  { icon: Truck, title: 'Fast Delivery', note: 'Groceries at your door' },
  { icon: ShieldCheck, title: 'Secure Ordering', note: 'Confirm before you pay' },
  { icon: Leaf, title: 'Fresh Quality', note: 'Quality you can trust' },
  { icon: Headphones, title: 'Friendly Support', note: 'Here when you need us' },
];

const AISLES = [
  { name: 'Fruits & Vegetables', icon: Apple },
  { name: 'Dairy', icon: Milk },
  { name: 'Snacks & Biscuits', icon: Cookie },
  { name: 'Beverages', icon: CupSoda },
  { name: 'Commodities', icon: Wheat },
  { name: 'Bakery & Breakfast', icon: Croissant },
  { name: 'Meat & Sea Food', icon: Fish },
  { name: 'Personal Care', icon: Heart },
  { name: 'Spices & Sauces', icon: Flame },
];

const FAQ = [
  { q: 'How do I order with my voice?', a: 'Tap Order by Voice, choose English or اردو and say your list, for example "2 kilo aata aur ek dozen anday". AssanMart repeats each item so you can confirm it before it goes into your basket.' },
  { q: 'Can I upload a photo of my handwritten list?', a: 'Yes. Use Upload Grocery Photo, choose a clear picture of your list, and we match each line with products in the store. You then confirm the items by voice.' },
  { q: 'Which languages does the voice assistant understand?', a: 'Urdu, Roman Urdu and English, and you can mix them in one sentence.' },
  { q: 'How much is delivery and how do I pay?', a: 'Delivery is PKR 150 and it is free on orders of PKR 2,000 or more. You pay cash on delivery, so no card or advance payment is needed.' },
  { q: 'Do I have to sign in to order?', a: 'Signing in saves your name, phone and address so checkout is faster next time. You can browse the store without an account.' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onBrowseStore, onOpenVoice, onOpenImageScanner, onQuickSearch }) => {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    const t = window.setInterval(() => setI((p) => (p + 1) % HEADLINES.length), 3800);
    return () => window.clearInterval(t);
  }, []);
  const cur = HEADLINES[i];
  const words = cur.main.split(' ');

  const openAisle = (name: string) => (onQuickSearch ? onQuickSearch(name) : onBrowseStore());

  const renderTrust = (cls: string) => (
    <div className={cls}>
      {TRUST.map((t) => (
        <div key={t.title} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#e0f4e7] to-[#f3fbf6] text-[#1DAA61] flex items-center justify-center shrink-0 border border-[#b3e4c4]/60">
            <t.icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] sm:text-sm font-bold text-[#1f5233] leading-tight">{t.title}</h4>
            <p className="text-[11px] sm:text-xs text-[#4d7a5c] leading-tight">{t.note}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-transparent font-sans">
      {/* ---------------- hero: deep green rounded banner ---------------- */}
      <section className="relative bg-white px-3 sm:px-6 pt-3 sm:pt-5 pb-2 lg:pb-8">
        <div className="relative max-w-[1240px] mx-auto">
        <div
          className="relative overflow-hidden max-w-[1240px] mx-auto rounded-[28px] sm:rounded-[36px] text-white shadow-[0_30px_60px_-30px_rgba(20,138,76,.7)]"
          style={{
            background:
              'radial-gradient(55% 80% at 78% 38%, rgba(107,211,154,.40), rgba(107,211,154,0) 62%), linear-gradient(135deg,#1f5233 0%,#148a4c 62%,#1DAA61 135%)',
          }}
        >
          <span className="lp-dots-w absolute inset-0 pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-x-4 lg:gap-y-5 items-center px-5 sm:px-10 lg:px-12 pt-9 sm:pt-10 pb-5 sm:pb-6 lg:pb-0">
            {/* text */}
            <div className="lg:col-span-7 lg:row-start-1 text-center lg:text-left">
              <div className="min-h-[140px] sm:min-h-[165px] lg:min-h-[180px] flex flex-col justify-center lg:justify-start">
                <h1 key={cur.main} className="lp-slide text-[2.1rem] leading-[1.08] sm:text-5xl lg:text-[3rem] font-black tracking-tight">
                  {words.slice(0, -1).join(' ')}{' '}
                  <span className="bg-gradient-to-r from-[#6bd39a] to-[#c4f3d9] bg-clip-text text-transparent">{words[words.length - 1]}</span>
                </h1>
                <p key={cur.sub} className="lp-slide mt-3 text-sm sm:text-base lg:text-lg text-white/80 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  {cur.sub}
                </p>
              </div>

              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center lg:justify-start gap-3">
                <div className="relative">
                  <span className="lp-btnpulse absolute inset-0 rounded-full bg-white" />
                  <button
                    onClick={onOpenVoice}
                    className="relative w-full h-12 px-8 rounded-full bg-white text-[#1f5233] hover:bg-[#f3fbf6] font-bold text-base shadow-xl shadow-black/20 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Mic className="w-5 h-5 text-[#1DAA61]" /> Order by Voice
                  </button>
                </div>
                <button
                  onClick={onBrowseStore}
                  className="h-12 px-8 rounded-full bg-transparent text-white font-bold text-base border-2 border-white/55 hover:bg-white/10 hover:border-white hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Store className="w-5 h-5" /> Browse Full Store
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-1.5 text-xs sm:text-sm font-semibold text-white/85">
                <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4 text-[#6bd39a]" /> Cash on delivery</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4 text-[#6bd39a]" /> Free delivery over PKR 2,000</span>
              </div>

            </div>

            {/* basket */}
            <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 flex justify-center self-center">
              <div className="relative w-[min(84vw,360px)] sm:w-[min(66vw,430px)] lg:w-full lg:max-w-[540px] lg:-mt-8 lg:-mb-6">
                <span className="absolute inset-[8%] rounded-full bg-[#6bd39a]/35 blur-3xl pointer-events-none" />
                <img
                  src={BASKET_SRC}
                  alt="Basket full of fresh groceries"
                  width={900}
                  height={934}
                  decoding="async"
                  className="relative block w-full h-auto select-none drop-shadow-[0_26px_26px_rgba(0,0,0,.4)]"
                  draggable={false}
                />
              </div>
            </div>

            {/* trust bar: mobile/tablet (inside the green banner) */}
            {renderTrust('lg:hidden grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 sm:gap-5 rounded-2xl bg-white p-3 sm:p-4 shadow-[0_14px_30px_-14px_rgba(0,0,0,.45)]')}
          </div>
        </div>

        {/* trust card: desktop only, hangs over the bottom edge of the hero into the white space */}
        {renderTrust('hidden lg:grid grid-cols-4 gap-5 absolute left-12 right-12 bottom-0 translate-y-[40%] z-20 rounded-2xl bg-white p-4 shadow-[0_14px_30px_-14px_rgba(0,0,0,.45)]')}
        </div>
      </section>

      {/* ---------------- aisles marquee ---------------- */}
      <section className="bg-white pt-10 sm:pt-14 pb-2">
        <div className="text-center px-4 mb-5">
          <span className="inline-block px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-[11px] font-bold tracking-wide">SHOP BY AISLE</span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-black text-[#2a6b43]">Everything your kitchen needs</h2>
        </div>
        <div className="lp-fade overflow-hidden">
          <div className="lp-marquee flex w-max gap-3 sm:gap-4 py-2">
            {[...AISLES, ...AISLES].map((a, idx) => (
              <button
                key={`${a.name}-${idx}`}
                onClick={() => openAisle(a.name)}
                tabIndex={idx >= AISLES.length ? -1 : 0}
                aria-hidden={idx >= AISLES.length}
                className="group shrink-0 flex items-center gap-3 pl-2 pr-5 py-2 rounded-full bg-white border border-[#e0f4e7] shadow-sm hover:border-[#1DAA61] hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e0f4e7] to-[#f3fbf6] text-[#2a6b43] flex items-center justify-center group-hover:bg-[#1DAA61] group-hover:text-white transition-colors">
                  <a.icon className="w-5 h-5" />
                </span>
                <span className="text-sm font-bold text-[#1f5233] whitespace-nowrap">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <div className="max-w-[1240px] mx-auto px-3 sm:px-6 py-10 sm:py-14">
        <HowItWorks onOpenVoice={onOpenVoice} onOpenImageScanner={onOpenImageScanner} />
      </div>

      {/* ---------------- FAQ ---------------- */}
      <section className="max-w-[860px] mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-[11px] font-bold tracking-wide">FAQ</span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-black text-[#2a6b43]">Questions people ask</h2>
        </div>
        <div className="space-y-2.5">
          {FAQ.map((f, idx) => {
            const on = open === idx;
            return (
              <div
                key={f.q}
                className={`rounded-2xl border bg-white transition-all ${on ? 'border-[#1DAA61] shadow-lg shadow-[#1DAA61]/10' : 'border-[#e0f4e7] hover:border-[#b3e4c4]'}`}
              >
                <button
                  onClick={() => setOpen(on ? null : idx)}
                  className="w-full flex items-center justify-between gap-3 text-left px-4 sm:px-5 py-3.5 cursor-pointer"
                  aria-expanded={on}
                >
                  <span className="font-bold text-sm sm:text-base text-[#1f5233]">{f.q}</span>
                  <ChevronDown className={`w-5 h-5 shrink-0 text-[#1DAA61] transition-transform ${on ? 'rotate-180' : ''}`} />
                </button>
                {on && (
                  <p className="px-4 sm:px-5 pb-4 -mt-1 text-sm text-[#4d7a5c] leading-relaxed" dir="auto">
                    {f.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- closing banner ---------------- */}
      <section className="px-3 sm:px-6 pb-12 sm:pb-16">
        <div className="relative overflow-hidden max-w-[1140px] mx-auto rounded-3xl bg-gradient-to-br from-[#148a4c] via-[#1DAA61] to-[#3fc27b] text-white text-center px-5 py-10 sm:py-14 space-y-4 shadow-xl shadow-[#1DAA61]/25">
          <span className="lp-blob absolute -top-16 -left-10 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
          <span className="lp-blob absolute -bottom-20 -right-12 w-64 h-64 rounded-full bg-white/10 pointer-events-none" style={{ animationDelay: '3s' }} />
          <h2 className="relative text-2xl sm:text-4xl font-extrabold tracking-tight">Ready to make grocery shopping easier?</h2>
          <p className="relative text-sm sm:text-base text-white/90 max-w-2xl mx-auto">Browse the full supermarket catalog or order with your voice in seconds.</p>
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2 max-w-md sm:max-w-none mx-auto">
            <button
              onClick={onBrowseStore}
              className="h-12 px-7 rounded-full bg-white text-[#2a6b43] font-bold text-sm sm:text-base hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Store className="w-5 h-5 text-[#1DAA61]" /> Browse Full Store <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onOpenVoice}
              className="h-12 px-6 rounded-full bg-white/15 border border-white/60 text-white font-bold text-sm sm:text-base hover:bg-white/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mic className="w-5 h-5" /> Try Voice Assistant
            </button>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[.08] p-6 sm:p-9">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dcebd5] text-[#294d35]">
                <MessageCircle size={23} />
              </div>
              <div>
                <p className="font-semibold">AssaanMart Assistant</p>
                <p className="mt-1 text-xs text-[#c5dbb9]">Example conversation</p>
              </div>
            </div>

            <div className="my-9 space-y-5">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#dcebd5] p-4 text-sm leading-6 text-[#294d35]">
                I need apples, milk and some biscuits.
              </div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white/10 p-4 text-sm leading-6 text-white">
                Sure! I can help you find those items. Let's add them to your
                grocery list.
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dcebd5] text-[#294d35]">
                <Mic size={21} />
              </div>
              <div>
                <p className="text-sm font-semibold">Voice interaction</p>
                <p className="mt-1 text-xs text-[#c5dbb9]">Speak naturally</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IMAGE SEARCH */}
      <section className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[30px] bg-[#eff5e9] p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
              Smart image search
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Find Products
              <span className="block text-[#71966b]">With an Image.</span>
            </h2>
            <p className="mt-5 text-sm leading-8 text-[#718171]">
              Have a picture of the product you want? Use image search to make
              finding your desired grocery items easier.
            </p>
            {onOpenImageScanner && (
              <button
                onClick={onOpenImageScanner}
                className="mt-8 flex items-center gap-3 rounded-full bg-[#527c55] px-7 py-4 text-sm font-semibold text-white transition hover:-translate-y-1 hover:bg-[#3d6543]"
              >
                <Camera size={18} /> Try Image Search
              </button>
            )}
          </div>

          <div className="h-[280px] overflow-hidden rounded-[25px] shadow-lg sm:h-[350px]">
            <SafeImage src={images.vegetables} alt="Fresh grocery products" className="h-full" />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#e7efdf] px-6 py-14 text-center sm:px-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#63845d] shadow-sm">
            <ShoppingBasket size={27} />
          </div>
          <h2 className="mt-6 text-3xl font-bold sm:text-4xl">
            Ready to Make Shopping Easier?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#718171]">
            Explore your grocery essentials and experience a smarter way to
            shop with AssaanMart.
          </p>
          <button
            onClick={onBrowseStore}
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#527c55] px-8 py-4 text-sm font-semibold text-white transition duration-300 hover:-translate-y-1 hover:bg-[#3d6543] hover:shadow-lg"
          >
            Start Shopping <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <style>{`
        @keyframes lp-slide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes lp-blob{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(14px,10px) scale(1.07)}}
        @keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes lp-btnpulse{0%{transform:scale(1);opacity:.45}100%{transform:scale(1.18,1.45);opacity:0}}
        @keyframes lp-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .lp-slide{animation:lp-slide .6s cubic-bezier(.3,1.2,.5,1) both}
        .lp-blob{animation:lp-blob 9s ease-in-out infinite}
        .lp-float{animation:lp-float 4s ease-in-out infinite}
        .lp-btnpulse{animation:lp-btnpulse 2.4s ease-out infinite}
        .lp-marquee{animation:lp-marquee 38s linear infinite}
        .lp-marquee:hover{animation-play-state:paused}
        .lp-fade{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
        .lp-dots-w{background-image:radial-gradient(#fff 1px,transparent 1px);background-size:26px 26px;opacity:.09;-webkit-mask-image:linear-gradient(180deg,#000,transparent 90%);mask-image:linear-gradient(180deg,#000,transparent 90%)}
        .lp-dots{background-image:radial-gradient(#1DAA61 1px,transparent 1px);background-size:26px 26px;opacity:.07;-webkit-mask-image:linear-gradient(180deg,#000,transparent 85%);mask-image:linear-gradient(180deg,#000,transparent 85%)}
        @media (prefers-reduced-motion:reduce){
          .lp-slide,.lp-blob,.lp-float,.lp-btnpulse,.lp-marquee{animation:none}
          .lp-marquee{flex-wrap:wrap;width:auto;justify-content:center;padding:0 12px}
          .lp-marquee > [aria-hidden=true]{display:none}
        }
      `}</style>
    </div>
  );
};