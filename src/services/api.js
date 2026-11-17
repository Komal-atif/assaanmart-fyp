// One place that talks to the FastAPI backend (adds the admin's Supabase login token to every call).
// No extra packages: Supabase login is a plain fetch to its REST API. No service_role key anywhere.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const BACKEND = (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const KEY = 'assanmart:admin-session'

export const readSession = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
export const writeSession = (s) => localStorage.setItem(KEY, JSON.stringify(s))
export const clearSession = () => localStorage.removeItem(KEY)

async function supabase(grant, body) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in the admin .env (restart npm run dev after editing it).')
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Login failed.')
  return { token: data.access_token, refresh: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 }
}

export async function signUp(email, password, name) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in the admin .env.')
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: { full_name: name } }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(/already/i.test(data.msg || data.message || '') ? 'This email already has an account. Please log in.' : data.msg || data.message || data.error_description || 'Sign-up failed.')
  if (!data.access_token) throw new Error('Account created, but Supabase wants an email confirmation. Turn off "Confirm email" (Authentication -> Providers -> Email) and log in.')
  return { token: data.access_token, refresh: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 }
}

export async function getSetupStatus() {
  const res = await fetch(`${BACKEND}/admin/setup`)
  if (!res.ok) throw new Error('backend not reachable')
  return res.json()
}

export const passwordLogin = (email, password) => supabase('password', { email, password })

export async function getToken() {
  const s = readSession()
  if (!s?.token) return null
  if (s.expiresAt - Date.now() > 60000) return s.token
  try {
    const t = await supabase('refresh_token', { refresh_token: s.refresh })
    writeSession({ ...s, ...t })
    return t.token
  } catch { clearSession(); return null }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken()
  if (!token) throw new Error('Please log in again.')
  let res
  try {
    res = await fetch(`${BACKEND}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch { throw new Error(`Cannot reach the backend at ${BACKEND}. Is it running?`) }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(', ') : `Request failed (${res.status})`)
  }
  return data
}