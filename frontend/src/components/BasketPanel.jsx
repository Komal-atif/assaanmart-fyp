import React from "react";

const rupees = (n) => `${Math.round(n)} rupees`;

const PENDING_TEXT = {
  brand: "Choosing a brand…",
  type: "Choosing a type…",
  variant: "Choosing a product…",
  quantity: "Choosing how many…",
  waiting: "Up next",
};

function BagIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7h12l-1 13H7L6 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" />
    </svg>
  );
}

export default function BasketPanel({ cart, busy, message, onDismissMessage, onQty, onConfirm, onDecline }) {
  const empty = cart.items.length === 0;
  const pending = cart.pending || [];

  return (
    <aside className="basket" aria-label="Basket">
      <header className="basket-head">
        <h2>Your basket</h2>
        <span className="count-badge">{cart.count}</span>
      </header>

      {message && (
        <div className="order-note" role="status">
          <p dir="auto">{message}</p>
          <button type="button" className="link-btn" onClick={onDismissMessage}>Dismiss</button>
        </div>
      )}

      <div className="basket-list">
        {empty && pending.length === 0 && (
          <div className="basket-empty">
            <BagIcon />
            <p>Your basket is empty</p>
            <small>Say what you need and it will appear here.</small>
          </div>
        )}

        {cart.items.map((item) => (
          <article className="line" key={item.id}>
            <div className="thumb">
              {item.image_url ? <img src={item.image_url} alt="" /> : <BagIcon />}
            </div>

            <div className="line-main">
              <h3 className="line-name" title={item.name}>{item.name}</h3>
              <p className="line-meta">{item.unit} · {rupees(item.price_per_unit)} each</p>

              <div className="stepper" role="group" aria-label={`Quantity of ${item.name}`}>
                <button type="button" onClick={() => onQty(item.id, item.quantity - 1)} aria-label="One less">−</button>
                <span aria-live="polite">{item.quantity}</span>
                <button type="button" onClick={() => onQty(item.id, item.quantity + 1)} aria-label="One more">+</button>
              </div>
            </div>

            <div className="line-side">
              <strong className="line-total">{rupees(item.line_total)}</strong>
              <button type="button" className="icon-btn" onClick={() => onQty(item.id, 0)} aria-label={`Remove ${item.name}`}>
                <TrashIcon />
              </button>
            </div>
          </article>
        ))}
      </div>

      {pending.length > 0 && (
        <section className="pending" aria-label="Items in progress">
          <h3>In progress</h3>
          {pending.map((p, i) => (
            <div className={`pending-row ${p.status}`} key={`${p.label}-${i}`}>
              <span className="pdot" aria-hidden="true" />
              <strong>{p.label}</strong>
              <small>{PENDING_TEXT[p.status] || ""}</small>
            </div>
          ))}
        </section>
      )}

      <footer className="basket-foot">
        <div className="total-row">
          <span>Total</span>
          <strong>{rupees(cart.total)}</strong>
        </div>
        <p className="cod">Cash on delivery</p>

        {cart.awaiting_confirmation ? (
          <div className="confirm-box">
            <p>Place this order for <strong>{rupees(cart.total)}</strong>?</p>
            <div className="confirm-actions">
              <button type="button" className="btn primary" onClick={onConfirm} disabled={busy}>
                {busy ? "Placing…" : "Yes, place order"}
              </button>
              <button type="button" className="btn ghost" onClick={onDecline} disabled={busy}>Not yet</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn primary wide" onClick={onConfirm} disabled={empty || busy}>
            Review & confirm
          </button>
        )}
      </footer>
    </aside>
  );
}