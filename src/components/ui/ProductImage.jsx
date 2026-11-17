import { useEffect, useMemo, useState } from 'react'
import { imageCandidates, rememberWorking, categoryLook } from '../../utils/images'

// Shows the product photo. It tries every place from utils/images.js; if all fail it shows a coloured tile
// with the category icon, so the card still looks good. size = pixels, or fill = fill the parent box.
//
// fill mode: photos come with different white margins, so one product looks tiny and another huge.
// After the photo loads we find where the product really is and zoom it so all products fill their box equally
// (same idea as the store website). If the browser cannot read the pixels, the photo is simply shown normally.
export default function ProductImage({ src, alt = '', size = 44, fill = false, category }) {
  const list = useMemo(() => imageCandidates(src), [src])
  const [i, setI] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [cors, setCors] = useState(true)
  const [fit, setFit] = useState('')
  useEffect(() => { setI(0); setLoaded(false); setCors(true); setFit('') }, [src])

  const current = list[i]
  const [emoji, bg] = categoryLook(category)
  const style = fill ? {} : { width: size, height: size, borderRadius: Math.round(size / 4) }

  function measure(img) {
    try {
      const box = img.parentElement
      const W = box.clientWidth, H = box.clientHeight
      if (!W || !H || !img.naturalWidth) return
      const cw = 96, ch = Math.max(24, Math.round((96 * H) / W))
      const c = document.createElement('canvas'); c.width = cw; c.height = ch
      const ctx = c.getContext('2d', { willReadFrequently: true })
      const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight)
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
      const d = ctx.getImageData(0, 0, cw, ch).data
      let x0 = cw, y0 = ch, x1 = -1, y1 = -1
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const k = (y * cw + x) * 4
        if (d[k + 3] > 24 && Math.min(d[k], d[k + 1], d[k + 2]) < 238) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
      if (x1 < 0) return
      const bw = (x1 - x0 + 1) / cw, bh = (y1 - y0 + 1) / ch
      const cx = (x0 + x1 + 1) / 2 / cw, cy = (y0 + y1 + 1) / 2 / ch
      const pad = 0.06
      const k = Math.max(1, Math.min(3, (1 - 2 * pad) / bw, (1 - 2 * pad) / bh))
      if (k < 1.05) return setFit('')
      setFit(`translate(${(-(cx - 0.5) * k * 100).toFixed(2)}%, ${(-(cy - 0.5) * k * 100).toFixed(2)}%) scale(${k.toFixed(3)})`)
    } catch { /* pixels cannot be read (picture from another website): show it normally */ }
  }

  return (
    <div className={`thumb ${fill ? 'fill' : ''} ${current && !loaded ? 'loading' : ''}`} style={style}>
      {current ? (
        <img
          key={current.url + (cors ? '#c' : '')}
          src={current.url}
          alt={alt}
          loading="lazy"
          crossOrigin={cors && fill ? 'anonymous' : undefined}
          className={loaded ? 'ok' : ''}
          style={fit ? { '--fit': fit } : undefined}
          onLoad={(e) => { setLoaded(true); rememberWorking(current.kind); if (fill) measure(e.currentTarget) }}
          onError={() => { setLoaded(false); if (cors && fill) setCors(false); else { setCors(true); setI((n) => n + 1) } }}
        />
      ) : (
        <div className="thumb-fallback" style={{ background: bg }} title="No picture found for this product" role="img" aria-label={alt}>
          <span style={{ fontSize: fill ? 46 : Math.max(16, size * 0.5) }}>{emoji}</span>
        </div>
      )}
    </div>
  )
}