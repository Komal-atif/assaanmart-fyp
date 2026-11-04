import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import ProductImage from './ProductImage'
import StatusBadge from './StatusBadge'
import { updateStock } from '../../services/inventoryService'
import { getStockStatus } from '../../utils/stock'

// Edit the stock of one product. quick = start from "current + 10" (the + button on product cards)
export default function StockModal({ product, onClose, onSaved, limit = 10 }) {
  const [value, setValue] = useState(product.stockIsDemo ? '' : product.stockQuantity ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const add = (n) => setValue(String((Number(value) || 0) + n))
  const preview = value === '' ? null : getStockStatus({ isActive: true, stockQuantity: Number(value) }, limit)

  async function save() {
    setSaving(true)
    setError('')
    try {
      await updateStock(product.id, value)
      onSaved(product, Number(value))
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Update stock"
      onClose={onClose}
      narrow
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{saving ? 'Saving…' : 'Save stock'}</Button>
        </>
      }
    >
      <div className="list-row">
        <ProductImage src={product.imageUrl} alt={product.name} size={64} category={product.category} />
        <div className="grow">
          <strong>{product.name}</strong>
          <span className="muted">Now: {product.stockQuantity ?? 'not set'}{product.stockIsDemo ? ' (sample number)' : ''}</span>
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="stock-qty">New stock quantity</label>
        <input id="stock-qty" type="number" min="0" step="1" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <div className="chips">
          {[10, 50, 100].map((n) => <button key={n} type="button" className="chip" onClick={() => add(n)}>+{n}</button>)}
          <button type="button" className="chip chip-red" onClick={() => setValue('0')}>Out of stock (0)</button>
        </div>
        {preview && <div className="stock-preview">After saving: <StatusBadge status={preview} /></div>}
      </div>
      {error && <div className="notice">{error}</div>}
    </Modal>
  )
}
