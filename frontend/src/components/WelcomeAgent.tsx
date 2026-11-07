import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X, Volume2 } from 'lucide-react';
import { useVoiceLoop } from '../hooks/useVoiceLoop';
import { getBackendUrl, welcomeSay, welcomeReply, WelcomeStage } from '../services/voiceApi';

type Lang = 'english' | 'urdu';
type Phase = 'idle' | 'speaking' | 'listening' | 'thinking';

interface Props {
  /** The voice-ordering window is open: the welcome agent steps aside (and releases the microphone). */
  voiceOpen: boolean;
  /** Increases by one every time a voice order has been placed -> the agent asks what to do next. */
  afterOrderSignal: number;
  onVoice: (lang: Lang) => void;
  onLanguage: (lang: Lang) => void;
}

let greetedThisPageLoad = false; // the greeting happens only when the web page is opened

export const WelcomeAgent: React.FC<Props> = ({ voiceOpen, afterOrderSignal, onVoice, onLanguage }) => {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<WelcomeStage>('language');
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [needTap, setNeedTap] = useState(false);
  const [notice, setNotice] = useState('');

  const playerRef = useRef<HTMLAudioElement | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const stageRef = useRef<WelcomeStage>('language');
  const langRef = useRef<Lang>('english');
  const tokenRef = useRef(0);
  const propsRef = useRef({ onVoice, onLanguage });
  propsRef.current = { onVoice, onLanguage };

  const play = (url: string) =>
    new Promise<boolean>((resolve) => {
      const a = playerRef.current || (playerRef.current = new Audio());
      if (resolverRef.current) resolverRef.current();
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolverRef.current = null;
        resolve(ok);
      };
      resolverRef.current = () => finish(true);
      a.onended = () => finish(true);
      a.onerror = () => finish(true);
      a.src = url.startsWith('http') ? url : `${getBackendUrl()}${url}`;
      a.play().catch(() => finish(false)); // false = the browser blocked autoplay
    });

  const stopSpeech = () => {
    playerRef.current?.pause();
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r();
    }
  };

  const listenNow = async () => {
    if (!activeRef.current) return;
    try {
      await voice.open();
    } catch {
      setNotice('Microphone is blocked — please use the buttons.');
      setPhase('idle');
      return;
    }
    if (!activeRef.current) return;
    setPhase('listening');
    voice.listen();
  };

  /** speak a line, then listen for the answer. Returns false when the browser blocked the sound. */
  const speakThenListen = async (url: string, listen = true) => {
    const my = ++tokenRef.current;
    voice.pause();
    setPhase('speaking');
    const ok = await play(url);
    if (!ok) {
      setPhase('idle');
      return false;
    }
    await new Promise((r) => setTimeout(r, 350));
    if (my !== tokenRef.current) return true;
    if (listen) await listenNow();
    else setPhase('idle');
    return true;
  };

  const say = async (st: WelcomeStage, lang: Lang) => {
    activeRef.current = true;
    stageRef.current = st;
    setStage(st);
    setOpen(true);
    setNotice('');
    setPhase('thinking');
    try {
      const d = await welcomeSay(st, lang);
      setText(d.text);
      const ok = await speakThenListen(d.audio_url);
      setNeedTap(!ok);
    } catch (err) {
      console.warn('Welcome failed:', err);
      setText('Welcome to AssanMart! Would you like to order by voice or browse the store?');
      setNeedTap(false);
      setPhase('idle');
      setNotice('The voice server is not reachable — you can still use the buttons.');
    }
  };

  const release = () => {
    activeRef.current = false;
    tokenRef.current += 1;
    stopSpeech();
    voice.pause();
    voice.stopAll();
    setPhase('idle');
  };

  const finish = async (action: 'voice' | 'browse' | 'done', url?: string) => {
    if (url) {
      activeRef.current = true;
      await speakThenListen(url, false);
    }
    release();
    if (action === 'voice') {
      setOpen(false);
      propsRef.current.onVoice(langRef.current);
    } else {
      setTimeout(() => setOpen(false), action === 'done' ? 1800 : 1200);
    }
  };

  const handleUtterance = async (blob: Blob) => {
    setPhase('thinking');
    try {
      const d = await welcomeReply(blob, stageRef.current, langRef.current);
      if (!activeRef.current) return;
      if (!d.heard) return listenNow();
      if (d.action === 'language') {
        langRef.current = d.lang;
        propsRef.current.onLanguage(d.lang);
        stageRef.current = 'mode';
        setStage('mode');
        setText(d.text || '');
        if (d.audio_url) await speakThenListen(d.audio_url);
        return;
      }
      if (d.action === 'voice' || d.action === 'browse' || d.action === 'done') {
        setText(d.text || '');
        return finish(d.action, d.audio_url);
      }
      // not understood: the agent asks again
      if (d.text) setText(d.text);
      if (d.audio_url) await speakThenListen(d.audio_url);
      else await listenNow();
    } catch (err) {
      console.warn('Welcome reply failed:', err);
      setNotice('Could not hear that — please try again or use the buttons.');
      await listenNow();
    }
  };

  const voice = useVoiceLoop({ onUtterance: handleUtterance });

  // ---- page open: greet once (if the browser blocks the sound, the first click / key press starts it) ----
  useEffect(() => {
    if (greetedThisPageLoad) return;
    greetedThisPageLoad = true;
    say('language', 'english');
  }, []);

  useEffect(() => {
    if (!needTap) return;
    const go = () => {
      setNeedTap(false);
      say(stageRef.current, langRef.current);
    };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
  }, [needTap]);

  // ---- the voice window closed after an order: what next? ----
  useEffect(() => {
    if (afterOrderSignal > 0) say('after_order', langRef.current);
  }, [afterOrderSignal]);

  // ---- the customer uses the page's own buttons: "Browse Full Store" etc. -> the agent stops and gets out of the way ----
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('button,a');
      if (!el || cardRef.current?.contains(el)) return;
      if (/browse|shop|store/i.test(el.textContent || '') && !/voice/i.test(el.textContent || '')) {
        release();
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // ---- the voice window is open: step aside, free the microphone ----
  useEffect(() => {
    if (voiceOpen) {
      release();
      setOpen(false);
    }
  }, [voiceOpen]);

  // keep the bottom of the page free so the card never covers the page's own buttons
  useEffect(() => {
    const show = open && !voiceOpen;
    const prev = document.body.style.paddingBottom;
    if (show) document.body.style.paddingBottom = '9rem';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [open, voiceOpen]);

  if (!open || voiceOpen) return null;


  return (
    <div ref={cardRef} className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(36rem,calc(100vw-1.5rem))] rounded-3xl border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_10px_40px_rgba(5,150,105,0.22)] ring-1 ring-emerald-500/10 px-4 py-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md ${
            phase === 'listening'
              ? 'bg-linear-to-br from-emerald-500 to-teal-600 animate-pulse ring-4 ring-emerald-400/30'
              : phase === 'speaking'
              ? 'bg-linear-to-br from-emerald-400 to-emerald-600 ring-4 ring-emerald-300/30'
              : 'bg-slate-400/80'
          }`}
        >
          {phase === 'speaking' ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            AssanMart assistant
            {phase === 'listening' && ' · listening…'}
            {phase === 'thinking' && ' · …'}
          </p>
          <p className="text-sm font-medium text-slate-800 mt-0.5 leading-snug" dir="auto">
            {text || 'Welcome to AssanMart!'}
          </p>
          {notice && <p className="text-xs text-amber-600 mt-1">{notice}</p>}
        </div>
        <button
          onClick={() => {
            release();
            setOpen(false);
          }}
          className="shrink-0 w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {needTap && <p className="mt-2 pl-14 text-[11px] font-semibold text-emerald-700">🔊 Tap anywhere on the page to hear the greeting</p>}
    </div>
  );
};