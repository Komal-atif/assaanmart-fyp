// Admin login = a real Supabase account whose app_metadata.role is "admin". The backend double-checks it.
import { api, passwordLogin, signUp, getSetupStatus, readSession, writeSession, clearSession } from './api'

// { exists: an admin account exists already, open: the page may create one }
export async function getAdminSetup() {
  try { return await getSetupStatus() } catch { return { exists: true, open: false } }
}
export async function hasAdmin() { return (await getAdminSetup()).exists }

// Create the account in Supabase, then make it the admin, then stay logged in (no second login needed).
export async function registerAdmin({ name, email, password }) {
  const cleanName = String(name ?? '').trim()
  const cleanEmail = String(email ?? '').trim().toLowerCase()
  if (!cleanName) throw new Error('Name is required.')
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Enter a valid email.')
  if (String(password ?? '').length < 6) throw new Error('Password must be at least 6 characters.')
  const setup = await getAdminSetup()
  if (setup.exists && !setup.open) throw new Error('An admin account already exists. Please log in.')
  const t = await signUp(cleanEmail, password, cleanName)
  writeSession({ ...t, email: cleanEmail, name: cleanName })
  try {
    await api('/admin/setup', { method: 'POST' })
    const me = await api('/admin/me')
    const admin = { name: cleanName, email: me.email || cleanEmail }
    writeSession({ ...t, ...admin })
    return admin
  } catch (e) {
    clearSession()
    throw e
  }
}

export async function login(email, password) {
  const cleanEmail = String(email ?? '').trim().toLowerCase()
  const t = await passwordLogin(cleanEmail, String(password ?? ''))
  writeSession({ ...t, email: cleanEmail, name: cleanEmail.split('@')[0] })
  try {
    const me = await api('/admin/me')
    const admin = { name: me.name || cleanEmail.split('@')[0], email: me.email || cleanEmail }
    writeSession({ ...t, ...admin })
    return admin
  } catch (e) {
    clearSession()
    throw new Error(/not an admin/i.test(e.message) ? 'This account is not an admin.' : e.message)
  }
}

export async function logout() { clearSession() }

export async function getCurrentAdmin() {
  const s = readSession()
  return s?.token ? { name: s.name, email: s.email } : null
}

export async function resetAdminAccount() { clearSession() }