import { useEffect, useState } from 'react'

// columns: [{ key, header, render?(row), align? }]   pageSize: optional, adds Prev/Next
export default function DataTable({ columns, rows, rowKey = 'id', onRowClick, rowClass, pageSize, empty = null }) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [rows.length])

  if (rows.length === 0) return empty

  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1
  const current = Math.min(page, pages - 1)
  const shown = pageSize ? rows.slice(current * pageSize, (current + 1) * pageSize) : rows
  const keyOf = (r) => (typeof rowKey === 'function' ? rowKey(r) : r[rowKey])

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r, n) => (
              <tr key={keyOf(r)} className={`${onRowClick ? 'click' : ''} ${rowClass?.(r) || ''}`} style={{ '--i': Math.min(n, 12) }} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && pages > 1 && (
        <div className="pager">
          <span>Showing {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} of {rows.length}</span>
          <div>
            <button className="btn ghost sm" disabled={current === 0} onClick={() => setPage(current - 1)}><span>Previous</span></button>
            <span className="page-no">{current + 1} / {pages}</span>
            <button className="btn ghost sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><span>Next</span></button>
          </div>
        </div>
      )}
    </>
  )
}
