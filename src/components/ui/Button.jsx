import Icon from './Icon'

// variant: primary | soft | ghost | danger | blue | amber    loading shows a spinner and blocks double clicks
export default function Button({ variant = 'primary', size, wide, loading, icon, className = '', type = 'button', children, disabled, ...rest }) {
  const cls = ['btn', variant, size === 'sm' ? 'sm' : '', wide ? 'wide' : '', loading ? 'is-loading' : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spin" aria-hidden="true" /> : icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
    </button>
  )
}
