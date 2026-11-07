import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { Product } from '../types';
import { VoicePhase } from './voice/VoiceAvatar';
import { VoiceAgentPanel } from './voice/VoiceAgentPanel';
import { VoiceBasketPanel } from './voice/VoiceBasketPanel';
import { VoiceProductModal } from './voice/VoiceProductModal';
import { useVoiceLoop } from '../hooks/useVoiceLoop';
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
  const playOnce = (url: string) =>
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
      setPhase('speaking');
      if (interruptRef.current && activeRef.current) voice.listen({ bargeIn: true });
      else voice.pause();
      await playOnce(path);
      await new Promise((r) => setTimeout(r, 350)); // let the room echo of the agent's voice fade before listening
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
    if (c.count === 0 && cartRef.current.count > 0 && !/cancel|منسوخ/i.test(reply || '')) {
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
    setPhase('thinking');
    setNotice('');
    try {
      const d = await converseVoice(blob, historyRef.current);
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
    syncedIdsRef.current = []; // a new voice session adds on top of whatever is already in the store cart
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

  const onToggle = async () => {
    if (phase === 'off') {
      if (!started) return startSession();
      await voice.open();
      activeRef.current = true;
      setPhase('listening');
      voice.listen();
    } else if (phase === 'speaking') {
      stopSpeech();
    } else {
      activeRef.current = false;
      tokenRef.current += 1;
      stopSpeech();
      voice.pause();
      setPhase('off');
    }
  };

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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            <VoiceAgentPanel
              phase={phase}
              started={started}
              reply={reply}
              heard={heard}
              lang={lang}
              notice={notice}
              levelRef={voice.levelRef}
              onToggle={onToggle}
              onStartOver={handleStartOver}
              interrupt={interrupt}
              onInterruptChange={setInterrupt}
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

      <div onClick={(e) => e.stopPropagation()}>
        <VoiceProductModal options={options} phase={phase} onSelect={handlePickOption} />
      </div>
    </div>
  );
};