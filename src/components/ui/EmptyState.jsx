import Icon from './Icon'
export default function EmptyState({ title, text, action, icon = 'products' }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
