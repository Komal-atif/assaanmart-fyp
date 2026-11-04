import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import AsyncView from '../components/ui/AsyncView'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { useToast } from '../context/ToastContext'
import ProductImage from '../components/ui/ProductImage'
import { addProduct, getProduct, getProducts, updateProduct } from '../services/productService'

const BLANK = {
  name: '', brand: '', brandUr: '', category: '', subcategory: '', productType: '',
  packageSize: '', unit: '', price: '', stockQuantity: '', imageUrl: '', aliases: '', isActive: true,
}

function Form({ initial, isNew, categories, subcategories }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [f, setF] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    const link = f.imageUrl.trim()
    if (link && !/^(https?:\/\/|\/)/i.test(link)) {
      setError('Image link must start with http://, https:// or /')
      return
    }
    setSaving(true)
    try {
      const data = { ...f, imageUrl: link }
      if (isNew) await addProduct(data)
      else await updateProduct(initial.id, data)
      toast(isNew ? 'Product added' : 'Product saved')
      navigate('/products')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="form-grid">
        <div className="field full"><label htmlFor="name">Product name *</label><input id="name" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="brand">Brand</label><input id="brand" value={f.brand} onChange={set('brand')} /></div>
        <div className="field"><label htmlFor="brandUr">Brand (Urdu)</label><input id="brandUr" dir="rtl" value={f.brandUr} onChange={set('brandUr')} /></div>
        <div className="field">
          <label htmlFor="category">Category *</label>
          <input id="category" list="categories" value={f.category} onChange={set('category')} />
          <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="subcategory">Subcategory</label>
          <input id="subcategory" list="subcategories" value={f.subcategory} onChange={set('subcategory')} />
          <datalist id="subcategories">{subcategories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="productType">Product type</label><input id="productType" value={f.productType} onChange={set('productType')} /></div>
        <div className="field"><label htmlFor="price">Price (PKR) *</label><input id="price" type="number" min="0" step="any" value={f.price} onChange={set('price')} /></div>
        <div className="field"><label htmlFor="packageSize">Package size</label><input id="packageSize" value={f.packageSize} onChange={set('packageSize')} /></div>
        <div className="field"><label htmlFor="unit">Unit (kg, L, g…)</label><input id="unit" value={f.unit} onChange={set('unit')} /></div>
        <div className="field">
          <label htmlFor="stockQuantity">Stock quantity</label>
          <input id="stockQuantity" type="number" min="0" step="1" value={f.stockQuantity} onChange={set('stockQuantity')} />
          <span className="hint">Leave empty if you don’t know yet. 0 means out of stock.</span>
        </div>
        <div className="field full">
          <label htmlFor="imageUrl">Image link</label>
          <div className="toolbar">
            <ProductImage src={f.imageUrl.trim() || null} alt="Preview" size={56} category={f.category} />
            <input id="imageUrl" style={{ flex: 1 }} placeholder="/products/Dairy/Milk/325.png  or  https://…" value={f.imageUrl} onChange={set('imageUrl')} />
          </div>
        </div>
        <div className="field full">
          <label htmlFor="aliases">Search names (aliases)</label>
          <textarea id="aliases" rows="2" value={f.aliases} onChange={set('aliases')} />
          <span className="hint">Separate with semicolons. The voice agent matches what customers say to these names.</span>
        </div>
        <div className="field full"><label className="check"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} />Active (visible to customers)</label></div>
      </div>
      {error && <div className="notice">{error}</div>}
      <div className="form-actions">
        <Button variant="ghost" onClick={() => navigate('/products')}>Cancel</Button>
        <Button type="submit" loading={saving}>{saving ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}</Button>
      </div>
    </form>
  )
}

export default function ProductForm() {
  const { id } = useParams()
  const isNew = id === undefined
  const state = useAsync(async () => {
    const [product, all] = await Promise.all([isNew ? null : getProduct(id), getProducts()])
    return {
      product,
      categories: [...new Set(all.map((p) => p.category).filter(Boolean))].sort(),
      subcategories: [...new Set(all.map((p) => p.subcategory).filter(Boolean))].sort(),
    }
  }, [id])

  return (
    <div className="page">
      <Link className="back-link" to="/products"><Icon name="back" size={16} />Back to products</Link>
      <div className="page-head"><div><h1>{isNew ? 'Add product' : 'Edit product'}</h1></div></div>
      <AsyncView state={state}>
        {({ product, categories, subcategories }) => {
          if (!isNew && !product) return <div className="card"><EmptyState title="Product not found" /></div>
          const initial = isNew ? BLANK : {
            ...BLANK, ...Object.fromEntries(Object.entries(product).map(([k, v]) => [k, v ?? ''])),
            aliases: product.aliases.join('; '), isActive: product.isActive,
            stockQuantity: product.stockIsDemo ? '' : product.stockQuantity ?? '',
          }
          return <Form key={id ?? 'new'} initial={initial} isNew={isNew} categories={categories} subcategories={subcategories} />
        }}
      </AsyncView>
    </div>
  )
}
