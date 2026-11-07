// Orders, "My Orders" and the grocery-list scanner talk to the FastAPI backend (same address as the voice agent).
import { getBackendUrl, apiHeaders } from './voiceApi';

async function ok<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = typeof j?.detail === 'string' ? j.detail : '';
    } catch {}
    throw new Error(detail || `${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------- checkout
export interface PlaceOrderPayload {
  items: { id: string | number; quantity: number }[];
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  payment_method: string;
  delivery_slot: string;
  lat?: number | null;
  lng?: number | null;
}

export interface PlacedOrder {
  order_id: number;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
}

export async function placeWebOrder(payload: PlaceOrderPayload): Promise<PlacedOrder> {
  const res = await fetch(`${getBackendUrl()}/orders/place`, {
    method: 'POST',
    headers: await apiHeaders(true),
    body: JSON.stringify(payload),
  });
  return ok<PlacedOrder>(res, '/orders/place');
}

// ---------------------------------------------------------------- saved delivery details
export interface SavedProfile {
  name: string;
  phone: string;
  address: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
}

/** The delivery details this customer gave before (null if none yet or not signed in). */
export async function fetchProfile(): Promise<SavedProfile | null> {
  try {
    const res = await fetch(`${getBackendUrl()}/me/profile`, { headers: await apiHeaders() });
    if (!res.ok) return null;
    const d = await res.json();
    return d.profile || null;
  } catch {
    return null;
  }
}

/** Remember the delivery details (sign-up form, or after the first order). */
export async function saveProfile(p: Partial<SavedProfile>): Promise<void> {
  try {
    await fetch(`${getBackendUrl()}/me/profile`, { method: 'PUT', headers: await apiHeaders(true), body: JSON.stringify(p) });
  } catch {
    /* not critical: the checkout saves them again with the first order */
  }
}

// ---------------------------------------------------------------- my orders
export interface MyOrderItem {
  id?: number;
  name: string;
  brand?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  size?: string;
}

export interface MyOrder {
  id: number;
  total: number;
  subtotal?: number | null;
  delivery_fee?: number | null;
  status: string;
  created_at: string;
  source?: 'voice' | 'web' | null;
  payment_method?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  delivery_slot?: string | null;
  items: MyOrderItem[];
}

export async function fetchMyOrders(): Promise<MyOrder[]> {
  const res = await fetch(`${getBackendUrl()}/orders`, { headers: await apiHeaders() });
  const data = await ok<{ orders: MyOrder[] }>(res, '/orders');
  return data.orders;
}

// ---------------------------------------------------------------- grocery list photo
export interface ScanCandidate {
  id: number;
  name: string;
  brand: string;
  size: string;
  price: number;
  image_url?: string | null;
  quantity: number;
}

export interface ScanLine {
  text: string;
  qty_text: string | null;
  status: 'matched' | 'choose' | 'unknown';
  candidates: ScanCandidate[];
  more?: ScanCandidate[]; // other products of the same kind, shown under "more options"
  english?: string;       // the line named in English (so the agent can say Urdu items in an English session)
}

export async function scanGroceryList(image: Blob): Promise<ScanLine[]> {
  const fd = new FormData();
  fd.append('image', image, 'list.jpg');
  const res = await fetch(`${getBackendUrl()}/scan-list`, { method: 'POST', headers: await apiHeaders(), body: fd });
  const data = await ok<{ lines: ScanLine[] }>(res, '/scan-list');
  return data.lines;
}