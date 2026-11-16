import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Mic } from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
import { Product } from '../types';
import { VoicePhase } from './voice/VoiceAvatar';
import { VoiceStage } from './voice/VoiceStage';
import { VoiceProductModal } from './voice/VoiceProductModal';
import { VoiceBasketPanel } from './voice/VoiceBasketPanel';
import { useVoiceLoop, IS_MOBILE } from '../hooks/useVoiceLoop';
import {
  getBackendUrl,
  checkBackendHealth,
  greetVoiceSession,
  preloadVoiceSession,
  VoicePreload,
  converseVoice,
  selectVoiceOption,
  actionVoice,
  updateVoiceCart,
  EMPTY_VOICE_CART,
  VoiceCart,
  VoiceOptions,
} from '../services/voiceApi';

/** How the voice window starts: nothing = the normal greeting; lang = language already chosen by the welcome agent;
 *  preload = the photo scanner hands over the open lines of the customer's list. */
export interface VoiceLaunch {
  lang?: 'english' | 'urdu';
  preload?: VoicePreload;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  /** Replace the items this voice session put in the store cart (prevIds) with the agent's current basket. */
  onSyncVoiceCart: (prevIds: string[], items: { product: Product; quantity: number }[]) => void;
  launch?: VoiceLaunch | null;
  /** An order was placed by voice and the agent finished confirming it: the parent closes this window. */
  onOrderPlaced?: () => void;
  /** A guest said "confirm": the agent asked them to sign in first. */
  onNeedLogin?: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  products,
  onSyncVoiceCart,
  launch,
  onOrderPlaced,
  onNeedLogin,
}) => {
  const [phase, setPhase] = useState<VoicePhase>('off');
  const [started, setStarted] = useState(false);
  const [reply, setReply] = useState('');
  const [heard, setHeard] = useState('');
  const [lang, setLang] = useState<'english' | 'urdu' | null>(null);
  const [options, setOptions] = useState<VoiceOptions | null>(null);
  const [cart, setCart] = useState<VoiceCart>(EMPTY_VOICE_CART);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [interrupt, setInterrupt] = useState(true); // customer can talk while the agent is still speaking

  const playerRef = useRef<HTMLAudioElement | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef(0);
  const activeRef = useRef(false);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const bargedRef = useRef(false);
  const interruptRef = useRef(true);
  interruptRef.current = interrupt;

  // Latest props for use inside long-lived callbacks
  const productsById = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);
  const propsRef = useRef({ productsById, onSyncVoiceCart });
  propsRef.current = { productsById, onSyncVoiceCart };

  const syncedIdsRef = useRef<string[]>([]); // store-cart ids this voice session has added
  const cartRef = useRef<VoiceCart>(EMPTY_VOICE_CART);
  const [orderMessage, setOrderMessage] = useState('');
  const orderPlacedRef = useRef(false);
  const launchRef = useRef<VoiceLaunch | null | undefined>(launch);
  launchRef.current = launch;
  const needLoginRef = useRef(false);
  const onNeedLoginRef = useRef(onNeedLogin);
  onNeedLoginRef.current = onNeedLogin;
  const onOrderPlacedRef = useRef(onOrderPlaced);
  onOrderPlacedRef.current = onOrderPlaced;

  // ---- audio ---------------------------------------------------------------
  // `onStart` fires when the sound REALLY starts, so "Speaking…" is only shown while the customer can hear the agent.
  // If the sound has not started after 8 s the turn is given up (the window never hangs waiting for audio).
  const playOnce = (url: string, onStart?: () => void) =>
    new Promise<void>((resolve) => {
      const a = playerRef.current || (playerRef.current = new Audio());
      if (resolverRef.current) resolverRef.current();
      resolverRef.current = resolve;
      let started = false;
      const guard = window.setTimeout(() => { if (!started) done(); }, 8000);
      const done = () => {
        window.clearTimeout(guard);
        if (resolverRef.current === resolve) resolverRef.current = null;
        resolve();
      };
      a.onplaying = () => {
        if (started) return;
        started = true;
        window.clearTimeout(guard);
        onStart?.();
      };
      a.onended = done;
      a.onerror = done;
      a.preload = 'auto';
      a.src = url.startsWith('http') ? url : `${getBackendUrl()}${url}`;
      a.play().catch(done);
    });

  const lastAudioRef = useRef<string | null>(null);   // the agent's last sentence, repeated when the customer is silent
  const idleCountRef = useRef(0);

  const stopSpeech = () => {
    playerRef.current?.pause();
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r();
    }
  };

  const speak = useCallback(async (path?: string | null) => {
    const my = ++tokenRef.current;
    bargedRef.current = false;
    if (path) {
      lastAudioRef.current = path;
      setPhase('thinking');   // the sound is being fetched: not "speaking" yet
      await playOnce(path, () => {
        if (my !== tokenRef.current) return;
        setPhase('speaking');
        // the microphone listens for a real interruption only while the agent is audible
        if (interruptRef.current && activeRef.current && !IS_MOBILE) voice.listen({ bargeIn: true });
        else voice.pause();
      });
      await new Promise((r) => setTimeout(r, 200)); // let the room echo of the agent's voice fade before listening
    }
    if (my !== tokenRef.current) return;
    if (needLoginRef.current) {
      needLoginRef.current = false;
      await new Promise((r) => setTimeout(r, 600));
      activeRef.current = false;
      onNeedLoginRef.current?.();
      return;
    }
    if (orderPlacedRef.current) {
      // the order was placed and the agent has said so: close the window, the welcome agent asks what next
      orderPlacedRef.current = false;
      await new Promise((r) => setTimeout(r, 1200));
      activeRef.current = false;
      onOrderPlacedRef.current?.();
      return;
    }
    if (bargedRef.current) {
      bargedRef.current = false;
      setPhase('listening');
      return;
    }
    if (activeRef.current) {
      setPhase('listening');
      voice.listen();
    } else {
      setPhase('off');
    }
  }, []);

  // ---- keep the store cart equal to the agent's basket ----------------------
  const syncStoreCart = (c: VoiceCart) => {
    const { productsById: byId, onSyncVoiceCart: sync } = propsRef.current;
    const items: { product: Product; quantity: number }[] = [];
    for (const it of c.items) {
      const found = byId.get(String(it.id));
      const product: Product =
        found ??
        ({
          id: String(it.id),
          name: it.name,
          category: it.item_family || 'Groceries',
          subcategory: it.item_family || 'Pantry',
          size: it.unit || '',
          price: it.price_per_unit,
          stock: null,
          icon: '🛒',
          image: it.image_url || '',
          search: `${it.name} ${it.brand || ''}`.toLowerCase(),
        } as Product);
      items.push({ product, quantity: it.quantity });
    }
    const prev = syncedIdsRef.current;
    syncedIdsRef.current = items.map((i) => String(i.product.id));
    if (prev.length || items.length) sync(prev, items);
  };

  const applyCart = (c: VoiceCart | undefined, reply?: string) => {
    if (!c) return;
    // basket emptied by the agent (not a cancel) = the backend placed the order
    // (only when the reply really says so: a lost / restarted session also shows an empty basket and must not close the window)
    if (c.count === 0 && cartRef.current.count > 0 && /confirm|placed|order|کنفرم|آرڈر/i.test(reply || '') && !/cancel|منسوخ|haven't|not placed/i.test(reply || '')) {
      setOrderMessage(`Order placed — ${Math.round(cartRef.current.total)} rupees, cash on delivery.`);
      orderPlacedRef.current = true;
    }
    if ((c as any).need_login) needLoginRef.current = true;
    cartRef.current = c;
    setCart(c);
    syncStoreCart(c);
  };

  function applyTurn(d: any, { silentIfEmpty = false } = {}) {
    applyCart(d.cart, d.reply_text);
    if ('options' in d) setOptions(d.options ?? null);
    if (silentIfEmpty && !d.user_text) return;
    if (d.reply_text !== undefined) setReply(d.reply_text);
    if (d.detected_language) setLang(d.detected_language);
    if (d.user_text !== undefined) setHeard(d.user_text);
  }

  // ---- voice loop -----------------------------------------------------------
  const handleUtterance = async (blob: Blob) => {
    idleCountRef.current = 0;
    setPhase('thinking');
    setNotice('');
    try {
      const d = await Promise.race([
        converseVoice(blob, historyRef.current),
        new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('converse timeout')), 25000)),
      ]);
      applyTurn(d, { silentIfEmpty: true });
      if (!d.user_text) {
        if (activeRef.current) {
          setPhase('listening');
          voice.listen();
        } else setPhase('off');
        return;
      }
      historyRef.current = d.history || historyRef.current;
      await speak(activeRef.current ? d.audio_url : null);
    } catch (err) {
      console.warn('Converse failed:', err);
      setNotice("Can't reach the voice server right now. Please check that it is running and try again.");
      if (activeRef.current) {
        setPhase('listening');
        voice.listen();
      } else setPhase('off');
    }
  };

  const voice = useVoiceLoop({
    onUtterance: handleUtterance,
    onBargeIn: () => {
      bargedRef.current = true;
      stopSpeech();
    },
    // 30 s of silence: repeat the question (twice at most), then just keep listening quietly
    onIdle: () => {
      if (!activeRef.current) return;
      if (idleCountRef.current < 2 && lastAudioRef.current) {
        idleCountRef.current += 1;
        speak(lastAudioRef.current);
      } else {
        setPhase('listening');
        voice.listen();
      }
    },
  });

  const shutDown = () => {
    activeRef.current = false;
    tokenRef.current += 1;
    stopSpeech();
    voice.pause();
    voice.stopAll();
    setPhase('off');
  };

  // Closing the window always stops the microphone and the voice.
  // self-repair: the screen says "Listening" but the microphone loop is not running (a missed event) -> start it again
  const phaseNowRef = useRef<VoicePhase>('off');
  phaseNowRef.current = phase;
  useEffect(() => {
    const id = window.setInterval(() => {
      if (activeRef.current && phaseNowRef.current === 'listening' && !voice.isListening()) {
        console.warn('Voice: listening screen without a running microphone loop - restarting it');
        voice.listen();
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isOpen && (started || activeRef.current)) {
      shutDown();
      setStarted(false);
      setOptions(null);
    }
  }, [isOpen]);

  const startSession = async () => {
    try {
      await voice.open();
    } catch {
      setNotice('Microphone access is blocked. Please allow the microphone in your browser settings.');
      return;
    }
    activeRef.current = true;
    setNotice('');
    setStarted(true);
    setPhase('thinking');
    cartRef.current = EMPTY_VOICE_CART;
    setOrderMessage('');
    orderPlacedRef.current = false;
    try {
      const l = launchRef.current;
      const g = l?.preload ? await preloadVoiceSession(l.preload) : await greetVoiceSession({ lang: l?.lang });
      historyRef.current = g.history || [];
      setReply(g.reply_text);
      setHeard('');
      setLang((g as any).language ?? null);
      setOptions(g.options ?? null);
      syncedIdsRef.current = []; // a new voice session starts empty and adds on top of whatever is already in the store cart
      applyCart(g.cart);
      cartRef.current = g.cart || EMPTY_VOICE_CART;
      setCart(cartRef.current);
      await speak(g.audio_url);
    } catch (err) {
      console.warn('Greet failed:', err);
      const up = await checkBackendHealth();
      setReply('Assalam-o-Alaikum! I am AssanMart.');
      setNotice(
        up
          ? 'Something went wrong starting the voice session. Please try again.'
          : "The voice server isn't running. Start it and press Start Over."
      );
      shutDown();
    }
  };

  // Start automatically when the window opens (customers pressed the voice button already).
  useEffect(() => {
    if (isOpen && !started && phase === 'off') startSession();
  }, [isOpen]);

  const handleStartOver = async () => {
    shutDown();
    setStarted(false);
    await startSession();
  };

  const handlePickOption = async (value: string, qty?: number | null) => {
    stopSpeech();
    voice.pause();
    tokenRef.current += 1;
    setPhase('thinking');
    try {
      const d = await selectVoiceOption(value, qty);
      applyTurn(d);
      await speak(d.audio_url);
    } catch (err) {
      console.warn('Select failed:', err);
      setNotice('Could not send your choice. Please try again.');
      setPhase(activeRef.current ? 'listening' : 'off');
      if (activeRef.current) voice.listen();
    }
  };

  const runAction = async (action: 'confirm' | 'decline') => {
    setBusy(true);
    try {
      stopSpeech();
      const d = await actionVoice(action);
      applyTurn(d);
      await speak(d.audio_url);
    } catch (err) {
      console.warn(`Action ${action} failed:`, err);
      setNotice('Could not reach the voice server.');
    } finally {
      setBusy(false);
    }
  };

  const handleQtyChange = async (id: number, quantity: number) => {
    try {
      applyCart(await updateVoiceCart(id, quantity));
    } catch (err) {
      console.warn('Cart update failed:', err);
    }
  };

  if (!isOpen) return null;

  const live = phase === 'listening' || phase === 'speaking' || phase === 'thinking';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-white rounded-3xl shadow-2xl border border-[#e0f4e7] my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* title bar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#e0f4e7] bg-gradient-to-r from-[#f3fbf6] to-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white border border-[#e0f4e7] p-1 flex items-center justify-center shrink-0">
              <AnimatedLogo className="w-full h-full" />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-[#1f5233] leading-tight text-sm sm:text-base truncate">
                Assan<span className="text-[#1DAA61]">Mart</span> Voice
              </p>
              <p className="text-[11px] text-[#4d7a5c] flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-[#1DAA61] animate-pulse' : 'bg-[#b3e4c4]'}`} />
                {live ? 'Live, hands-free' : 'Ready'}
                <Mic className="w-3 h-3" />
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-[#e0f4e7] hover:bg-[#e0f4e7] text-[#2a6b43] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start overflow-y-auto min-h-0 flex-1">
          <div className="lg:col-span-7">
            <VoiceStage
              phase={phase}
              started={started}
              reply={reply}
              heard={heard}
              lang={lang}
              notice={notice}
              options={options}
              cart={cart}
              levelRef={voice.levelRef}
              onPick={handlePickOption}
              interrupt={interrupt}
              onInterruptChange={setInterrupt}
              onRetry={handleStartOver}
            />
          </div>
          <div className="lg:col-span-5">
            <VoiceBasketPanel
              cart={cart}
              busy={busy}
              message={orderMessage}
              onDismissMessage={() => setOrderMessage('')}
              onQty={handleQtyChange}
              onConfirm={() => runAction('confirm')}
              onDecline={() => runAction('decline')}
              onSyncToMainCart={() => syncStoreCart(cart)}
            />
          </div>
        </div>
      </div>
      <VoiceProductModal options={options} phase={phase} onSelect={handlePickOption} />
    </div>
  );
};