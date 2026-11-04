import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as auth from '../services/authService'

const AuthContext = createContext(null)
const SPLASHED = 'assanmart:splashed'

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [ready, setReady] = useState(false)
  const [splash, setSplash] = useState(false)

  useEffect(() => {
    auth.getCurrentAdmin().then((a) => {
      setAdmin(a)
      // already signed in and the app was just opened -> show the welcome screen once per browser session
      if (a && !sessionStorage.getItem(SPLASHED)) setSplash(true)
      setReady(true)
    })
  }, [])

  const login = useCallback(async (email, password) => {
    const a = await auth.login(email, password)
    setAdmin(a); setSplash(true)
    return a
  }, [])
  const register = useCallback(async (data) => {
    const a = await auth.registerAdmin(data)
    setAdmin(a); setSplash(true)
    return a
  }, [])
  const logout = useCallback(async () => {
    await auth.logout()
    sessionStorage.removeItem(SPLASHED)
    sessionStorage.setItem('assanmart:flash', 'You have been logged out successfully.')
    setAdmin(null)
  }, [])
  const endSplash = useCallback(() => { sessionStorage.setItem(SPLASHED, '1'); setSplash(false) }, [])

  const value = useMemo(() => ({ admin, ready, splash, endSplash, login, register, logout }), [admin, ready, splash, endSplash, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
