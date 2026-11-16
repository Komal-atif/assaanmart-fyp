import AnimatedBrand from './AnimatedBrand'

// Animated AssanMart brand (same intro as the store website). Same props as before, so Sidebar, Login and Splash need no change.
//   height : size of the round logo in px      mark : true = only the round logo, false = logo + "AssanMart" text
export default function Logo({ height = 40, mark = false, className = '' }) {
  return (
    <span className={`logo ${className}`} aria-label="AssanMart" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <AnimatedBrand size={height} mark={mark} />
    </span>
  )
}