import React, { useState, useEffect } from "react";

/**
 * Pop-up for the current question. `options` comes from the backend (/converse, /select, /action).
 *   stage "brand"    all brands
 *   stage "type"     product types
 *   stage "variant"  every product of the brand (picture, size, price)
 *   stage "quantity" chosen product + stepper
 * Cards with `spoken: true` are the ones the agent is reading out right now.
 * Pictures: `image_url` is shown when present, otherwise an empty picture box.
 */

const STEPS = ["Brand", "Product", "Quantity"];
const STEP_OF = { brand: 0, type: 1, variant: 1, quantity: 2 };

function PicPlaceholder() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}

function Bars({ on }) {
  return (
    <span className={`bars ${on ? "on" : ""}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

function Pic({ url, alt }) {
  return (
    <div className="pm-pic">
      {url ? <img src={url} alt={alt} loading="lazy" /> : <PicPlaceholder />}
    </div>
  );
}

const STATUS = {
  listening: "Listening — say a name, “next” or “cheapest”",
  speaking: "Reading the options…",
  thinking: "Thinking…",
  off: "Mic is paused — you can still tap",
};

export default function ProductModal({ options, phase, onSelect }) {
  const [qty, setQty] = useState(1);
  const [dismissed, setDismissed] = useState(false);

  // every new question re-opens the pop-up
  useEffect(() => {
    setDismissed(false);
    setQty(1);
  }, [options]);

  useEffect(() => {
    if (!options || dismissed) return undefined;
    const onKey = (e) => e.key === "Escape" && setDismissed(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, dismissed]);

  if (!options || dismissed) return null;

  const { stage, title, items = [], product, next_value: nextValue, total, paged, up_next: upNext = [] } = options;
  const step = STEP_OF[stage] ?? 0;
  const close = () => setDismissed(true);
  const live = phase === "listening" || phase === "speaking";

  return (
    <div className="pm-overlay" onClick={close}>
      <div className="pm-sheet" role="dialog" aria-modal="true" aria-labelledby="pm-title" onClick={(e) => e.stopPropagation()}>
        <header className="pm-head">
          <div>
            <ol className="pm-steps" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className={i === step ? "now" : i < step ? "done" : ""}>
                  <span>{i < step ? "✓" : i + 1}</span>{s}
                </li>
              ))}
            </ol>
            <h2 id="pm-title">{title}</h2>
            <p className="pm-sub">
              {stage === "brand" && `${total} brands — tap one or say its name`}
              {stage === "type" && "What do you need?"}
              {stage === "variant" && `${total} products — tap one or say its name`}
              {stage === "quantity" && "How many would you like?"}
            </p>
            {upNext.length > 0 && <p className="pm-then">Then: {upNext.join(", ")}</p>}
          </div>
          <button type="button" className="pm-close" onClick={close} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className={`pm-body ${stage === "variant" ? "grid-products" : stage === "quantity" ? "single" : "grid-tiles"}`}>
          {(stage === "brand" || stage === "type") &&
            items.map((b) => (
              <button type="button" key={b.value} className={`pm-tile ${b.spoken ? "spoken" : ""}`} onClick={() => onSelect(b.value)}>
                <span className="tile-initial" aria-hidden="true">{String(b.label).slice(0, 1).toUpperCase()}</span>
                <span className="tile-label">{b.label}</span>
                {b.spoken && paged && <Bars on={phase === "speaking"} />}
              </button>
            ))}

          {stage === "variant" &&
            items.map((v) => (
              <button type="button" key={v.id} className={`pm-product ${v.spoken ? "spoken" : ""}`} onClick={() => onSelect(v.value)} title={v.name}>
                <Pic url={v.image_url} alt={v.name} />
                {v.spoken && <span className="reading"><Bars on={phase === "speaking"} />Reading</span>}
                <span className="p-name">{v.label}</span>
                <span className="p-row">
                  <span className="p-size">{v.size}</span>
                  <span className="p-price">{v.price_text}</span>
                </span>
              </button>
            ))}

          {stage === "quantity" && product && (
            <div className="pm-qty">
              <Pic url={product.image_url} alt={product.name} />
              <div className="qty-info">
                <h3>{product.name}</h3>
                <p className="p-size">{product.size}</p>
                <p className="p-price">{product.price_text} each</p>
                <div className="stepper big" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="One less">−</button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" onClick={() => setQty(Math.min(100, qty + 1))} aria-label="One more">+</button>
                </div>
                <p className="qty-total">Total <strong>{Math.round(product.price * qty)} rupees</strong></p>
              </div>
            </div>
          )}
        </div>

        <footer className="pm-foot">
          <div className="pm-status">
            <Bars on={live} />
            <span>{STATUS[phase] || STATUS.off}</span>
          </div>
          {stage === "quantity" ? (
            <button type="button" className="btn primary" onClick={() => onSelect("", qty)}>Add to basket</button>
          ) : (
            nextValue && <button type="button" className="btn soft" onClick={() => onSelect(nextValue)}>Next 3 →</button>
          )}
        </footer>
      </div>
    </div>
  );
}