import React, { useState } from 'react';
import { Phone, Mail, Clock, MessageCircle, Send } from 'lucide-react';

const CONTACT = {
  phone: '+92 300 0000000',
  whatsapp: '923000000000',
  email: 'assanmart@gmail.com',
  hours: 'Every day, 9:00 AM to 10:00 PM',
};

interface ContactPageProps {
  user?: { name?: string; email?: string; phone?: string } | null;
}

export const ContactPage: React.FC<ContactPageProps> = ({ user }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`AssanMart message from ${name || 'a customer'}`);
    const body = encodeURIComponent(`${message}\n\nName: ${name}\nEmail: ${email}`);
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const items = [
    { icon: Phone, label: 'Call us', value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, '')}` },
    { icon: MessageCircle, label: 'WhatsApp', value: 'Chat with us', href: `https://wa.me/${CONTACT.whatsapp}` },
    { icon: Mail, label: 'Email', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { icon: Clock, label: 'Open', value: CONTACT.hours },
  ];

  const field = 'w-full rounded-xl border border-[#e0f4e7] bg-[#f3fbf6] px-4 py-3 text-sm text-[#2a6b43] placeholder-[#4d7a5c]/60 focus:outline-none focus:bg-white focus:border-[#5bbd7e] focus:ring-4 focus:ring-[#5bbd7e]/15 transition';

  return (
    <div className="min-h-[70vh]">
      <section className="bg-gradient-to-b from-[#f3fbf6] to-white border-b border-[#e0f4e7]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[#e0f4e7] text-[#2a6b43] text-xs font-bold tracking-wide">CONTACT US</span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-[#2a6b43]">
            We are happy to <span className="text-[#46a468]">help</span>
          </h1>
          <p className="mt-3 text-sm sm:text-lg text-[#4d7a5c] max-w-xl mx-auto">Question about an order, a product or delivery? Send us a message.</p>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        {/* details */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((it) => {
            const inner = (
              <>
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#e0f4e7] to-[#b3e4c4] text-[#378553] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <it.icon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-[#46a468]">{it.label}</span>
                  <span className="block text-sm font-semibold text-[#2a6b43] break-words">{it.value}</span>
                </span>
              </>
            );
            const cls = 'group flex items-center gap-3 rounded-2xl bg-white border border-[#e0f4e7] p-3.5 shadow-sm';
            return it.href ? (
              <a key={it.label} href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`${cls} hover:shadow-md hover:border-[#96d9ae] hover:-translate-y-0.5 transition-all`}>
                {inner}
              </a>
            ) : (
              <div key={it.label} className={cls}>{inner}</div>
            );
          })}
        </div>

        {/* form */}
        <form onSubmit={submit} className="lg:col-span-3 rounded-3xl bg-white border border-[#e0f4e7] shadow-sm p-5 sm:p-8 space-y-4">
          <h2 className="text-lg sm:text-xl font-black text-[#2a6b43]">Send a message</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className={field} type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <textarea className={`${field} min-h-[140px] resize-y`} placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} required />
          <button type="submit" className="h-12 px-7 rounded-full bg-gradient-to-r from-[#46a468] to-[#5bbd7e] text-white font-bold text-sm shadow-lg shadow-[#46a468]/25 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto">
            <Send className="w-4 h-4" /> Send message
          </button>
          {sent && <p className="text-sm text-[#378553] font-semibold">Your mail app should have opened with the message ready to send.</p>}
        </form>
      </section>
    </div>
  );
};