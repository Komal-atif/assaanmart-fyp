import { STOCK_LABEL } from '../../utils/stock'

// Works for stock statuses ('in','low','out','unset','inactive') and order statuses ('Pending', ...)
// Each status has its own colour, so low stock (amber) and out of stock (red) are never confused.
const STYLE = {
  in: 'b-green', low: 'b-amber', out: 'b-red', unset: 'b-gray', inactive: 'b-gray',
  Pending: 'b-amber', Confirmed: 'b-blue', Packed: 'b-teal', 'Out for Delivery': 'b-purple', Delivered: 'b-green', Cancelled: 'b-red',
}
export const STATUS_COLOR = {
  Pending: '#f0a63a', Confirmed: '#4a9bd0', Packed: '#3aa59a', 'Out for Delivery': '#8a6bd1', Delivered: '#2f8f5b', Cancelled: '#e0594f',
}

export default function StatusBadge({ status, dot = true }) {
  return <span className={`badge ${STYLE[status] || 'b-gray'}`}>{dot && <i className="b-dot" />}{STOCK_LABEL[status] || status}</span>
}
