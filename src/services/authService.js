// Admin login WITHOUT any hardcoded/dummy account.
// First time: the admin creates an account (registerAdmin). After that: login.
// This is local-only (stored in this browser). When the FastAPI backend is ready, replace these
// functions with real login/JWT calls; the pages stay the same.
import { readSetting, writeSetting, removeSetting } from './dataStore'

const SESSION_KEY = 'assanmart:session'

async function hash(email, password) {
  const data = new TextEncoder().encode(`${email.toLowerCase()}::${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const setSession = (admin) => localStorage.setItem(SESSION_KEY, JSON.stringify({ name: admin.name, email: admin.email }))

export async function hasAdmin() {
  return !!readSetting('adminAccount', null)
}

export async function registerAdmin({ name, email, password }) {
  if (await hasAdmin()) throw new Error('An admin account already exists. Please log in.')
  const cleanName = String(name ?? '').trim()
  const cleanEmail = String(email ?? '').trim().toLowerCase()
  if (!cleanName) throw new Error('Name is required.')
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Enter a valid email.')
  if (String(password ?? '').length < 6) throw new Error('Password must be at least 6 characters.')
  const admin = { name: cleanName, email: cleanEmail, passwordHash: await hash(cleanEmail, password) }
  writeSetting('adminAccount', admin)
  setSession(admin)
  return { name: admin.name, email: admin.email }
}

export async function login(email, password) {
  const admin = readSetting('adminAccount', null)
  if (!admin) throw new Error('No admin account yet. Create one first.')
  const ok = admin.email === String(email ?? '').trim().toLowerCase() &&
    admin.passwordHash === (await hash(String(email ?? '').trim(), String(password ?? '')))
  if (!ok) throw new Error('Wrong email or password.')
  setSession(admin)
  return { name: admin.name, email: admin.email }
}

export async function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export async function getCurrentAdmin() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

// "Forgot password": accounts live only in this browser, so the way back in is to create the admin again.
export async function resetAdminAccount() {
  removeSetting('adminAccount')
  localStorage.removeItem(SESSION_KEY)
}
