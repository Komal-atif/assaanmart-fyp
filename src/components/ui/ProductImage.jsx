import { useEffect, useMemo, useState } from 'react'
import { imageCandidates, rememberWorking, categoryLook } from '../../utils/images'

// Shows the product photo. It tries every place from utils/images.js; if all fail it shows a coloured tile
// with the category icon, so the card still looks good. size = pixels, or fill = fill the parent box.
export default function ProductImage({ src, alt = '', size = 44, fill = false, category }) {
  const list = useMemo(() => imageCandidates(src), [src])
  const [i, setI] = useState(0)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setI(0); setLoaded(false) }, [src])

  const current = list[i]
  const [emoji, bg] = categoryLook(category)
  const style = fill ? {} : { width: size, height: size, borderRadius: Math.round(size / 4) }

  return (
    <div className={`thumb ${fill ? 'fill' : ''} ${current && !loaded ? 'loading' : ''}`} style={style}>
      {current ? (
        <img
          key={current.url}
          src={current.url}
          alt={alt}
          loading="lazy"
          className={loaded ? 'ok' : ''}
          onLoad={() => { setLoaded(true); rememberWorking(current.kind) }}
          onError={() => { setLoaded(false); setI((n) => n + 1) }}
        />
      ) : (
        <div className="thumb-fallback" style={{ background: bg }} title="No picture found for this product" role="img" aria-label={alt}>
          <span style={{ fontSize: fill ? 46 : Math.max(16, size * 0.5) }}>{emoji}</span>
        </div>
      )}
    </div>
  )
}
