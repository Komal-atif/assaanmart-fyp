import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import { useToast } from '../context/ToastContext'
import AsyncView from '../components/ui/AsyncView'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'
import ProductImage from '../components/ui/ProductImage'
import { useAuth } from '../context/AuthContext'
import { getProducts } from '../services/productService'
import {
  getLowStockLimit, setLowStockLimit, getStoreInfo, saveStoreInfo, resetLocalData,
  getDemoMode, setDemoMode, getImageBaseSetting, setImageBase,
} from '../services/settingsService'
import { IMAGE_BASE_URL } from '../config'

function LimitCard({ initial }) {
  const toast = useToast()
  const [value, setValue] = useState(String(initial))
  const [error, setError] = useState('')
  async function save(e) {
    e.preventDefault(); setError('')
    try { await setLowStockLimit(value); toast('Low stock limit saved') } catch (err) { setError(err.message) }
  }
  return (
    <form className="card" onSubmit={save}>
      <h2 className="mb">Low stock limit</h2>
      <div className="field">
        <label htmlFor="limit">Warn when a product has this many left or fewer</label>
        <input id="limit" type="number" min="0" step="1" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      {error && <div className="notice mb">{error}</div>}
      <Button type="submit">Save limit</Button>
    </form>
  )
}

function StoreCard({ initial }) {
  const toast = useToast()
  const [f, setF] = useState(initial)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function save(e) {
    e.preventDefault(); setError('')
    try { await saveStoreInfo(f); toast('Store details saved') } catch (err) { setError(err.message) }
  }
  return (
    <form className="card" onSubmit={save}>
      <h2 className="mb">Store details</h2>
      <div className="field"><label htmlFor="storeName">Store name *</label><input id="storeName" value={f.storeName} onChange={set('storeName')} /></div>
      <div className="field"><label htmlFor="phone">Phone</label><input id="phone" value={f.phone} onChange={set('phone')} /></div>
      <div className="field"><label htmlFor="address">Address</label><textarea id="address" rows="2" value={f.address} onChange={set('address')} /></div>
      <div className="field"><label htmlFor="hours">Opening hours</label><input id="hours" value={f.openingHours} onChange={set('openingHours')} /></div>
      {error && <div className="notice mb">{error}</div>}
      <Button type="submit">Save details</Button>
    </form>
  )
}

function ImagesCard({ sample }) {
  const toast = useToast()
  const [url, setUrl] = useState(getImageBaseSetting())
  const [error, setError] = useState('')
  async function save(e) {
    e.preventDefault(); setError('')
    try { await setImageBase(url); toast('Image source saved. Reloading…'); setTimeout(() => window.location.reload(), 700) }
    catch (err) { setError(err.message) }
  }
  return (
    <form className="card" onSubmit={save}>
      <h2 className="mb">Product images</h2>
      <p className="muted mb">Your Excel stores image paths like <code>/products/Dairy/Milk/325.png</code>. Put the pictures in <code>public/images/products/…</code> (same folders), or paste the website that serves them (for example your friend’s frontend).</p>
      <div className="field">
        <label htmlFor="imgbase">Image website (optional)</label>
        <input id="imgbase" placeholder={IMAGE_BASE_URL || 'https://your-site.com'} value={url} onChange={(e) => setUrl(e.target.value)} />
        <span className="hint">Leave empty to use the local folder. No slash at the end.</span>
      </div>
      {sample && <div className="img-test"><ProductImage src={sample.imageUrl} alt={sample.name} size={56} category={sample.category} /><span className="muted">Test picture: {sample.name}. If you only see a coloured tile, the file was not found.</span></div>}
      {error && <div className="notice mb">{error}</div>}
      <Button type="submit">Save image source</Button>
    </form>
  )
}

export default function Settings() {
  const { admin } = useAuth()
  const { askLogout } = useOutletContext()
  const [confirm, setConfirm] = useState(false)
  const [demo, setDemo] = useState(getDemoMode())
  const state = useAsync(async () => ({
    limit: await getLowStockLimit(), store: await getStoreInfo(), sample: (await getProducts()).find((p) => p.imageUrl) || null,
  }))

  return (
    <div className="page">
      <div className="page-head"><div><h1>Settings</h1><p>Store details, stock alerts, images and your account.</p></div></div>
      <AsyncView state={state}>
        {({ limit, store, sample }) => (
          <div className="grid-eq">
            <LimitCard initial={limit} />
            <StoreCard initial={store} />
            <ImagesCard sample={sample} />
            <div className="card">
              <h2 className="mb">Demo data</h2>
              <p className="muted mb">Your Excel has no orders and only a few stock numbers. While this is on, sample orders (built from your real products and prices) and sample stock for empty cells fill the dashboard. Real Excel numbers are never changed.</p>
              <label className="switch">
                <input type="checkbox" checked={demo} onChange={(e) => { setDemo(e.target.checked); setDemoMode(e.target.checked) }} />
                <span className="slider" /><span>{demo ? 'Demo data is ON' : 'Demo data is OFF'}</span>
              </label>
            </div>
            <div className="card">
              <h2 className="mb">Account</h2>
              <p><strong>{admin?.name}</strong></p>
              <p className="muted mb">{admin?.email}</p>
              <Button variant="ghost" icon="logout" onClick={askLogout}>Log out</Button>
            </div>
            <div className="card">
              <h2 className="mb">Reload product data</h2>
              <p className="muted mb">After you change the Excel file and run <code>npm run data</code>, use this to load the new products. Edits made in this browser are cleared. Your account and settings are kept.</p>
              <Button variant="soft" icon="refresh" onClick={() => setConfirm(true)}>Reload from Excel data</Button>
            </div>
          </div>
        )}
      </AsyncView>
      {confirm && (
        <ConfirmModal icon="refresh" title="Reload product data?" tone="danger" confirmLabel="Yes, reload"
          text="Stock and product edits saved in this browser will be replaced by the data from the Excel file."
          onCancel={() => setConfirm(false)} onConfirm={resetLocalData} />
      )}
    </div>
  )
}
