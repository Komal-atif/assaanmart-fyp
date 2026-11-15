import React from 'react';
import { Mic, Camera, Truck, Wallet, Leaf, PackageCheck, ShieldCheck, Languages, ArrowRight } from 'lucide-react';

interface ServicesPageProps {
  onOpenVoice: () => void;
  onOpenImageScanner: () => void;
  onBrowseStore: () => void;
  onContact: () => void;
}

const SERVICES = [
  { icon: Mic, title: 'Voice ordering', text: 'Say your whole grocery list in one go. AssanMart understands brands, sizes and quantities, then confirms each item with you.', tag: 'Most loved' },
  { icon: Languages, title: 'Urdu & English', text: 'Speak the way you normally do. Roman Urdu, Urdu script and English all work, even mixed in one sentence.' },
  { icon: Camera, title: 'Photo list scanner', text: 'Took a photo of your handwritten list? Upload it and we find every item, then let you confirm by voice.' },
  { icon: Leaf, title: 'Fresh fruit & vegetables', text: 'Daily fresh produce, picked and packed for your order with honest everyday prices.' },
  { icon: Truck, title: 'Doorstep delivery', text: 'Delivery fee is PKR 150, and it is free on orders of PKR 2,000 or more.' },
  { icon: Wallet, title: 'Cash on delivery', text: 'Pay when your groceries arrive. No card needed and no advance payment.' },
  { icon: PackageCheck, title: 'Order tracking', text: 'Follow your order from confirmed and packed to out for delivery, right from My Account.' },
  { icon: ShieldCheck, title: 'Saved profile', text: 'Sign in once. Your name, phone and address are remembered for faster checkout next time.' },
];

export const ServicesPage: React.FC<ServicesPageProps> = ({ onOpenVoice, onOpenImageScanner, onBrowseStore, onContact }) => (
  <div className="min-h-[70vh]">
    {/* heading */}
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f3fbf6] to-white border-b border-[#e0f4e7]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-xs font-bold tracking-wide">OUR SERVICES</span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-[#2a6b43]">
          Everything you need, <span className="text-[#46a468]">one voice away</span>
        </h1>
        <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-[#4d7a5c] max-w-2xl mx-auto">
          From speaking your order to getting fresh groceries at your door, here is what AssanMart does for you.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center max-w-sm sm:max-w-none mx-auto">
          <button onClick={onOpenVoice} className="h-12 px-7 rounded-full bg-gradient-to-r from-[#46a468] to-[#5bbd7e] text-white font-bold text-sm shadow-lg shadow-[#46a468]/25 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <Mic className="w-4 h-4" /> Try voice order
          </button>
          <button onClick={onBrowseStore} className="h-12 px-7 rounded-full bg-white text-[#2a6b43] font-bold text-sm border-2 border-[#b3e4c4] hover:border-[#5bbd7e] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
            Browse store <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>

    {/* cards */}
    <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {SERVICES.map((s, i) => (
          <article
            key={s.title}
            className="srv group relative rounded-2xl bg-white border border-[#e0f4e7] p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#96d9ae] transition-all duration-300"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {s.tag && <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{s.tag}</span>}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#e0f4e7] to-[#b3e4c4] text-[#378553] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <s.icon className="w-6 h-6" />
            </div>
            <h3 className="mt-4 font-bold text-[#2a6b43] text-base">{s.title}</h3>
            <p className="mt-1.5 text-sm text-[#4d7a5c] leading-relaxed">{s.text}</p>
          </article>
        ))}
      </div>
      <style>{`
        @keyframes srv-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .srv{animation:srv-in .55s ease-out both}
        @media (prefers-reduced-motion:reduce){.srv{animation:none}}
      `}</style>

      {/* scanner + contact strip */}
      <div className="mt-10 rounded-3xl bg-gradient-to-r from-[#46a468] to-[#7fcf9a] p-6 sm:p-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black">Have a handwritten list?</h2>
          <p className="mt-1 text-sm sm:text-base text-white/90 max-w-xl">Take a photo, upload it, and we will turn it into a basket you can confirm by voice.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button onClick={onOpenImageScanner} className="h-11 px-6 rounded-full bg-white text-[#2a6b43] font-bold text-sm hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <Camera className="w-4 h-4" /> Upload list photo
          </button>
          <button onClick={onContact} className="h-11 px-6 rounded-full bg-white/15 border border-white/60 text-white font-bold text-sm hover:bg-white/25 active:scale-95 transition-all cursor-pointer">
            Talk to us
          </button>
        </div>
      </div>
    </section>
  </div>
);