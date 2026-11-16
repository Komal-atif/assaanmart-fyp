
import { useEffect, useMemo, useState } from 'react'
import {
  imageCandidates,
  rememberWorking,
  categoryLook,
} from '../../utils/images'

export default function ProductImage({
  src,
  alt = '',
  size = 44,
  fill = false,
  category,
}) {
  const list = useMemo(() => imageCandidates(src), [src])

  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setIndex(0)
    setLoaded(false)
  }, [src])

  const current = list[index]
  const [emoji, bg] = categoryLook(category)

  const containerStyle = {
    width: fill ? '100%' : size,
    height: fill ? '100%' : size,
    minWidth: 0,
    minHeight: 0,
    boxSizing: 'border-box',
    borderRadius: fill ? 0 : Math.round(size / 4),
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    position: 'relative',
    flexShrink: 0,
    padding: 0,
  }

  return (
    <div
      className={`thumb ${fill ? 'fill' : ''} ${
        current && !loaded ? 'loading' : ''
      }`}
      style={containerStyle}
    >
      {current ? (
        <img
          key={current.url}
          src={current.url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={loaded ? 'ok' : ''}
          onLoad={() => {
            setLoaded(true)
            rememberWorking(current.kind)
          }}
          onError={() => {
            setLoaded(false)
            setIndex((previous) => previous + 1)
          }}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            boxSizing: 'border-box',
            padding: 8,
            opacity: loaded ? 1 : 0,
          }}
        />
      ) : (
        <div
          className="thumb-fallback"
          style={{
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            background: bg,
            display: 'grid',
            placeItems: 'center',
          }}
          role="img"
          aria-label={alt || 'Product image unavailable'}
        >
          <span
            style={{
              fontSize: fill ? 46 : Math.max(16, size * 0.5),
            }}
          >
            {emoji}
          </span>
        </div>
      )}
    </div>
  )
}
