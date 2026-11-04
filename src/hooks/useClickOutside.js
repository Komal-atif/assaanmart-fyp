import { useEffect } from 'react'
// Calls onOutside when the user clicks outside ref.current or presses Escape.
export default function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside() }
    const key = (e) => { if (e.key === 'Escape') onOutside() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [ref, onOutside, active])
}
