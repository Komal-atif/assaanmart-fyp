import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Truck, CreditCard, Banknote, ShieldCheck, MapPin, Phone, User as UserIcon, LocateFixed, Loader2, Mic, MicOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartItem, Order, User } from '../types';
import { placeWebOrder, fetchProfile } from '../services/orderApi';
import { useVoiceLoop } from '../hooks/useVoiceLoop';
import { getBackendUrl, scanSay, formVoiceReply } from '../services/voiceApi';
import { formatOrderId } from '../utils/orderId';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  user: User | null;
  onOrderSuccess: (order: Order) => void;
  /** language of the voice helper */
  lang?: 'english' | 'urdu';
}

const CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  user,
  onOrderSuccess,
  lang = 'english',
}) => {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState(CITIES[0]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [savedNote, setSavedNote] = useState(false);
  const paymentMethod = 'cod'; // Cash on Delivery is the only payment method
  const [deliverySlot, setDeliverySlot] = useState('Express (30-45 mins)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [submitError, setSubmitError] = useState('');

  // ---------- voice helper: greets by name, asks only for the delivery address, then confirms ----------
  type CStep = 'address' | 'saved' | 'final' | null;
  const [voiceOn, setVoiceOn] = useState(false);
  const [vPhase, setVPhase] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [agentText, setAgentText] = useState('');
  const stepRef = useRef<CStep>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef(0);
  const activeRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const vals = useRef({ name: '', address: '', total: 0 });
  const ur = lang === 'urdu';
  const tt = (en: string, u: string) => (ur ? u : en);
  const total = () => {
    const sub = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    return sub + (sub >= 2000 ? 0 : 150);
  };
  vals.current = { name, address, total: total() };
  const addrNow = useRef('');
  addrNow.current = address;

  const stopSpeech = () => {
    playerRef.current?.pause();
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r();
    }
  };
  const playUrl = (url: string) =>
    new Promise<void>((resolve) => {
      const a = playerRef.current || (playerRef.current = new Audio());
      if (resolverRef.current) resolverRef.current();
      resolverRef.current = resolve;
      const done = () => {
        if (resolverRef.current === resolve) resolverRef.current = null;
        resolve();
      };
      a.onended = done;
      a.onerror = done;
      a.src = url.startsWith('http') ? url : `${getBackendUrl()}${url}`;
      a.play().catch(done);
    });

  const listenNow = async () => {
    if (!activeRef.current) return;
    try {
      await voice.open();
    } catch {
      stopVoice();
      return;
    }
    setVPhase('listening');
    voice.listen();
  };

  const say = async (text: string, listen = true) => {
    if (!activeRef.current) return;
    const my = ++tokenRef.current;
    setAgentText(text);
    voice.pause();
    setVPhase('speaking');
    try {
      const d = await scanSay(text, lang);
      if (my !== tokenRef.current) return;
      if (d.audio_url) {
        await playUrl(d.audio_url);
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch {
      /* no voice server: the form still works by typing */
    }
    if (my !== tokenRef.current) return;
    if (listen) await listenNow();
    else setVPhase('idle');
  };

  const askFinal = () => {
    stepRef.current = 'final';
    const v = vals.current;
    return say(
      tt(
        `Delivering to ${v.address}. Your total is ${Math.round(v.total)} rupees, cash on delivery. Shall I place the order? Say yes or no.`,
        `ڈیلیوری ${v.address} پر ہوگی۔ کل رقم ${Math.round(v.total)} روپے ہے، کیش آن ڈیلیوری۔ کیا آرڈر کر دوں؟ ہاں یا نہیں کہیں۔`
      )
    );
  };
  const askAddress = (first = false) => {
    stepRef.current = 'address';
    const n = vals.current.name;
    return say(
      first
        ? tt(`Hello ${n}! What is your delivery address? You can say it, or press "Use my current location".`,
             `${n} صاحب/صاحبہ خوش آمدید! آپ کا ڈیلیوری ایڈریس کیا ہے؟ آپ بول سکتے ہیں، یا "میری موجودہ لوکیشن" کا بٹن دبائیں۔`)
        : tt('Okay. Please say your delivery address, or press "Use my current location".',
             'ٹھیک ہے۔ اپنا ڈیلیوری ایڈریس بولیں، یا "میری موجودہ لوکیشن" کا بٹن دبائیں۔')
    );
  };

  const handleUtterance = async (blob: Blob) => {
    const step = stepRef.current;
    if (!step || !activeRef.current) return;
    setVPhase('thinking');
    try {
      if (step === 'address') {
        const r = await formVoiceReply(blob, 'address', lang);
        if (!r.heard) return listenNow();
        if (!r.ok || !r.value) return say(tt("Sorry, I didn't catch the address. Please say it again.", 'معذرت، ایڈریس سمجھ نہیں آیا۔ دوبارہ بولیں۔'));
        vals.current = { ...vals.current, address: r.value };
        setAddress(r.value);
        setCoords(null);
        return askFinal();
      }
      const r = await formVoiceReply(blob, 'confirm', lang);
      if (!r.heard) return listenNow();
      if (r.action === 'yes') {
        stepRef.current = null;
        await say(tt('Placing your order now.', 'آپ کا آرڈر کر رہا ہوں۔'), false);
        setTimeout(() => formRef.current?.requestSubmit(), 200);
        return;
      }
      if (r.action === 'no') return askAddress(false);
      return say(tt('Please say yes to place the order, or no to change the address.', 'آرڈر کے لیے ہاں کہیں، ایڈریس بدلنے کے لیے نہیں۔'));
    } catch (e) {
      console.warn('checkout voice failed:', e);
      return listenNow();
    }
  };

  const voice = useVoiceLoop({ onUtterance: handleUtterance });

  const stopVoice = () => {
    activeRef.current = false;
    tokenRef.current += 1;
    stopSpeech();
    voice.pause();
    voice.stopAll();
    stepRef.current = null;
    setVoiceOn(false);
    setVPhase('idle');
  };

  const startVoice = () => {
    activeRef.current = true;
    setVoiceOn(true);
    if (vals.current.address.trim()) {
      // a saved address exists: just confirm it
      stepRef.current = 'saved';
      const v = vals.current;
      return say(
        tt(`Hello ${v.name}! Should I deliver to ${v.address}? Your total is ${Math.round(v.total)} rupees, cash on delivery. Say yes to place the order, or no to change the address.`,
           `${v.name} خوش آمدید! کیا ${v.address} پر ڈیلیوری کر دوں؟ کل رقم ${Math.round(v.total)} روپے، کیش آن ڈیلیوری۔ آرڈر کے لیے ہاں کہیں، ایڈریس بدلنے کے لیے نہیں۔`)
      );
    }
    return askAddress(true);
  };
  const startRef = useRef(startVoice);
  startRef.current = startVoice;

  // closing the window (or finishing the order) always releases the microphone and the sound
  useEffect(() => {
    if ((!isOpen || completedOrder) && (activeRef.current || voiceOn)) stopVoice();
  }, [isOpen, completedOrder]);

  // Delivery details the customer gave before come back filled in: they only have to confirm them.
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    fetchProfile().then((p) => {
      if (!alive || !p) return;
      if (p.name) setName(p.name);
      if (p.phone) setPhone(p.phone);
      if (p.address) setAddress(p.address);
      if (p.city) setCity(p.city);
      if (p.lat != null && p.lng != null) setCoords({ lat: p.lat, lng: p.lng });
      if (p.address) setSavedNote(true);
      if (p.name) vals.current = { ...vals.current, name: p.name };
      if (p.address) vals.current = { ...vals.current, address: p.address };
    }).catch(() => {}).finally(() => {
      // the helper starts by itself: no button needed
      if (alive && cart.length > 0) setTimeout(() => { if (alive && !activeRef.current) startRef.current(); }, 500);
    });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  // "Use my current location": the browser gives the position, OpenStreetMap turns it into an address.
  const useMyLocation = () => {
    setLocError('');
    if (activeRef.current) { stopSpeech(); voice.pause(); tokenRef.current += 1; setVPhase('idle'); }
    if (!navigator.geolocation) {
      setLocError('Your browser cannot share its location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
          const d = await r.json();
          const a = d.address || {};
          const line = [a.house_number, a.road, a.neighbourhood || a.suburb || a.quarter].filter(Boolean).join(', ');
          setAddress(line || d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          const c = a.city || a.town || a.village || a.state_district || a.county || '';
          const hit = CITIES.find((x) => c.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(c.toLowerCase()));
          if (hit) setCity(hit);
          else if (c) setCity(c);
        } catch {
          setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } finally {
          setLocating(false);
          if (activeRef.current) {
            // the customer chose the location button instead of speaking: carry on with the confirmation
            setTimeout(() => { vals.current = { ...vals.current, address: addrNow.current }; askFinal(); }, 300);
          }
        }
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === 1 ? 'Location permission was blocked. Allow it in the browser, or type your address.' : "Couldn't get your location. Please type your address.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const deliveryFee = subtotal >= 2000 ? 0 : 150;
  const grandTotal = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRef.current && stepRef.current !== null) stopVoice();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      alert('Please fill out all required delivery fields.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const paymentLabel = 'Cash on Delivery';

    try {
      // The server saves the order (and re-checks the prices) before we show "confirmed".
      const placed = await placeWebOrder({
        items: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
        customer_name: name,
        phone,
        address,
        city,
        payment_method: paymentLabel,
        delivery_slot: deliverySlot,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });

      const order: Order = {
        id: formatOrderId(placed.order_id),
        date: new Date().toLocaleDateString('en-PK', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        items: [...cart],
        subtotal: placed.subtotal,
        deliveryFee: placed.delivery_fee,
        total: placed.total,
        customerName: name,
        phone,
        address,
        city,
        paymentMethod: paymentLabel,
        status: 'Confirmed',
      };

      setCompletedOrder(order);
      onOrderSuccess(order);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3fc27b', '#1daa61', '#96d9ae', '#f59e0b'],
      });
    } catch (err: any) {
      setSubmitError(
        err?.message && !/HTTP|Failed to fetch/i.test(err.message)
          ? err.message
          : "We couldn't place your order. Please check that the AssanMart server is running and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {completedOrder ? 'Order Confirmed 🎉' : 'Checkout & Confirm Order'}
            </h3>
            {completedOrder && (
              <p className="text-xs text-slate-500">Your groceries are being prepared with care</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {completedOrder ? (
            /* Order Success State / Receipt */
            <div className="text-center space-y-6 py-4 animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-[#e0f4e7] text-[#148a4c] flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-2xl font-black text-slate-900">
                  Shukriya, {completedOrder.customerName}!
                </h4>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  Your order <strong className="text-[#0f6e3d]">{completedOrder.id}</strong> has been received and confirmed. Our delivery rider will reach your address in {completedOrder.city}.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-left text-xs space-y-3 max-w-lg mx-auto">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-semibold">Order ID</span>
                  <span className="font-bold text-slate-900">{completedOrder.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-semibold">Delivery Address</span>
                  <span className="font-semibold text-slate-900 text-right max-w-xs truncate">
                    {completedOrder.address}, {completedOrder.city}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-semibold">Contact Phone</span>
                  <span className="font-semibold text-slate-900">{completedOrder.phone}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-semibold">Payment</span>
                  <span className="font-semibold text-[#0f6e3d]">{completedOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-semibold">Items ({completedOrder.items.length})</span>
                  <span className="font-semibold text-slate-900">
                    {completedOrder.items.map((i) => `${i.name} (x${i.quantity})`).slice(0, 3).join(', ')}
                    {completedOrder.items.length > 3 && '...'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
                  <span>Total Amount Paid / Payable</span>
                  <span className="text-[#0f6e3d] font-sans">PKR {completedOrder.total.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-8 py-3 rounded-full bg-[#1daa61] hover:bg-[#148a4c] text-white font-bold text-sm shadow-md shadow-[#1daa61]/30 transition-all cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : (
            /* Checkout Form */
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              
              {/* Delivery Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#148a4c]" />
                  Delivery Information
                </h4>

                <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 rounded-2xl border border-[#b3e4c4] bg-[#f3fbf6]/70 p-3">
                  <button
                    type="button"
                    onClick={voiceOn ? stopVoice : startVoice}
                    className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      voiceOn ? 'bg-slate-200 text-slate-700' : 'bg-[#1daa61] hover:bg-[#148a4c] text-white'
                    }`}
                  >
                    {voiceOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {voiceOn ? 'Voice off' : 'Voice on'}
                  </button>
                  <p className="text-[11px] text-[#1f5233] leading-snug pt-1" dir="auto">
                    {voiceOn
                      ? `${vPhase === 'listening' ? '🎙 Listening… ' : vPhase === 'speaking' ? '🔊 ' : vPhase === 'thinking' ? '… ' : ''}${agentText}`
                      : 'Turn voice on and just tell me your delivery address, or use the location button.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Komal Atif"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#3fc27b] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="0300-1234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#3fc27b] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="px-3 py-2 rounded-full border border-[#96d9ae] bg-[#f3fbf6] text-[#2a6b43] text-xs font-bold flex items-center gap-1.5 hover:bg-[#e0f4e7] cursor-pointer disabled:opacity-60"
                  >
                    {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                    {locating ? 'Finding you…' : 'Use my current location'}
                  </button>
                  {savedNote && <span className="text-[11px] text-slate-500">Your saved delivery details are filled in — please confirm them.</span>}
                  {locError && <span className="text-[11px] text-amber-600">{locError}</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Street Address &amp; House Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 4B, Al-Noor Heights, Gulshan"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#3fc27b] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      City *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#3fc27b] focus:outline-hidden cursor-pointer"
                    >
                      {(CITIES.includes(city) ? CITIES : [city, ...CITIES]).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Delivery Timing Slot */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#148a4c]" />
                  Select Delivery Slot
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { slot: 'Express (30-45 mins)', note: 'Fastest delivery' },
                    { slot: 'Evening (6 PM - 9 PM)', note: 'Today evening' },
                    { slot: 'Morning (9 AM - 12 PM)', note: 'Tomorrow morning' },
                  ].map((s) => (
                    <button
                      key={s.slot}
                      type="button"
                      onClick={() => setDeliverySlot(s.slot)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        deliverySlot === s.slot
                          ? 'border-[#3fc27b] bg-[#f3fbf6]/70 text-[#153a24] ring-2 ring-[#3fc27b]/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{s.slot}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{s.note}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#148a4c]" />
                  Payment Method
                </h4>

                <div className="p-3 rounded-xl border border-[#3fc27b] bg-[#f3fbf6]/70 text-[#153a24] ring-2 ring-[#3fc27b]/20 flex items-center gap-3">
                  <Banknote className="w-6 h-6 text-[#0f6e3d] shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Cash on Delivery</p>
                    <p className="text-[11px] text-slate-500">Pay cash at your doorstep</p>
                  </div>
                </div>
              </div>

              {/* Order Final Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({cart.length} unique items)</span>
                  <span className="font-semibold text-slate-900">PKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-slate-900">
                    {deliveryFee === 0 ? <span className="text-[#0f6e3d] font-bold">FREE</span> : `PKR ${deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Payable Amount</span>
                  <span className="text-[#0f6e3d] text-base font-sans">PKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {submitError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{submitError}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full bg-[#1daa61] hover:bg-[#148a4c] text-white font-extrabold text-sm shadow-md shadow-[#1daa61]/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Placing order...</span>
                  ) : (
                    <span>Confirm &amp; Place Order · PKR {grandTotal.toLocaleString()}</span>
                  )}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};