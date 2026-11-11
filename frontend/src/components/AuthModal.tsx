import React, { useEffect, useRef, useState } from 'react';
import { X, User as UserIcon, Phone, Lock, ArrowRight, Loader2, MapPin, LocateFixed, Mic, MicOff } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../supabaseClient';
import { useVoiceLoop } from '../hooks/useVoiceLoop';
import { getBackendUrl, scanSay, formVoiceReply } from '../services/voiceApi';
import { saveProfile } from '../services/orderApi';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  /** language of the voice helper (chosen by the welcome agent) */
  lang?: 'english' | 'urdu';
  /** the voice helper starts by itself as soon as the form opens (like the photo scanner); can be switched off on screen */
  autoVoice?: boolean;
}

// Customers sign in with their PHONE NUMBER + password. Behind the scenes Supabase gets a placeholder email made from
// the number, so nobody has to receive or confirm an email.
// Set VITE_PHONE_EMAIL_DOMAIN in .env to a domain that has real mail (MX) records; Supabase rejects domains without them.
const PHONE_DOMAIN = (import.meta.env.VITE_PHONE_EMAIL_DOMAIN as string | undefined) || 'phone.assanmart.pk';

function normalizePhone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2);
  if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return d;
}
const isValidPhone = (d: string) => /^03\d{9}$/.test(d);
const phoneToEmail = (d: string) => `${d}@${PHONE_DOMAIN}`;
const prettyPhone = (d: string) => (d.length === 11 ? `${d.slice(0, 4)}-${d.slice(4)}` : d);

type VoiceStep = 'has' | 'loginphone' | 'name' | 'phone' | 'address' | 'confirm' | 'which' | null;

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess, lang = 'english', autoVoice = true }) => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // ---- voice helper (agent asks name -> phone -> address, the form fills itself) ----
  const [voiceOn, setVoiceOn] = useState(false);
  const [vPhase, setVPhase] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [agentText, setAgentText] = useState('');
  const stepRef = useRef<VoiceStep>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef(0);
  const activeRef = useRef(false);
  const valuesRef = useRef({ name: '', phone: '', address: '' });
  const skippedAddressRef = useRef(false);
  const passRef = useRef<HTMLInputElement>(null);
  valuesRef.current = { name, phone, address };

  const ur = lang === 'urdu';
  const tt = (en: string, u: string) => (ur ? u : en);

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
      setError('Microphone access is blocked. Please allow it in your browser settings, or type the details.');
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

  // what is still missing? (details already known - typed before, or remembered from an earlier try - are never asked again)
  const nextAfter = (done: 'start' | 'name' | 'phone' | 'address'): Exclude<VoiceStep, null> => {
    const v = valuesRef.current;
    const order = ['name', 'phone', 'address'] as const;
    for (let i = done === 'start' ? 0 : order.indexOf(done) + 1; i < order.length; i++) {
      const k = order[i];
      if (k === 'address' ? !v.address && !skippedAddressRef.current : !v[k]) return k;
    }
    return 'confirm';
  };

  const ask = (step: Exclude<VoiceStep, null>) => {
    stepRef.current = step;
    if (step === 'has')
      return say(tt('Welcome to AssanMart! To place your order I need to know who you are. Do you already have an account with us? Say yes or no.',
                    'آسان مارٹ میں خوش آمدید! آرڈر کے لیے آپ کی پہچان ضروری ہے۔ کیا آپ کا پہلے سے اکاؤنٹ ہے؟ ہاں یا نہیں کہیں۔'));
    if (step === 'loginphone') return say(tt('Okay. What is your phone number?', 'ٹھیک ہے۔ آپ کا فون نمبر کیا ہے؟'));
    if (step === 'name') return say(tt("Let's create your account. What is your full name?", 'آئیں آپ کا اکاؤنٹ بناتے ہیں۔ آپ کا پورا نام کیا ہے؟'));
    if (step === 'phone') return say(tt('Thank you. What is your phone number?', 'شکریہ۔ آپ کا فون نمبر کیا ہے؟'));
    if (step === 'address') return say(tt('And your delivery address? Say it now, or press the Use my current location button. You can also say skip.', 'اور آپ کی ڈیلیوری کا ایڈریس؟ ابھی بولیں، یا یوز مائی کرنٹ لوکیشن کا بٹن دبائیں۔ آپ سکپ بھی کہہ سکتے ہیں۔'));
    if (step === 'which') return say(tt('Which one should I change: name, phone or address?', 'کیا بدلنا ہے: نام، فون یا ایڈریس؟'));
    const v = valuesRef.current;
    const digits = v.phone.split('').join(' ');
    return say(
      tt(
        `Please check. Name: ${v.name}. Phone: ${digits}. ${v.address ? 'Address: ' + v.address + '.' : ''} Is everything correct?`,
        `براہِ کرم دیکھ لیں۔ نام: ${v.name}۔ فون: ${digits}۔ ${v.address ? 'ایڈریس: ' + v.address + '۔' : ''} کیا سب ٹھیک ہے؟`
      )
    );
  };

  const handleUtterance = async (blob: Blob) => {
    const step = stepRef.current;
    if (!step || !activeRef.current) return;
    setVPhase('thinking');
    try {
      if (step === 'has') {
        const r = await formVoiceReply(blob, 'confirm', lang);
        if (!r.heard) return listenNow();
        if (r.action === 'yes') {
          setTab('login');
          return ask('loginphone');
        }
        if (r.action === 'no') {
          setTab('signup');
          return ask(nextAfter('start'));
        }
        return say(tt('Please say yes if you have an account, or no to create one.', 'اکاؤنٹ ہے تو ہاں کہیں، نہیں ہے تو نہیں۔'));
      }
      if (step === 'loginphone') {
        const r = await formVoiceReply(blob, 'phone', lang);
        if (!r.heard) return listenNow();
        if (!r.ok || !r.value) return say(tt('Please say the 11 digits of your phone number again.', 'براہِ کرم اپنے فون نمبر کے 11 ہندسے دوبارہ بولیں۔'));
        setPhone(r.value);
        stepRef.current = null;
        setTimeout(() => passRef.current?.focus(), 300);
        return say(tt('Thank you. Now type your password and press Sign In.', 'شکریہ۔ اب اپنا پاس ورڈ لکھیں اور سائن اِن دبائیں۔'), false);
      }
      if (step === 'name' || step === 'phone' || step === 'address') {
        const r = await formVoiceReply(blob, step, lang);
        if (!r.heard) return listenNow();
        if (step === 'address' && /skip|سکپ|اسکپ|چھوڑ/i.test(r.heard)) {
          setAddress('');
          skippedAddressRef.current = true;
          valuesRef.current = { ...valuesRef.current, address: '' };
          return ask('confirm');
        }
        if (!r.ok || !r.value) {
          if (step === 'phone')
            return say(tt("I couldn't get a full phone number. Please say the 11 digits again, for example zero three zero zero…", 'پورا فون نمبر نہیں سمجھ آیا۔ براہِ کرم 11 ہندسے دوبارہ بولیں۔'));
          return say(tt("Sorry, I didn't catch that. Please say it again.", 'معذرت، سمجھ نہیں آیا۔ دوبارہ بولیں۔'));
        }
        valuesRef.current = { ...valuesRef.current, [step]: r.value };
        if (step === 'name') setName(r.value);
        if (step === 'phone') setPhone(r.value);
        if (step === 'address') setAddress(r.value);
        return ask(nextAfter(step));
      }
      // confirm / which
      const r = await formVoiceReply(blob, 'confirm', lang);
      if (!r.heard) return listenNow();
      if (step === 'which' || (r.which && r.action !== 'yes')) {
        if (r.which) return ask(r.which);
        return say(tt('Please say name, phone or address.', 'براہِ کرم نام، فون یا ایڈریس کہیں۔'));
      }
      if (r.action === 'yes') {
        stepRef.current = null;
        setTimeout(() => passRef.current?.focus(), 300);
        return say(
          tt('Great! Now type a password of at least six characters, then press Create Account.', 'بہت خوب! اب کم از کم چھ حروف کا پاس ورڈ لکھیں، پھر کریٹ اکاؤنٹ دبائیں۔'),
          false
        );
      }
      if (r.action === 'no') return ask('which');
      return say(tt('Please say yes if everything is correct, or no to change something.', 'سب ٹھیک ہے تو ہاں کہیں، ورنہ نہیں۔'));
    } catch (e) {
      console.warn('form voice failed:', e);
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

  const startVoice = (first: Exclude<VoiceStep, null> = 'name') => {
    setError('');
    if (first === 'name') { setTab('signup'); first = nextAfter('start'); }
    else if (first === 'loginphone') setTab('login');
    activeRef.current = true;
    setVoiceOn(true);
    ask(first);
  };

  useEffect(() => {
    if (!isOpen) return;
    try { localStorage.setItem('am_signup_draft', JSON.stringify({ name, phone: normalizePhone(phone), address })); } catch { /* ignore */ }
  }, [name, phone, address, isOpen]);

  // closing the window always releases the microphone and the sound
  useEffect(() => {
    if (!isOpen && (activeRef.current || voiceOn)) stopVoice();
  }, [isOpen]);

  // opened because a guest pressed checkout: the agent starts by itself ("do you have an account?" -> collects the details)
  useEffect(() => {
    if (!isOpen) return;
    // details typed or spoken earlier (e.g. before pressing checkout) are shown again and not asked a second time
    try {
      const d = JSON.parse(localStorage.getItem('am_signup_draft') || '{}');
      skippedAddressRef.current = false;
      valuesRef.current = { name: valuesRef.current.name || d.name || '', phone: valuesRef.current.phone || d.phone || '', address: valuesRef.current.address || d.address || '' };
      if (valuesRef.current.name) setName(valuesRef.current.name);
      if (valuesRef.current.phone) setPhone(valuesRef.current.phone);
      if (valuesRef.current.address) setAddress(valuesRef.current.address);
    } catch { /* no saved draft */ }
    if (autoVoice) {
      const timer = setTimeout(() => startVoice('has'), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoVoice]);

  // ---- "Use my current location" ----
  // pressing the button while the agent is waiting for the address counts as the answer: it moves on to the check
  const applyLocated = (text: string) => {
    setAddress(text);
    valuesRef.current = { ...valuesRef.current, address: text };
    if (activeRef.current && stepRef.current === 'address') {
      voice.pause();
      ask('confirm');
    }
  };

  const useMyLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Your browser cannot share its location.');
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
          applyLocated(line || d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          setCity(a.city || a.town || a.village || a.state_district || a.county || '');
        } catch {
          applyLocated(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.code === 1 ? 'Location permission was blocked. Allow it in the browser, or type your address.' : "Couldn't get your location. Please type your address.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  if (!isOpen) return null;

  const switchTab = (t: 'login' | 'signup') => {
    const keepVoice = voiceOn;
    if (voiceOn) stopVoice();
    setTab(t);
    setError('');
    setMessage('');
    if (keepVoice) setTimeout(() => startVoice(t === 'signup' ? 'name' : 'loginphone'), 250);
  };

  const googleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error: gErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (gErr) {
      setLoading(false);
      setError(
        /provider is not enabled/i.test(gErr.message)
          ? 'Google sign-in is not switched on yet (Supabase → Authentication → Providers → Google).'
          : gErr.message
      );
    }
    // on success the browser goes to Google and comes back signed in
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (voiceOn) stopVoice();

    const typed = phone.trim();
    const isEmail = tab === 'login' && typed.includes('@');   // older accounts made with an email still work
    const digits = normalizePhone(typed);

    if (!typed || !password) {
      setError('Please enter your phone number and password.');
      return;
    }
    if (!isEmail && !isValidPhone(digits)) {
      setError('Please enter a valid Pakistani mobile number, e.g. 0300-1234567.');
      return;
    }
    if (tab === 'signup') {
      if (!name.trim()) return setError('Please enter your full name.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
    }

    const email = isEmail ? typed : phoneToEmail(digits);
    setLoading(true);
    try {
      if (tab === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim(), phone: digits, address: address.trim(), city } },
        });
        if (signUpError) throw signUpError;

        if (data.session && data.user) {
          await saveProfile({ name: name.trim(), phone: digits, address: address.trim(), city, lat: coords?.lat, lng: coords?.lng });
          try { localStorage.removeItem('am_signup_draft'); } catch { /* ignore */ }
          onLoginSuccess({ name: name.trim(), email: '', phone: digits, address: address.trim() } as unknown as User);
          onClose();
        } else {
          setMessage(
            'Account created, but Supabase is still waiting for an email confirmation. Turn off "Confirm email" (Authentication → Providers → Email) and sign in again.'
          );
          setTab('login');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (!data.user) throw new Error('Could not find user information.');
        const isPhoneAccount = (data.user.email || '').endsWith(`@${PHONE_DOMAIN}`);
        onLoginSuccess({
          name: data.user.user_metadata?.full_name || (isPhoneAccount ? 'Shopper' : data.user.email?.split('@')[0]) || 'Shopper',
          email: isPhoneAccount ? '' : data.user.email || '',
          phone: data.user.user_metadata?.phone || (isPhoneAccount ? digits : ''),
          address: data.user.user_metadata?.address || '',
        } as unknown as User);
        onClose();
      }
    } catch (err: any) {
      const m = String(err?.message || '');
      setError(
        /already registered|already been registered/i.test(m)
          ? 'This phone number already has an account. Please sign in.'
          : /invalid login/i.test(m)
          ? 'Wrong phone number or password.'
          : m || 'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const input =
    'w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[94vh] overflow-y-auto">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 p-1 flex items-center justify-center">
              <img src="/mascot.png" alt="AssanMart" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-900 text-lg">
              Assan<span className="text-emerald-600">Mart</span>
            </span>
          </div>
          <button
            onClick={() => {
              stopVoice();
              onClose();
            }}
            disabled={loading}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={loading}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tab === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">{tab === 'login' ? 'Welcome Back!' : 'Join AssanMart'}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {tab === 'login' ? 'Sign in with your phone number and password.' : 'Create an account with your phone number. No email needed.'}
            </p>
          </div>

          {/* Google: one click, no mail */}
          <button
            type="button"
            onClick={googleSignIn}
            disabled={loading}
            className="w-full py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or with your phone number <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* voice helper (on by default, like in the photo scanner) */}
          {(
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
              <button
                type="button"
                onClick={voiceOn ? stopVoice : () => startVoice(tab === 'signup' ? 'name' : 'loginphone')}
                disabled={loading}
                className={`w-full py-2 rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  voiceOn ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                } ${vPhase === 'listening' ? 'animate-pulse' : ''}`}
              >
                {voiceOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {voiceOn
                  ? vPhase === 'listening'
                    ? 'Listening… (tap to stop)'
                    : vPhase === 'speaking'
                    ? 'Speaking… (tap to stop)'
                    : 'Tap to stop voice'
                  : 'Voice off — tap to fill this form by voice'}
              </button>
              {voiceOn && agentText && <p className="text-[11px] text-emerald-900 mt-2 leading-snug" dir="auto">{agentText}</p>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} className={input} />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={tab === 'login' ? 'text' : 'tel'}
                  inputMode={tab === 'login' ? 'text' : 'tel'}
                  required
                  placeholder="0300-1234567"
                  value={phone.length === 11 && /^\d+$/.test(phone) && tab === 'signup' ? prettyPhone(phone) : phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className={input}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Password {tab === 'signup' && <span className="font-normal text-slate-400">(6+ characters)</span>}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  ref={passRef}
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className={input}
                />
              </div>
            </div>

            {tab === 'signup' && (
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Delivery Address <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="House, street, area"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={loading}
                    className={input}
                  />
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating || loading}
                  className="mt-2 px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 hover:bg-emerald-100 cursor-pointer disabled:opacity-60"
                >
                  {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                  {locating ? 'Finding you…' : 'Use my current location'}
                </button>
              </div>
            )}

            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            {message && <p className="text-xs font-semibold text-emerald-600">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{tab === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};