// One place for the backend address. Change it here (or set VITE_BACKEND_URL in frontend/.env).
export const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export async function post(path, body = {}) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

export async function get(path) {
  const res = await fetch(`${BACKEND}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

export const EMPTY_CART = { items: [], total: 0, count: 0, awaiting_confirmation: false };