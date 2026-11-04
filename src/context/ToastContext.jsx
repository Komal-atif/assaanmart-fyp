import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Icon from '../components/ui/Icon'

const ToastContext = createContext(() => {})

// const toast = useToast();  toast('Saved'); toast('Could not save', 'error')
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems((list) => [...list, { id, message, type }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3200)
  }, [])
  const value = useMemo(() => toast, [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-ico"><Icon name={t.type === 'error' ? 'x' : 'check'} size={14} stroke={2.6} /></span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
