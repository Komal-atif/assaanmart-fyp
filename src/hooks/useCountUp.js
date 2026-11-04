import { useEffect, useRef, useState } from 'react'

// Animates a number from its old value to the new one. Respects "reduce motion".
export default function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const to = Number(target) || 0
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || duration <= 0) { setValue(to); from.current = to; return undefined }
    const start = performance.now()
    const begin = from.current
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = begin + (to - begin) * eased
      setValue(v); from.current = v
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}
