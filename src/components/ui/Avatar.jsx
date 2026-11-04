import { initials, avatarColor } from '../../utils/format'
export default function Avatar({ name, size = 34 }) {
  return (
    <span className="avatar-s" style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
