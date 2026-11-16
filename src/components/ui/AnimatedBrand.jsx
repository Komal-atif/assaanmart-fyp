import AnimatedLogo from './AnimatedLogo'

/**
 * Same intro as the store website: three dots spiral in -> ring pulse -> logo circle pops -> "AssanMart" types out.
 * Plays once when it appears (page refresh / login / splash). `playKey` replays it when it changes.
 * size = height of the round logo in px. Plain CSS only (the admin portal has no Tailwind).
 */
export default function AnimatedBrand({ size = 40, playKey = 0, mark = false }) {
  return (
    <span key={playKey} className="amb" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.2), '--s': `${size}px` }}>
      <style>{`
        .amb .mk{position:relative;width:var(--s);height:var(--s);flex-shrink:0;display:inline-block}
        .amb .mark{width:100%;height:100%;border-radius:9999px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;overflow:hidden;animation:amb-mark 3.6s ease-out 1 both !important;transform-origin:50% 50%}
        .amb .mark .am-logo{width:70%!important;height:70%!important;max-width:none}
        .amb .word{font-family:inherit;font-weight:800;letter-spacing:-0.02em;white-space:nowrap;color:#2a6b43;font-size:calc(var(--s) * .45);line-height:1;animation:amb-word 3.6s linear 1 both !important}
        .amb .word b{color:#1DAA61;font-weight:800}
        .amb .ring{position:absolute;inset:0;border-radius:9999px;border:2px solid #7fcf9a;pointer-events:none;opacity:0;animation:amb-ring 3.6s ease-out 1 both !important}
        .amb .orbit{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;opacity:0;animation:amb-orbit 3.6s cubic-bezier(.5,0,.3,1) 1 both !important}
        .amb .dot{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:9999px;animation:amb-dot 3.6s cubic-bezier(.5,0,.3,1) 1 both !important}
        .amb .d1{--a:0deg;background:#1daa61}
        .amb .d2{--a:120deg;background:#7fcf9a}
        .amb .d3{--a:240deg;background:#f59e0b}
        @keyframes amb-orbit{0%{opacity:0;transform:rotate(0)}8%{opacity:1}46%{opacity:1;transform:rotate(300deg)}48%,100%{opacity:0;transform:rotate(300deg)}}
        @keyframes amb-dot{0%{transform:rotate(var(--a)) translateX(26px) scale(.2)}12%{transform:rotate(var(--a)) translateX(26px) scale(1)}46%,100%{transform:rotate(var(--a)) translateX(0) scale(.6)}}
        @keyframes amb-ring{0%,46%{opacity:0;transform:scale(.7)}49%{opacity:1;transform:scale(1.15)}73%,100%{opacity:0;transform:scale(2)}}
        @keyframes amb-mark{0%,46%{opacity:0;transform:scale(.2)}60%{opacity:1;transform:scale(1.14)}70%{transform:scale(.97)}80%,100%{opacity:1;transform:scale(1)}}
        @keyframes amb-word{0%,63%{clip-path:inset(0 100% 0 0)}64%{clip-path:inset(0 100% 0 0);animation-timing-function:steps(9,end)}100%{clip-path:inset(0 0 0 0)}}
      `}</style>

      <span className="mk">
        <span className="mark"><AnimatedLogo /></span>
        <span className="ring" />
        <span className="orbit"><span className="dot d1" /><span className="dot d2" /><span className="dot d3" /></span>
      </span>

      {!mark && <span className="word">Assan<b>Mart</b></span>}
    </span>
  )
}