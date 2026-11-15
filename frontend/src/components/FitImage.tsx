import React, { useEffect, useState } from 'react';

interface FitImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** empty border kept around the product (0.08 = 8 % of the box) */
  pad?: number;
  /** never zoom in more than this */
  maxScale?: number;
}

/**
 * Product photos come with big white margins, so the product looks tiny in its box.
 * This image looks at its own pixels once it has loaded, finds where the product really is,
 * and zooms / re-centres it so the product fills the box (the white margin is simply cut off).
 * The zoom is stored in the CSS variable --fit, which index.css applies to `.db-gimg img`.
 * If the browser cannot read the pixels (a picture from another website without CORS), nothing changes.
 */
export const FitImage: React.FC<FitImageProps> = ({ pad = 0.08, maxScale = 3, style, onLoad, ...rest }) => {
  const [fit, setFit] = useState('');

  useEffect(() => setFit(''), [rest.src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    onLoad?.(e);
    try {
      const img = e.currentTarget;
      const box = img.parentElement;
      const W = box?.clientWidth || img.clientWidth;
      const H = box?.clientHeight || img.clientHeight;
      if (!W || !H || !img.naturalWidth) return;

      const cw = 96;
      const ch = Math.max(24, Math.round((96 * H) / W));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      // draw the picture the same way the browser shows it: "contain" inside the box
      const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      const data = ctx.getImageData(0, 0, cw, ch).data;

      let minX = cw, minY = ch, maxX = -1, maxY = -1;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          // a pixel belongs to the product when it is visible and not (almost) white
          if (data[i + 3] > 24 && Math.min(data[i], data[i + 1], data[i + 2]) < 238) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return;

      const bw = (maxX - minX + 1) / cw;
      const bh = (maxY - minY + 1) / ch;
      const cx = (minX + maxX + 1) / 2 / cw;
      const cy = (minY + maxY + 1) / 2 / ch;
      const k = Math.max(1, Math.min(maxScale, (1 - 2 * pad) / bw, (1 - 2 * pad) / bh));
      if (k < 1.08) return setFit('');
      setFit(`translate(${(-(cx - 0.5) * k * 100).toFixed(2)}%, ${(-(cy - 0.5) * k * 100).toFixed(2)}%) scale(${k.toFixed(3)})`);
    } catch {
      /* the pixels cannot be read: show the picture normally */
    }
  };

  return <img {...rest} onLoad={handleLoad} style={{ ...style, ['--fit' as any]: fit || undefined }} />;
};