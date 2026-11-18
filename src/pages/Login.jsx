import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import useAsync from '../hooks/useAsync'
import { getAdminSetup } from '../services/authService'
import Icon from '../components/ui/Icon'
import Logo from '../components/ui/Logo'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'

const REMEMBER = 'assanmart:rememberEmail'

export default function Login() {
  const { admin, ready, login, register } = useAuth()
  const toast = useToast()
  const setup = useAsync(getAdminSetup)
  const [wantCreate, setWantCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: localStorage.getItem(REMEMBER) || '', password: '' })
  const [remember, setRemember] = useState(!!localStorage.getItem(REMEMBER))
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [flash] = useState(() => {
    const m = sessionStorage.getItem('assanmart:flash')
    if (m) sessionStorage.removeItem('assanmart:flash')
    return m
  })

  if (ready && admin) return <Navigate to="/dashboard" replace />

  const creating = setup.data ? (!setup.data.exists || wantCreate) : false // first-time setup, or 'Create account' chosen
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (remember && form.email) localStorage.setItem(REMEMBER, form.email.trim()); else localStorage.removeItem(REMEMBER)
      if (creating) await register(form)
      else await login(form.email, form.password)
    } catch (err) {
      setError(err.message)
      setShake((n) => n + 1)
      setBusy(false)
    }
  }

  async function doReset() {
    setForgot(false)
    toast('Reset the password in Supabase (Authentication -> Users), or create a new admin account.')
  }

  return (
    <div className="login">
      <span className="leaf l1" /><span className="leaf l2" /><span className="leaf l3" />
      <section className="login-hero">
        <Logo height={64} className="hero-logo" />
        <h1>Fresh Groceries<br />for a Healthier<br />Tomorrow</h1>
        <p>Smarter shopping. Happier homes.</p>
        <ul className="hero-feats">
          <li><span><Icon name="leaf" size={20} /></span>Fresh<br />Products</li>
          <li><span><Icon name="truck" size={20} /></span>Fast<br />Delivery</li>
          <li><span><Icon name="shield" size={20} /></span>Secure<br />Payments</li>
        </ul>
        <img className="hero-basket" src="/images/login-basket.jpg" alt="" aria-hidden="true" />
      </section>

      <section className="login-side">
        <form className={`login-card ${shake ? 'shake' : ''}`} key={shake} onSubmit={submit} noValidate>
          {flash && <div className="flash"><Icon name="check" size={16} stroke={2.6} />{flash}</div>}
          {setup.data === null ? (
            <div className="loading"><span className="ring-spin" /></div>
          ) : (
            <>
              <h2>{creating ? 'Create admin account' : 'Welcome Back!'}</h2>
              <p className="sub">{creating ? 'First time here. Set up the admin account for your store.' : 'Login to your AssanMart admin account.'}</p>

              {creating && (
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <div className="input-ico"><Icon name="user" size={18} /><input id="name" value={form.name} onChange={set('name')} placeholder="Madeeha Naeem" autoComplete="name" /></div>
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Email Address</label>
                <div className="input-ico"><Icon name="mail" size={18} /><input id="email" type="email" value={form.email} onChange={set('email')} placeholder="admin@assanmart.com" autoComplete="email" /></div>
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-ico">
                  <Icon name="lock" size={18} />
                  <input id="password" type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete={creating ? 'new-password' : 'current-password'} />
                  <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeoff' : 'eye'} size={18} /></button>
                </div>
                {creating && <span className="hint">At least 6 characters.</span>}
              </div>

              {!creating && (
                <div className="login-row">
                  <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
                  <button type="button" className="link-btn" onClick={() => setForgot(true)}>Forgot password?</button>
                </div>
              )}
              {error && <div className="notice" role="alert">{error}</div>}
              <Button type="submit" wide loading={busy} className="login-btn">{busy ? 'Signing in…' : creating ? 'Create account' : 'Login'}</Button>
              {setup.data?.exists && setup.data?.open && (
                <p className="foot">
                  {creating ? 'Already have an account? ' : 'Don’t have an account? '}
                  <button type="button" className="link-btn" onClick={() => { setWantCreate(!wantCreate); setError('') }}>{creating ? 'Log in' : 'Create account'}</button>
                </p>
              )}
              {setup.data?.exists && !setup.data?.open && !creating && (
                <p className="foot">Don’t have an account? <button type="button" className="link-btn" onClick={() => toast('Ask the store owner to give your account admin access.')}>Contact admin</button></p>
              )}
            </>
          )}
        </form>
      </section>

      {forgot && (
        <ConfirmModal icon="lock" tone="primary" title="Forgot your password?"
          text="Admin passwords live in Supabase. Open your Supabase project -> Authentication -> Users, and reset the password there."
          confirmLabel="OK" onCancel={() => setForgot(false)} onConfirm={doReset} />
      )}
    </div>
  )
}