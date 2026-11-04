// <AsyncView state={useAsync(...)}>{(data) => <div>...</div>}</AsyncView>
export default function AsyncView({ state, children }) {
  if (state.error) return <div className="notice">{state.error}</div>
  if (state.data === null) {
    return (
      <div className="skeleton-page" aria-busy="true" aria-label="Loading">
        <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}</div>
        <div className="sk sk-wide" />
      </div>
    )
  }
  return children(state.data)
}
