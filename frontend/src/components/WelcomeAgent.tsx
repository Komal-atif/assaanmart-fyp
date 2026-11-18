import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X, Volume2 } from 'lucide-react';
import { useVoiceLoop } from '../hooks/useVoiceLoop';
import { getBackendUrl, welcomeSay, welcomeReply, WelcomeStage } from '../services/voiceApi';

type Lang = 'english' | 'urdu';
type Phase = 'idle' | 'speaking' | 'listening' | 'thinking';

interface Props {
    voiceOpen: boolean;
    afterOrderSignal: number;
  onVoice: (lang: Lang) => void;
  onLanguage: (lang: Lang) => void;
}

// greeting sirf page open hone par ek dafa ho
let greetedThisPageLoad = false;

export const WelcomeAgent: React.FC<Props> = ({ voiceOpen, afterOrderSignal, onVoice, onLanguage }) => {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<WelcomeStage>('language');
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [needTap, setNeedTap] = useState(false);
  const [notice, setNotice] = useState('');
  const [heard, setHeard] = useState('');

  const playerRef = useRef<HTMLAudioElement | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const stageRef = useRef<WelcomeStage>('language');
  const langRef = useRef<Lang>('english');
  const tokenRef = useRef(0);
  const propsRef = useRef({ onVoice, onLanguage });
  propsRef.current = { onVoice, onLanguage };

  // audio chalane ke liye, jab khatam ho to true return karta hai
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
      a.onplaying = () => setPhase('speaking');
      a.onended = () => finish(true);
      a.onerror = () => finish(true);
      a.src = url.startsWith('http') ? url : `${getBackendUrl()}${url}`;
      a.play().catch(() => finish(false));
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
      setNotice('Microphone is blocked - please use the buttons.');
      setPhase('idle');
      return;
    }
    if (!activeRef.current) return;
    setPhase('listening');
    voice.listen();
  };

  // pehle agent bolta hai phir customer ki baat sunta hai
  const speakThenListen = async (url: string, listen = true) => {
    const my = ++tokenRef.current;
    voice.pause();
    setPhase('thinking');
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
    setHeard('');
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
      setNotice('The voice server is not reachable - you can still use the buttons.');
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

  // customer ki awaz server ko bhej kar jawab lena
  const handleUtterance = async (blob: Blob) => {
    setPhase('thinking');
    try {
      const d = await welcomeReply(blob, stageRef.current, langRef.current);
      if (!activeRef.current) return;
      if (!d.heard) return listenNow();
      setHeard(d.heard);
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
      if (d.text) setText(d.text);
      if (d.audio_url) await speakThenListen(d.audio_url);
      else await listenNow();
    } catch (err) {
      console.warn('Welcome reply failed:', err);
      setNotice('Could not hear that - please try again or use the buttons.');
      await listenNow();
    }
  };

  const voice = useVoiceLoop({
    onUtterance: handleUtterance,
  });

  // page khulte hi welcome
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

  useEffect(() => {
    if (afterOrderSignal > 0) say('after_order', langRef.current);
  }, [afterOrderSignal]);

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

  useEffect(() => {
    if (voiceOpen) {
      release();
      setOpen(false);
    }
  }, [voiceOpen]);

  // button se language chuni to agla sawal usi language mein
  const pickLanguage = (l: Lang) => {
    release();
    langRef.current = l;
    propsRef.current.onLanguage(l);
    say('mode', l);
  };

  if (!open || voiceOpen) return null;

  const speaking = phase === 'speaking';
  const listening = phase === 'listening';

  const status = listening ? 'Listening…' : speaking ? 'Speaking…' : phase === 'thinking' ? 'One moment…' : '';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-2 sm:pb-4 pointer-events-none">
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Welcome to AssanMart"
        className="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-white/70 shadow-[0_20px_60px_-15px_rgba(15,110,61,.45)] animate-in slide-in-from-bottom-6 fade-in duration-500"
      >
                <div className="flex items-start gap-3 px-4 sm:px-5 pt-3 pb-2">
          <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-[#e0f4e7] text-[#1DAA61] flex items-center justify-center">
            {speaking ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-black text-[#1f5233] leading-tight">Welcome to AssanMart</h2>
            <p className="mt-0.5 text-xs sm:text-[13px] text-[#4d7a5c] leading-snug line-clamp-3" dir="auto">
              {text || 'Would you like to order by voice or browse the store?'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && (
              <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white ${listening ? 'bg-[#1DAA61]' : speaking ? 'bg-[#f59e0b]' : 'bg-[#7fcf9a]'}`}>
                {speaking ? <Volume2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />} {status}
              </span>
            )}
            <button
              onClick={() => {
                release();
                setOpen(false);
              }}
              className="w-8 h-8 rounded-full hover:bg-[#e0f4e7] text-[#4d7a5c] flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

                {(heard || listening) && (
          <div className="px-4 sm:px-5 py-1.5 border-t border-[#e0f4e7] bg-white/50 text-xs text-[#4d7a5c] flex items-center justify-between gap-2" dir="auto">
            <span className="min-w-0 truncate">
              {heard ? <>You said: <span className="font-semibold text-[#2a6b43]">“{heard}”</span></> : 'Listening… say English or اردو'}
            </span>
            {status && <span className="sm:hidden shrink-0 font-bold text-[#148a4c]">{status}</span>}
          </div>
        )}

        {(notice || needTap || stage === 'language') && (
          <div className="px-4 sm:px-5 pb-2.5 pt-1 flex flex-wrap items-center gap-2">
                        {stage === 'language' && (
              <>
                <button onClick={() => pickLanguage('english')} className="px-4 py-1 rounded-full bg-white/80 hover:bg-white border border-[#b3e4c4] text-[#2a6b43] text-sm font-bold cursor-pointer active:scale-95 transition">
                  English
                </button>
                <button onClick={() => pickLanguage('urdu')} className="px-4 py-1 rounded-full bg-white/80 hover:bg-white border border-[#b3e4c4] text-[#2a6b43] text-sm font-bold cursor-pointer active:scale-95 transition">
                  اردو
                </button>
              </>
            )}
            {notice && <span className="text-[11px] text-amber-700">{notice}</span>}
            {needTap && <span className="text-[11px] font-semibold text-[#148a4c]">Tap anywhere to hear the greeting</span>}
          </div>
        )}
      </div>
    </div>
  );
};