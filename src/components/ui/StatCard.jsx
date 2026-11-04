import { Link } from 'react-router-dom'
import Icon from './Icon'
import useCountUp from '../../hooks/useCountUp'

// A KPI card. `value` is a number (counts up); `format` turns it into text. trend = % change (or null).
// tone: green | blue | amber | red | purple     to: makes the whole card a link
export default function StatCard({ label, value, format = (v) => Math.round(v).toLocaleString(), icon, trend = null, hint, tone = 'green', to }) {
  const shown = useCountUp(value)
  const body = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-ico t-${tone}`}>{icon && <Icon name={icon} size={18} />}</span>
      </div>
      <strong className="stat-value">{format(shown)}</strong>
      <div className="stat-foot">
        {trend !== null && trend !== undefined && (
          <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>
            <Icon name={trend >= 0 ? 'up' : 'down'} size={13} stroke={2.4} />{Math.abs(trend).toFixed(trend % 1 === 0 ? 0 : 1)}%
          </span>
        )}
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </>
  )
  return to ? <Link to={to} className={`card stat link t-${tone}`}>{body}</Link> : <div className={`card stat t-${tone}`}>{body}</div>
}
