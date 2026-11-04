import { useEffect, useRef, useState } from 'react'

// Calls state.reload() every `ms` while the tab is visible; returns when data last loaded.
export default function useAutoRefresh(state, ms = 30000) {
  const ref = useRef(state.reload)
  ref.current = state.reload
  const [updated, setUpdated] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) ref.current() }, ms)
    return () => clearInterval(id)
  }, [ms])
  useEffect(() => { if (!state.loading && state.data) setUpdated(new Date()) }, [state.loading, state.data])
  return updated
}
