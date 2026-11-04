import { LOGO_SRC, LOGO_MARK_SRC } from '../../config'

// PLACEHOLDER logo. Replace public/images/logo.svg (and logo-mark.svg) with the real files; nothing else to change.
export default function Logo({ height = 40, mark = false, className = '' }) {
  return <img className={`logo ${className}`} src={mark ? LOGO_MARK_SRC : LOGO_SRC} alt="AssanMart" style={{ height }} draggable="false" />
}
