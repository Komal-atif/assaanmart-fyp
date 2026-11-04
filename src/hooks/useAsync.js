import { useEffect, useState } from 'react'

// const state = useAsync(getProducts)  ->  { data, loading, error, reload }
// data stays null until the first load finishes. After reload() the old data stays visible.
export default function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e) => alive && setState({ data: null, loading: false, error: e?.message || 'Something went wrong.' }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}
