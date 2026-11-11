import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Camera, Upload, Loader2, Check, AlertCircle, Minus, Plus, ScanLine as ScanIcon,
  ArrowRight, ArrowLeft, SkipForward, Search, Trash2, ChevronDown, Mic, MicOff, ShoppingCart, Store, CheckCircle2,
} from 'lucide-react';
import { Product } from '../types';
import { scanGroceryList, ScanLine, ScanCandidate } from '../services/orderApi';
import { useVoiceLoop } from '../hooks/useVoiceLoop';
import { getBackendUrl, scanSay, scanReply } from '../services/voiceApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  /** language of the voice help (chosen by the welcome agent) */
  lang?: 'english' | 'urdu';
  /** the customer finished choosing: add these to the cart */
  onAddScanned: (items: { product: Product; quantity: number }[]) => void;
  /** Finish the open lines by voice: the confirmed items + the lines still open are handed to the voice agent. */
  onContinueByVoice?: (payload: { cart: { id: number; qty: number }[]; lines: string[] }) => void;
  /** after the items were added: the customer wants to pay now */
  onCheckout?: () => void;
}

interface Row {
  line: ScanLine;
  picked: number | null; // product id chosen by the customer
  qty: number;
  skipped: boolean;
}

type Step = 'upload' | 'detected' | 'pick' | 'summary' | 'added';

// Phone photos are big: shrink to 1600px JPEG before uploading (faster, and inside the server limit).
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
}

const money = (n: number | null | undefined) => `PKR ${Math.round(n ?? 0).toLocaleString()}`;

export const GroceryImageScannerModal: React.FC<Props> = ({ isOpen, onClose, products, lang = 'english', onAddScanned, onContinueByVoice, onCheckout }) => {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [idx, setIdx] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [query, setQuery] = useState('');
  const [promptTick, setPromptTick] = useState(0); // lets the agent re-ask the same item
  const [qtyScreen, setQtyScreen] = useState(false); // item step 2: the product is chosen, only the quantity is shown
  const [added, setAdded] = useState({ n: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [vPhase, setVPhase] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [heardText, setHeardText] = useState('');
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef(0);
  const prefixRef = useRef('');        // e.g. "Okay, Dalda oil." said before the next item's question
  const qtyModeRef = useRef<'confirm' | 'ask' | null>(null); // after choosing a product: keep the written quantity? / how many?
  const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);

  const reset = () => {
    setStep('upload');
    setPreview('');
    setRows([]);
    setIdx(0);
    setError('');
    setBusy(false);
    setShowMore(false);
    setQuery('');
    setQtyScreen(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setError('');
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const lines = await scanGroceryList(await shrink(file));
      if (lines.length === 0) {
        setError("We couldn't find any items in this picture. Try a clearer, well-lit photo of the list.");
        return;
      }
      setRows(lines.map((line) => ({ line, picked: null, qty: 1, skipped: false })));
      setStep('detected');
    } catch (e: any) {
      setError(e?.message || "Couldn't read the list. Please check that the AssanMart server is running.");
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // ---- entering an item of the wizard: a sure match is already selected, everything else waits for the customer
  const goTo = (i: number, from: Row[] = rows) => {
    setPromptTick((n) => n + 1);
    setIdx(i);
    setShowMore(false);
    setQuery('');
    setQtyScreen(false);
    const r = from[i];
    if (r && r.picked == null && !r.skipped && r.line.status === 'matched' && r.line.candidates[0]) {
      const c = r.line.candidates[0];
      setRows(from.map((x, k) => (k === i ? { ...x, picked: c.id, qty: c.quantity } : x)));
      setQtyScreen(true);                         // only one product fits: nothing to choose, go straight to the quantity
    }
    setStep('pick');
  };

  const removeLine = (i: number) => setRows((rs) => rs.filter((_, k) => k !== i));

  const next = (from: Row[]) => {
    if (idx + 1 < from.length) goTo(idx + 1, from);
    else setStep('summary');
  };

  const confirmItem = () => {
    if (cur?.picked != null && !qtyScreen) return choose(cur.picked, cur.qty);   // product first, then the quantity screen
    next(rows);
  };
  const skipItem = () => {
    const nr = rows.map((r, k) => (k === idx ? { ...r, picked: null, skipped: true } : r));
    setRows(nr);
    next(nr);
  };

  const chosen = rows.filter((r) => r.picked != null && !r.skipped);
  const total = chosen.reduce((s, r) => s + (byId.get(String(r.picked))?.price ?? 0) * r.qty, 0);

  const addAll = () => {
    const items = chosen
      .map((r) => ({ product: byId.get(String(r.picked)) as Product, quantity: r.qty }))
      .filter((x) => x.product);
    if (items.length === 0) return;
    onAddScanned(items);
    setAdded({ n: items.length, total });
    setStep('added');                              // stay here: the agent asks what next (checkout / browse / more)
  };

  const goCheckout = () => {
    stopVoice();
    reset();
    onClose();
    onCheckout?.();
  };

  const openRows = rows.filter((r) => r.skipped || r.picked == null);

  const byVoice = () => {
    if (!onContinueByVoice) return;
    onContinueByVoice({
      cart: chosen.map((r) => ({ id: Number(r.picked), qty: r.qty })),
      lines: openRows.map((r) => [r.line.qty_text, r.line.text].filter(Boolean).join(' ')),
    });
    close();
  };

  // ------------------------------------------------------------------ small pieces
  const OptionCard = ({ p, qty, selected, onPick, n }: { p: Product; qty: number; selected: boolean; onPick: () => void; n?: number }) => (
    <button
      onClick={onPick}
      className={`relative text-left rounded-2xl border p-3 flex flex-col cursor-pointer transition-all ${
        selected ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/25' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {n != null && (
        <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-slate-800/80 text-white text-[11px] font-bold flex items-center justify-center">{n}</span>
      )}
      {selected && (
        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
          <Check className="w-4 h-4" />
        </span>
      )}
      <div className="h-24 flex items-center justify-center mb-2">
        {p.image ? <img src={p.image} alt={p.name} className="max-h-full max-w-full object-contain" /> : <span className="text-4xl">{p.icon}</span>}
      </div>
      <p className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">{p.name}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{p.size}</p>
      <p className="text-sm font-black text-emerald-700 mt-1">{money(p.price)}</p>
    </button>
  );

  const cur = rows[idx];
  const curPicked = cur?.picked != null ? byId.get(String(cur.picked)) : undefined;
  const asProducts = (cs: ScanCandidate[]) =>
    cs.map((c) => ({ c, p: byId.get(String(c.id)) })).filter((x): x is { c: ScanCandidate; p: Product } => !!x.p);
  const best = cur ? asProducts(cur.line.candidates) : [];
  const more = cur ? asProducts(cur.line.more || []) : [];
  const found = query.trim()
    ? products
        .filter((p) => p.price != null && p.stock !== 0 && query.toLowerCase().split(/\s+/).every((w) => p.search.includes(w)))
        .slice(0, 12)
    : [];

  /** the customer chose a product (tap, or by voice): show the quantity screen and ask how many */
  const choose = (id: number, qty: number) => {
    if (!cur) return;
    update(idx, { picked: id, qty, skipped: false });
    setQtyScreen(true);
    const p = byId.get(String(id));
    if (voiceOnRef.current && p) {
      const c = findCand(cur, id) || ({ id, name: p.name, brand: (p as any).brand || '', size: p.size, price: p.price ?? 0, quantity: qty } as ScanCandidate);
      sayQty(tt(`Okay, ${spokenName(c)}. `, `ٹھیک ہے، ${spokenName(c)}۔ `), { ...cur, picked: id }, c);
    }
  };

  // =====================================================================================
  // VOICE: the agent speaks every step (upload, detected items, each item's options, summary) and listens
  // =====================================================================================
  const ur = lang === 'urdu';
  const tt = (en: string, u: string) => (ur ? u : en);
  const rupees = (n: number) => (ur ? `${Math.round(n)} روپے` : `${Math.round(n)} rupees`);
  const spokenName = (c: ScanCandidate) => [c.name, c.size && !c.name.includes(c.size) ? c.size : ''].filter(Boolean).join(' ');

  // the options the customer can name by number: best matches, plus the other ones once "more" was said / shown
  const optionList = (): ScanCandidate[] => [...(cur?.line.candidates || []), ...(showMore ? cur?.line.more || [] : [])].filter((c) => byId.has(String(c.id)));

  // an Urdu line is said in English in an English session (the server translated it), and the other way round
  const lineName = (r: Row) => (ur ? r.line.text : r.line.english || r.line.text);
  const findCand = (r: Row, id: number | null) =>
    [...(r.line.candidates || []), ...(r.line.more || [])].find((c) => c.id === id);

  /** the quantity step after a product was chosen: written quantity -> confirm it, none written -> ask */
  const sayQty = (prefix: string, r: Row, c: ScanCandidate) => {
    const written = r.line.qty_text;
    if (written) {
      qtyModeRef.current = 'confirm';
      return sayThenListen(
        prefix +
          tt(
            `You wrote ${written}, so I'll add ${c.quantity} of ${spokenName(c)}. Is that right, or do you want to change it?`,
            `آپ نے ${written} لکھا ہے، تو میں ${c.quantity} عدد ${spokenName(c)} ڈال رہی ہوں۔ کیا یہ ٹھیک ہے، یا بدلنا ہے؟`
          )
      );
    }
    qtyModeRef.current = 'ask';
    return sayThenListen(prefix + tt(`How many ${spokenName(c)} would you like?`, `${spokenName(c)} کتنے چاہئیں؟`));
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

  const stopSpeech = () => {
    playerRef.current?.pause();
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r();
    }
  };

  const listenNow = async () => {
    if (!voiceOnRef.current || !openRef.current) return;
    try {
      await voice.open();
    } catch {
      setVPhase('idle');
      return;
    }
    setVPhase('listening');
    voice.listen();
  };

  const sayThenListen = async (text: string, listen = true) => {
    if (!voiceOnRef.current || !openRef.current) return;
    const my = ++tokenRef.current;
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
      /* no voice server: the screen still works */
    }
    if (my !== tokenRef.current) return;
    if (listen) await listenNow();
    else setVPhase('idle');
  };

  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  const ctxRef = useRef({ step, idx, rows, showMore });
  ctxRef.current = { step, idx, rows, showMore };
  const actionsRef = useRef<any>({});
  actionsRef.current = { goTo, next, skipItem, update, addAll, setShowMore, setStep, optionList, sayThenListen, tt, rupees, spokenName, sayQty, findCand, setQtyScreen, goCheckout, onClose: close, reset };

  const handleUtterance = async (blob: Blob) => {
    const { step: st, idx: i, rows: rs } = ctxRef.current;
    const A = actionsRef.current;
    if (st === 'upload') return;
    setVPhase('thinking');
    if (st === 'pick' && qtyModeRef.current && rs[i]) {
      const row0 = rs[i];
      const pc = A.findCand(row0, row0.picked);
      try {
        const q = await scanReply(blob, 'qty', lang, []);
        if (!q.heard) return listenNow();
        setHeardText(q.heard);
        const done = (qty: number) => {
          qtyModeRef.current = null;
          prefixRef.current = A.tt(`Okay, ${qty}. `, `ٹھیک ہے، ${qty}۔ `);
          A.update(i, { qty });
          return A.next(rs.map((x, k) => (k === i ? { ...x, qty } : x)));
        };
        if (q.action === 'qty' && (q as any).value) return done(Math.min(99, Math.max(1, Math.round((q as any).value))));
        if (q.action === 'yes') {
          if (qtyModeRef.current === 'confirm') return done(row0.qty);
          return A.sayThenListen(A.tt('Please tell me a number, for example two.', 'براہِ کرم کوئی عدد بتائیں، مثلاً دو۔'));
        }
        if (q.action === 'no') {
          qtyModeRef.current = 'ask';
          return A.sayThenListen(A.tt('Okay, how many would you like?', 'ٹھیک ہے، کتنے چاہئیں؟'));
        }
        if (q.action === 'back') {
          qtyModeRef.current = null;
          return A.goTo(i);
        }
        return A.sayThenListen(A.tt("Sorry, I didn't get that. Say a number, or yes to keep it.", 'معذرت، سمجھ نہیں آیا۔ عدد بولیں، یا رکھنے کے لیے ہاں کہیں۔'));
      } catch {
        return listenNow();
      }
    }
    const opts: ScanCandidate[] = st === 'pick' ? A.optionList() : [];
    try {
      const r = await scanReply(blob, st === 'detected' ? 'detected' : st === 'summary' ? 'summary' : st === 'added' ? 'next' : 'pick', lang, opts.map((c) => ({ id: c.id, name: c.name, brand: c.brand, size: c.size })));
      if (!r.heard) return listenNow();
      setHeardText(r.heard);
      const row = rs[i];
      if (st === 'added') {
        if (r.action === 'checkout') return A.goCheckout();
        if (r.action === 'browse') {
          voice.pause();
          return A.onClose();
        }
        if (r.action === 'more') return A.reset();                 // scan another list
        return A.sayThenListen(A.tt('Say checkout to pay, browse to keep shopping, or add more to scan another list.', 'ادائیگی کے لیے چیک آؤٹ، دکان دیکھنے کے لیے براؤز، یا مزید چیزوں کے لیے ایڈ مور کہیں۔'));
      }
      if (st === 'detected') {
        if (r.action === 'yes') return A.goTo(0);
        if (r.action === 'no') return A.sayThenListen(A.tt('Okay. Close this window whenever you like, or say yes when you want to start.', 'ٹھیک ہے۔ جب تیار ہوں تو ہاں کہیں۔'));
      } else if (st === 'summary') {
        if (r.action === 'yes') {
          voice.pause();
          return A.addAll();
        }
        if (r.action === 'review') return A.goTo(0);
      } else if (st === 'pick' && row) {
        if (r.action === 'pick' && r.index != null && opts[r.index]) {
          const c = opts[r.index];
          A.update(i, { picked: c.id, qty: c.quantity, skipped: false });
          A.setQtyScreen(true);
          return A.sayQty(A.tt(`Okay, ${A.spokenName(c)}. `, `ٹھیک ہے، ${A.spokenName(c)}۔ `), row, c);
        }
        if (r.action === 'ambiguous' && r.indices?.length) {
          const names = r.indices.filter((k: number) => opts[k]).map((k: number) => `${k + 1}: ${A.spokenName(opts[k])}`).join(A.tt(', or ', '، یا '));
          return A.sayThenListen(A.tt(`Which one do you mean? ${names}. Say the number.`, `آپ کونسا کہہ رہے ہیں؟ ${names}۔ نمبر بولیں۔`));
        }
        if (r.action === 'yes') {
          if (row.picked != null) {
            A.setQtyScreen(true);
            const pc = A.findCand(row, row.picked);
            const nm = byId.get(String(row.picked))?.name || '';
            if (pc) return A.sayQty(A.tt(`Okay, ${nm}. `, `ٹھیک ہے، ${nm}۔ `), row, pc);
            prefixRef.current = A.tt(`Okay, ${nm}. `, `ٹھیک ہے، ${nm}۔ `);
            return A.next(rs);
          }
          return A.sayThenListen(A.tt('Which one? Say its number or its name, or say skip.', 'کونسا؟ اس کا نمبر یا نام بولیں، یا سکپ کہیں۔'));
        }
        if (r.action === 'skip') {
          prefixRef.current = A.tt('Skipped. ', 'چھوڑ دیا۔ ');
          return A.skipItem();
        }
        if (r.action === 'back') return i > 0 ? A.goTo(i - 1) : A.setStep('detected');
        if (r.action === 'more') {
          const extra = (row.line.more || []).filter((c) => byId.has(String(c.id)));
          if (extra.length === 0) return A.sayThenListen(A.tt('There are no other options. Say a number, or skip.', 'اور کوئی آپشن نہیں ہے۔ نمبر بولیں، یا سکپ کہیں۔'));
          A.setShowMore(true);
          const start = (row.line.candidates || []).filter((c) => byId.has(String(c.id))).length;
          const list = extra.slice(0, 4).map((c, k) => `${start + k + 1}: ${A.spokenName(c)}, ${A.rupees(c.price)}`).join('. ');
          return A.sayThenListen(A.tt(`Other options. ${list}. Which one?`, `دوسرے آپشنز۔ ${list}۔ کونسا چاہیے؟`));
        }
      }
      // not understood: help the customer
      const help =
        st === 'detected'
          ? A.tt('Say yes to start choosing.', 'شروع کرنے کے لیے ہاں کہیں۔')
          : st === 'summary'
          ? A.tt('Say yes to add everything to your cart, or review to go again.', 'سب کارٹ میں ڈالنے کے لیے ہاں کہیں، یا دوبارہ دیکھنے کے لیے ریویو کہیں۔')
          : A.tt('Say a number or the name, say yes to keep the selected one, or say skip.', 'نمبر یا نام بولیں، منتخب شدہ رکھنے کے لیے ہاں کہیں، یا سکپ کہیں۔');
      return A.sayThenListen(A.tt("Sorry, I didn't get that. ", 'معذرت، سمجھ نہیں آیا۔ ') + help);
    } catch (e) {
      console.warn('scan voice failed:', e);
      return listenNow();
    }
  };

  const voice = useVoiceLoop({ onUtterance: handleUtterance });

  const stopVoice = () => {
    tokenRef.current += 1;
    stopSpeech();
    voice.pause();
    voice.stopAll();
    setVPhase('idle');
  };

  // the agent speaks when the step (or the item) changes
  useEffect(() => {
    if (!isOpen || !voiceOn) return;
    const pre = prefixRef.current;
    prefixRef.current = '';
    if (step === 'upload') {
      if (!busy && !preview)
        sayThenListen(tt('Please take a photo of your grocery list, or choose a picture.', 'براہِ کرم اپنی گروسری لسٹ کی تصویر لیں، یا کوئی تصویر چنیں۔'), false);
    } else if (step === 'detected') {
      const names = rows.map((r) => lineName(r)).slice(0, 12).join(ur ? '، ' : ', ');
      sayThenListen(
        tt(
          `I found ${rows.length} item${rows.length === 1 ? '' : 's'} on your list: ${names}. Shall we choose them one by one? Say yes.`,
          `آپ کی لسٹ میں ${rows.length} چیزیں ملیں: ${names}۔ کیا ہم ایک ایک کر کے چنیں؟ ہاں کہیں۔`
        )
      );
    } else if (step === 'pick' && cur) {
      qtyModeRef.current = null;
      const list = optionList().slice(0, 4);
      const nm = lineName(cur);
      const head = tt(`Item ${idx + 1} of ${rows.length}: ${nm}. `, `آئٹم ${idx + 1} از ${rows.length}: ${nm}۔ `);
      const sure = cur.line.status === 'matched' && cur.picked != null ? findCand(cur, cur.picked) : undefined;
      if (sure) {
        // only one product fits ("red apple"): no list of types, it is selected — just the quantity is left
        sayQty(pre + head + tt(`I selected ${spokenName(sure)}, ${rupees(sure.price)}. `, `میں نے ${spokenName(sure)} چن لیا، ${rupees(sure.price)}۔ `), cur, sure);
      } else if (list.length === 0) {
        sayThenListen(pre + head + tt("I couldn't match it. Search for it on the screen, or say skip.", 'میں اسے نہیں ڈھونڈ سکی۔ اسکرین پر تلاش کریں، یا سکپ کہیں۔'));
      } else {
        const body = list.map((c, k) => `${k + 1}: ${spokenName(c)}, ${rupees(c.price)}`).join('. ');
        const tail =
          cur.picked != null
            ? tt('One is already selected. Say yes to keep it, or say another number or name.', 'ایک پہلے سے چنا ہوا ہے۔ رکھنے کے لیے ہاں کہیں، یا دوسرا نمبر یا نام بولیں۔')
            : tt('Which one would you like? Say its number or its name, or skip.', 'کونسا چاہیے؟ اس کا نمبر یا نام بولیں، یا سکپ کہیں۔');
        sayThenListen(pre + head + body + '. ' + tail);
      }
    } else if (step === 'added') {
      sayThenListen(
        tt(
          `Done. ${added.n} item${added.n === 1 ? ' is' : 's are'} in your cart. Would you like to checkout, keep browsing, or add more products?`,
          `ہو گیا۔ ${added.n} چیزیں آپ کے کارٹ میں ہیں۔ کیا آپ چیک آؤٹ کریں گے، براؤز کریں گے، یا مزید چیزیں ڈالیں گے؟`
        )
      );
    } else if (step === 'summary') {
      const n = chosen.length;
      const left = openRows.length;
      sayThenListen(
        pre +
          tt(
            `You chose ${n} item${n === 1 ? '' : 's'}, total ${rupees(total)}.${left ? ` ${left} left out.` : ''} Say yes to add them to your cart, or review to go again.`,
            `آپ نے ${n} چیزیں چنی ہیں، کل ${rupees(total)}۔${left ? ` ${left} رہ گئیں۔` : ''} کارٹ میں ڈالنے کے لیے ہاں کہیں، یا دوبارہ دیکھنے کے لیے ریویو کہیں۔`
          )
      );
    }
  }, [step, idx, isOpen, voiceOn, rows.length, promptTick]);

  // while the photo is being read
  useEffect(() => {
    if (isOpen && voiceOn && busy) sayThenListen(tt('Reading your list, one moment.', 'آپ کی لسٹ پڑھ رہی ہوں، ذرا انتظار کریں۔'), false);
  }, [busy]);

  // the picture was not a list: the agent says so too
  useEffect(() => {
    if (isOpen && voiceOn && error && step === 'upload')
      sayThenListen(tt("I couldn't find a grocery list in this picture. Please upload another picture.", 'اس تصویر میں مجھے گروسری لسٹ نہیں ملی۔ براہِ کرم کوئی اور تصویر اپ لوڈ کریں۔'), false);
  }, [error]);

  // closing the window or turning the voice off always releases the microphone and the sound
  useEffect(() => {
    if (!isOpen || !voiceOn) stopVoice();
  }, [isOpen, voiceOn]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* header */}
        <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ScanIcon className="w-5 h-5 text-emerald-600" /> Scan your grocery list
            </h3>
            <p className="text-xs text-slate-500">
              {step === 'upload' && 'Take a photo of your list. We read it and you choose each item.'}
              {step === 'detected' && 'These are the items we found on your list.'}
              {step === 'pick' && (qtyScreen ? `Item ${idx + 1} of ${rows.length}: how many do you want?` : `Item ${idx + 1} of ${rows.length}: choose the one you want.`)}
              {step === 'added' && 'Your items are in the cart.'}
              {step === 'summary' && 'Check your choices, then add them to your cart.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceOn((v) => !v)}
              className={`px-3 h-8 rounded-full text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                voiceOn ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              } ${voiceOn && vPhase === 'listening' ? 'animate-pulse' : ''}`}
              title="Voice help on/off"
            >
              {voiceOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              {voiceOn ? (vPhase === 'listening' ? 'Listening…' : vPhase === 'speaking' ? 'Speaking…' : vPhase === 'thinking' ? '…' : 'Voice on') : 'Voice off'}
            </button>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          </div>
        </div>

        {voiceOn && heardText && step !== 'upload' && (
          <p className="px-6 py-1.5 text-[11px] text-slate-500 bg-emerald-50/50 border-b border-emerald-100">You said: “{heardText}”</p>
        )}

        {step === 'pick' && (
          <div className="h-1.5 bg-slate-100">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((idx + 1) / rows.length) * 100}%` }} />
          </div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

          {/* 1. upload */}
          {step === 'upload' && (
            <>
              {!preview ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 rounded-2xl py-12 flex flex-col items-center gap-3 cursor-pointer transition-colors"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Camera className="w-7 h-7" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Take a photo or choose a picture</span>
                  <span className="text-xs text-slate-500">English, Urdu or Roman Urdu · printed or handwritten</span>
                </button>
              ) : (
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <img src={preview} alt="Your list" className="w-28 h-36 object-cover rounded-xl border border-slate-200" />
                  {busy && (
                    <p className="text-sm font-semibold text-emerald-700 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Reading your list…
                    </p>
                  )}
                  {!busy && error && (
                    <p className="text-sm font-semibold text-red-600 max-w-sm flex items-start justify-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                    </p>
                  )}
                  {!busy && (
                    <button
                      onClick={() => {
                        setPreview('');
                        setError('');
                        setTimeout(() => fileRef.current?.click(), 0);
                      }}
                      className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/25"
                    >
                      <Upload className="w-4 h-4" /> Upload another picture
                    </button>
                  )}
                </div>
              )}
              {!preview && error && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 flex items-start justify-center gap-2 text-center">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
                </p>
              )}
            </>
          )}

          {/* 2. what was detected */}
          {step === 'detected' && (
            <>
              <div className="flex gap-4 items-start">
                {preview && <img src={preview} alt="Your list" className="w-24 h-32 object-cover rounded-xl border border-slate-200 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    We found {rows.length} item{rows.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-slate-500 mb-2">Remove anything that isn't on your list, then we'll go through them one by one.</p>
                  <ul className="space-y-1.5">
                    {rows.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <span className="w-5 text-xs text-slate-400 font-bold">{i + 1}</span>
                        <span className="flex-1 font-semibold text-slate-800 truncate">
                          {r.line.text}
                          {r.line.qty_text && <span className="font-normal text-slate-500"> · {r.line.qty_text}</span>}
                        </span>
                        {r.line.status === 'unknown' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase">Search needed</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">Found</span>
                        )}
                        <button onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* 3. one item at a time */}
          {step === 'pick' && cur && (
            <>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-[11px] uppercase font-bold text-slate-400">On your list</p>
                <p className="text-base font-black text-slate-900">
                  {cur.line.text}
                  {cur.line.qty_text && <span className="text-sm font-semibold text-slate-500"> · {cur.line.qty_text}</span>}
                </p>
              </div>

              {!(qtyScreen && curPicked) && best.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">{best.length === 1 ? 'Best match' : 'Best matches'}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {best.map(({ c, p }, k) => (
                      <OptionCard key={p.id} n={k + 1} p={p} qty={c.quantity} selected={cur.picked === c.id} onPick={() => choose(c.id, c.quantity)} />
                    ))}
                  </div>
                </div>
              )}

              {!(qtyScreen && curPicked) && more.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                    {showMore ? 'Hide other options' : `More options (${more.length})`}
                  </button>
                  {showMore && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                      {more.map(({ c, p }, k) => (
                        <OptionCard key={p.id} n={best.length + k + 1} p={p} qty={c.quantity} selected={cur.picked === c.id} onPick={() => choose(c.id, c.quantity)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!(qtyScreen && curPicked) && best.length === 0 && (
                <p className="text-xs text-slate-500">We couldn't match this line automatically. Search our store below, or skip it.</p>
              )}

              {/* search the store (always available, essential when nothing matched) */}
              {!(qtyScreen && curPicked) && (
              <div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search our store for this item…"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                {query.trim() && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    {found.length === 0 && <p className="text-xs text-slate-400 col-span-full">Nothing found for “{query}”.</p>}
                    {found.map((p) => (
                      <OptionCard key={p.id} p={p} qty={1} selected={cur.picked === Number(p.id)} onPick={() => choose(Number(p.id), 1)} />
                    ))}
                  </div>
                )}
              </div>
              )}

              {qtyScreen && curPicked && (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-6 flex flex-col items-center text-center gap-3">
                  <div className="h-32 flex items-center justify-center">
                    {curPicked.image ? <img src={curPicked.image} alt={curPicked.name} className="max-h-full max-w-full object-contain" /> : <span className="text-6xl">{curPicked.icon}</span>}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">{curPicked.name}</p>
                    <p className="text-xs text-slate-500">{curPicked.size} · {money(curPicked.price)}</p>
                  </div>
                  {cur.line.qty_text && <p className="text-xs text-slate-500">You wrote: <span className="font-bold text-slate-700">{cur.line.qty_text}</span></p>}
                  <p className="text-sm font-bold text-slate-800 mt-1">How many do you want?</p>
                  <div className="flex items-center gap-4">
                    <button onClick={() => update(idx, { qty: Math.max(1, cur.qty - 1) })} className="w-12 h-12 rounded-full border border-slate-300 bg-white flex items-center justify-center cursor-pointer hover:bg-slate-50" aria-label="Less">
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-14 text-center text-3xl font-black text-slate-900">{cur.qty}</span>
                    <button onClick={() => update(idx, { qty: Math.min(99, cur.qty + 1) })} className="w-12 h-12 rounded-full border border-slate-300 bg-white flex items-center justify-center cursor-pointer hover:bg-slate-50" aria-label="More">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm font-black text-emerald-700">{money((curPicked.price ?? 0) * cur.qty)}</p>
                  <button
                    onClick={() => {
                      qtyModeRef.current = null;
                      setQtyScreen(false);
                      setPromptTick((n) => n + 1);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Change the product
                  </button>
                </div>
              )}
            </>
          )}

          {/* 5. added to the cart: what next? */}
          {step === 'added' && (
            <div className="flex flex-col items-center text-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <p className="text-lg font-black text-slate-900">{added.n} item{added.n === 1 ? '' : 's'} added to your cart</p>
              <p className="text-sm text-slate-500">Total {money(added.total)} · What would you like to do next?</p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <button onClick={goCheckout} className="px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer">
                  <ShoppingCart className="w-4 h-4" /> Checkout
                </button>
                <button onClick={() => { stopVoice(); close(); }} className="px-5 py-3 rounded-full bg-white border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                  <Store className="w-4 h-4" /> Keep browsing
                </button>
                <button onClick={() => reset()} className="px-5 py-3 rounded-full bg-white border border-emerald-300 text-emerald-800 font-bold text-sm hover:bg-emerald-50 flex items-center gap-2 cursor-pointer">
                  <Camera className="w-4 h-4" /> Add more products
                </button>
              </div>
            </div>
          )}

          {/* 4. summary */}
          {step === 'summary' && (
            <>
              {chosen.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">You haven't chosen any items. Go back to pick some.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((r, i) => {
                    const p = r.picked != null ? byId.get(String(r.picked)) : undefined;
                    if (!p || r.skipped) return null;
                    return (
                      <li key={i} className="flex items-center gap-3 border border-slate-200 rounded-2xl p-3">
                        <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.image ? <img src={p.image} alt="" className="w-full h-full object-contain" /> : <span>{p.icon}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-400 truncate">List: {r.line.text}</p>
                          <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            {p.size} · {r.qty} × {money(p.price)}
                          </p>
                        </div>
                        <span className="text-sm font-black text-emerald-700 shrink-0">{money((p.price ?? 0) * r.qty)}</span>
                        <button onClick={() => goTo(i)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0">
                          Change
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {rows.some((r) => r.skipped || r.picked == null) && (
                <p className="text-xs text-slate-400">
                  Skipped:{' '}
                  {rows
                    .filter((r) => r.skipped || r.picked == null)
                    .map((r) => r.line.text)
                    .join(', ')}
                </p>
              )}
            </>
          )}
        </div>

        {/* footer buttons */}
        {step === 'detected' && (
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <button onClick={reset} className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
              Start over
            </button>
            <button
              onClick={() => goTo(0)}
              disabled={rows.length === 0}
              className="px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              Choose items <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'pick' && (
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <button
              onClick={() => (idx > 0 ? goTo(idx - 1) : setStep('detected'))}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={skipItem}
                className="px-4 py-3 rounded-full border border-slate-300 text-slate-600 hover:bg-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" /> Skip
              </button>
              <button
                onClick={confirmItem}
                disabled={cur?.picked == null}
                className="px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {!qtyScreen ? 'Choose quantity' : idx + 1 < rows.length ? 'Confirm & next' : 'Confirm & finish'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'summary' && (
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900">{chosen.length}</span> item{chosen.length === 1 ? '' : 's'} · total{' '}
              <span className="font-bold text-emerald-700">{money(total)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => goTo(0)} className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                Review again
              </button>
              {onContinueByVoice && openRows.length > 0 && (
                <button
                  onClick={byVoice}
                  className="px-4 py-3 rounded-full bg-white border border-emerald-300 text-emerald-800 font-bold text-xs hover:bg-emerald-50 cursor-pointer"
                >
                  🎙 Finish {openRows.length} left by voice
                </button>
              )}
              <button
                onClick={addAll}
                disabled={chosen.length === 0}
                className="px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to cart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};