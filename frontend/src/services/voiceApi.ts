// Voice assistant <-> FastAPI backend. Backend address comes from VITE_BACKEND_URL (default http://127.0.0.1:8000).

import { supabase } from '../supabaseClient';

const SID_KEY = 'am_voice_sid';

export function getBackendUrl(): string {
  return (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

// One id per browser, so every customer gets their own cart on the server.
function sessionId(): string {
  try {
    let id = localStorage.getItem(SID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

// Every request carries the browser's session id and, when the customer is logged in, the Supabase login token,
// so the backend knows whose cart and whose order it is.
export async function apiHeaders(json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'X-Session-Id': sessionId() };
  if (json) h['Content-Type'] = 'application/json';
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) h['Authorization'] = `Bearer ${data.session.access_token}`;
  } catch {}
  return h;
}

export interface VoiceCartItem {
  id: number;
  item_family?: string;
  name: string;
  brand: string;
  quantity: number;
  unit?: string;
  price_per_unit: number;
  line_total: number;
  image_url?: string | null;
}

export interface VoicePendingItem {
  label: string;
  status: 'brand' | 'type' | 'variant' | 'quantity' | 'waiting' | string;
}

export interface VoiceCart {
  items: VoiceCartItem[];
  total: number;
  count: number;
  pending?: VoicePendingItem[];
  awaiting_confirmation?: boolean;
  checkout?: boolean; // true after the customer said "confirm" -> open the store checkout
}

export interface VoiceOptionItem {
  label: string;
  value: string;
  spoken?: boolean;
  name?: string;
  brand?: string;
  size?: string;
  price?: number;
  price_text?: string;
  image_url?: string | null;
  id?: number;
}

export interface VoiceOptions {
  stage: 'brand' | 'type' | 'variant' | 'quantity';
  modal?: boolean;
  title: string;
  items?: VoiceOptionItem[];
  total?: number;
  paged?: boolean;
  next_value?: string | null;
  product?: VoiceOptionItem | null;
  up_next?: string[];
}

export interface VoiceTurnResponse {
  detected_language?: 'english' | 'urdu';
  user_text?: string;
  reply_text: string;
  audio_url?: string | null;
  options?: VoiceOptions | null;
  cart?: VoiceCart;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  error?: string;
}

export const EMPTY_VOICE_CART: VoiceCart = { items: [], total: 0, count: 0, pending: [], awaiting_confirmation: false, checkout: false };

async function handle<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} -> HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

const post = async (path: string, body?: unknown) =>
  fetch(`${getBackendUrl()}${path}`, {
    method: 'POST',
    headers: await apiHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${getBackendUrl()}/health`, { signal: ctl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export interface GreetOptions {
  lang?: 'english' | 'urdu'; // language already chosen (welcome agent) -> skip the language question
  resume?: boolean;          // keep the cart and conversation
}

export const greetVoiceSession = async (opts: GreetOptions = {}) => {
  const qs = new URLSearchParams();
  if (opts.lang) qs.set('lang', opts.lang);
  if (opts.resume) qs.set('resume', '1');
  const q = qs.toString();
  return handle<VoiceTurnResponse>(await post(`/greet${q ? `?${q}` : ''}`), '/greet');
};

/** Photo scanner -> voice: the confirmed items go into the voice basket, the agent asks about the open lines. */
export interface VoicePreload {
  lang: 'english' | 'urdu';
  cart: { id: number; qty: number }[];
  lines: string[];
}
export const preloadVoiceSession = async (payload: VoicePreload) =>
  handle<VoiceTurnResponse>(await post('/voice/preload', payload), '/voice/preload');

// ---- welcome agent (page open: language -> voice or browse -> what next after an order) ----
export type WelcomeStage = 'language' | 'mode' | 'after_order';
export interface WelcomeSay {
  text: string;
  audio_url: string;
  lang: 'english' | 'urdu';
  stage: WelcomeStage;
}
export interface WelcomeReply {
  heard: string;
  action: 'language' | 'voice' | 'browse' | 'done' | null;
  stage: WelcomeStage;
  lang: 'english' | 'urdu';
  text?: string;
  audio_url?: string;
}
export const welcomeSay = async (stage: WelcomeStage, lang: 'english' | 'urdu') =>
  handle<WelcomeSay>(await post('/welcome/say', { stage, lang }), '/welcome/say');

export async function welcomeReply(audioBlob: Blob, stage: WelcomeStage, lang: 'english' | 'urdu') {
  const fd = new FormData();
  fd.append('audio', audioBlob, `speech.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  fd.append('stage', stage);
  fd.append('lang', lang);
  const res = await fetch(`${getBackendUrl()}/welcome/reply`, { method: 'POST', headers: await apiHeaders(), body: fd });
  return handle<WelcomeReply>(res, '/welcome/reply');
}

export async function converseVoice(audioBlob: Blob, history: Array<{ role: string; content: string }> = []) {
  const fd = new FormData();
  fd.append('audio', audioBlob, `speech.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  fd.append('history_json', JSON.stringify(history.slice(-6)));
  const res = await fetch(`${getBackendUrl()}/converse`, { method: 'POST', headers: await apiHeaders(), body: fd });
  return handle<VoiceTurnResponse>(res, '/converse');
}

export const selectVoiceOption = async (value: string, qty?: number | null) =>
  handle<VoiceTurnResponse>(await post('/select', { value, qty }), '/select');

export const actionVoice = async (action: 'confirm' | 'decline' | 'cancel') =>
  handle<VoiceTurnResponse>(await post('/action', { action }), '/action');

export const updateVoiceCart = async (id: number, qty: number) =>
  handle<VoiceCart>(await post('/cart/update', { id, qty }), '/cart/update');

export const getVoiceCart = async () =>
  handle<VoiceCart>(await fetch(`${getBackendUrl()}/cart`, { headers: await apiHeaders() }), '/cart');


// ---- photo scanner by voice ----
export interface ScanVoiceOption { id?: number; name: string; brand: string; size: string }
export interface ScanVoiceReply { heard: string; action: 'pick' | 'skip' | 'back' | 'more' | 'yes' | 'no' | 'review' | 'qty' | 'ambiguous' | 'checkout' | 'browse' | null; index?: number; indices?: number[]; value?: number }

export const scanSay = async (text: string, lang: 'english' | 'urdu') =>
  handle<{ audio_url: string | null }>(await post('/scan/say', { text, lang }), '/scan/say');

export async function scanReply(audioBlob: Blob, context: 'detected' | 'pick' | 'summary' | 'qty' | 'next', lang: 'english' | 'urdu', options: ScanVoiceOption[]) {
  const fd = new FormData();
  fd.append('audio', audioBlob, `speech.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  fd.append('context', context);
  fd.append('lang', lang);
  fd.append('options_json', JSON.stringify(options));
  const res = await fetch(`${getBackendUrl()}/scan/reply`, { method: 'POST', headers: await apiHeaders(), body: fd });
  return handle<ScanVoiceReply>(res, '/scan/reply');
}

// ---- sign-up form by voice ----
export interface FormVoiceReply { heard: string; value?: string; ok: boolean; action?: string | null; which?: 'name' | 'phone' | 'address' | null }

export async function formVoiceReply(audioBlob: Blob, field: 'name' | 'phone' | 'address' | 'confirm', lang: 'english' | 'urdu') {
  const fd = new FormData();
  fd.append('audio', audioBlob, `speech.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  fd.append('field', field);
  fd.append('lang', lang);
  const res = await fetch(`${getBackendUrl()}/form/reply`, { method: 'POST', headers: await apiHeaders(), body: fd });
  return handle<FormVoiceReply>(res, '/form/reply');
}