import { useEffect, useMemo, useRef, useState } from "react";
import { categories, products } from "./dashboardData";
import "./Dashboard.css";
import "./Dashboard.cards.css"; // new product card, sticky header, add-to-cart animation

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  cart: <><path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" /><circle cx="9.5" cy="19.5" r="1.2" /><circle cx="17" cy="19.5" r="1.2" /></>,
  heart: <path d="M12 21l-1.5-1.3C5.4 15.1 2 12.1 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.6-3.4 6.6-8.5 11.2L12 21z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  leaf: <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19c3-4 6-6 10-8" />,
  tap: <><rect x="6" y="3" width="12" height="18" rx="3" /><path d="M10 17h4M12 7v5M9.5 9.5L12 7l2.5 2.5" /></>,
  logout: <path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
};

function Icon({ name, size = 20, stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const money = (v) => `PKR ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const byId = (id) => products.find((p) => p.id === id);
const imgOf = (id) => byId(id)?.image; // image path straight from the dataset

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}

// Slides in from the side (left | right) or rises (up) when scrolled into view
function Reveal({ variant = "up", delay = 0, className = "", children }) {
  const [ref, seen] = useInView();
  return (
    <div ref={ref} className={`db-reveal ${variant} ${seen ? "in" : ""} ${className}`} style={{ "--d": delay }}>
      {children}
    </div>
  );
}

// Product photo with automatic emoji fallback if the image is missing
function Pic({ src, emoji, alt = "", className = "" }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img className={className} src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />
  ) : (
    <span className={`db-emoji ${className}`} role="img" aria-label={alt}>{emoji || "🛒"}</span>
  );
}

// 546.25 -> "546." big + small raised "25 Rs" (same style as the reference "17.29$")
function PriceTag({ value }) {
  const [whole, dec] = Number(value).toFixed(2).split(".");
  return (
    <span className="db-gprice">
      {Number(whole).toLocaleString("en-PK")}.<sup>{dec}&thinsp;Rs</sup>
    </span>
  );
}

// Invisible SVG that defines the two curved shapes used by the cards:
//  - card:  rounded top, gently arched (sagging) bottom edge
//  - bar:   banner whose top edge dips in and bottom edge bulges out
function CardShapes() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="gCardShape" clipPathUnits="objectBoundingBox">
          <path d="M0,0.03 Q0,0 0.045,0 L0.955,0 Q1,0 1,0.03 L1,0.945 Q1,0.97 0.92,0.975 Q0.5,1.015 0.08,0.975 Q0,0.97 0,0.945 Z" />
        </clipPath>
        <clipPath id="gBarShape" clipPathUnits="objectBoundingBox">
          <path d="M0.012,0.05 Q0.5,0.26 0.988,0.05 Q1,0.05 1,0.1 L1,0.84 Q1,0.88 0.988,0.88 Q0.5,1.14 0.012,0.88 Q0,0.88 0,0.84 L0,0.1 Q0,0.05 0.012,0.05 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function SectionHead({ title, onViewAll }) {
  return (
    <div className="db-sec-head">
      <Reveal variant="left"><h2>{title}</h2></Reveal>
      {onViewAll && (
        <Reveal variant="right">
          <button className="db-view-all" onClick={onViewAll}>View all</button>
        </Reveal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */

const SLIDES = [
  {
    eyebrow: "Fresh every morning",
    title: ["Fresh Vegetables,", "Picked For You"],
    text: "Garden-fresh vegetables and fruit at honest prices. Add to your cart in a tap.",
    cta: "Shop Vegetables",
    go: ["Fruits & Vegetables", "Vegetables"],
    label: "Fresh Vegetables",
    art: [
      { src: imgOf("256"), emoji: "🍅" },
      { src: imgOf("258"), emoji: "🥒" },
      { src: imgOf("251"), emoji: "🍎" },
    ],
  },
  {
    eyebrow: "Every morning essentials",
    title: ["Dairy & Eggs,", "Always Fresh"],
    text: "Milk, yogurt, cheese, butter and eggs from brands you trust.",
    cta: "Shop Dairy",
    go: ["Dairy", null],
    label: "Dairy & Eggs",
    art: [{ emoji: "🥛" }, { emoji: "🧀" }, { emoji: "🥚" }],
  },
  {
    eyebrow: "Snack time",
    title: ["Snacks For", "Every Mood"],
    text: "Biscuits, chips, chocolate and more, ready whenever the craving hits.",
    cta: "Shop Snacks",
    go: ["Snacks & Biscuits", null],
    label: "Snacks & Biscuits",
    art: [
      { src: imgOf("278"), emoji: "🍪" },
      { src: imgOf("299"), emoji: "🥔" },
      { emoji: "🍫" },
    ],
  },
];

// dataset ids: apple, tomato, banana, grapes
const POPULAR_IDS = ["251", "256", "249", "250"];
// dataset ids: Fruita Vitals mango, cucumber, Oreo, Lays Paprika
const DAILY_IDS = ["177", "258", "278", "299"];

const DEALS = [
  { tone: "fruit", title: "Fresh Fruit Picks", sub: "Seasonal and sweet", go: ["Fruits & Vegetables", "Fruits"], art: ["🍌", "🍇", "🍎", "🍊"] },
  { tone: "veg", title: "Garden Vegetables", sub: "Picked for your kitchen", go: ["Fruits & Vegetables", "Vegetables"], art: ["🍅", "🥒", "🥕", "🥦"] },
  { tone: "dairy", title: "Dairy Favourites", sub: "Milk, cheese and more", go: ["Dairy", null], art: ["🥛", "🧀", "🥚", "🧈"] },
];

const WHY = [
  ["truck", "Fast Delivery", "Groceries brought straight to your door."],
  ["leaf", "Fresh Quality", "Everyday essentials you can trust."],
  ["tap", "Easy Ordering", "Browse by category and add in one tap."],
  ["shield", "Confirm First", "Review your cart before you check out."],
];

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header({ name, search, setSearch, count, onCart, cartRef, onLogout, goHome, scrolled, hit }) {
  return (
    <>
      <div className="db-topbar">
        <div className="db-wrap db-topbar-in">
          <span>Welcome back, <b>{name}</b></span>
          <span>Voice &amp; manual shopping</span>
        </div>
      </div>

      {/* sticky: stays pinned to the top while the page scrolls (see Dashboard.cards.css) */}
      <header className={`db-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="db-wrap db-nav-in">
          <button className="db-brand" onClick={() => goHome()}>Assan<span>Mart</span></button>

          <nav className="db-links">
            <button onClick={() => goHome("db-home")}>Home</button>
            <button onClick={() => goHome("db-categories")}>Categories</button>
            <button onClick={() => goHome("db-popular")}>Popular</button>
            <button onClick={() => goHome("db-deals")}>Deals</button>
          </nav>

          <div className="db-nav-right">
            <label className="db-search">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                  <Icon name="close" size={14} stroke={2.2} />
                </button>
              )}
            </label>

            <button className="db-icon-btn" ref={cartRef} onClick={onCart} aria-label={`Open cart, ${count} items`}>
              <span key={hit} className={`db-cart-ico ${hit ? "hit" : ""}`}><Icon name="cart" size={20} /></span>
              {count > 0 && <b key={count} className="db-badge">{count}</b>}
            </button>

            <button className="db-logout" onClick={onLogout}>
              <Icon name="logout" size={15} /> <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Product card                                                        */
/* ------------------------------------------------------------------ */

function ProductCard({ p, index = 0, qty, onAdd, onChange, reveal }) {
  const [ref, seen] = useInView();
  const noPrice = p.price == null;
  const out = p.stock === 0;
  const disabled = noPrice || out;
  const base = reveal
    ? `db-reveal ${reveal} ${seen ? "in" : ""}`
    : "db-cardin";

  return (
    <article
      ref={reveal ? ref : null}
      className={`db-gcard ${base} ${out ? "is-out" : ""} ${qty > 0 ? "in-cart" : ""}`}
      style={{ "--i": index, "--d": reveal ? index * 90 : 0 }}
    >
      <div className="db-gimg">
        <Pic src={p.image} emoji={p.icon} alt={p.name} />
        {out && <span className="db-gtag">Out of stock</span>}
      </div>

      <h3 title={p.name}>{p.name}</h3>
      <span className="db-gsize">{p.size}</span>

      <div className="db-gprice-row">
        {noPrice ? <b className="db-gna">Price unavailable</b> : <PriceTag value={p.price} />}
      </div>

      <div className="db-gaction">
        {disabled ? (
          <button className="db-gadd" disabled>{out ? "Out of stock" : "Unavailable"}</button>
        ) : qty === 0 ? (
          <button className="db-gadd" onClick={(e) => onAdd(p, e.currentTarget)} aria-label={`Add ${p.name} to cart`}>
            <Icon name="plus" size={30} stroke={1.7} />
          </button>
        ) : (
          <div className="db-gqty">
            <button onClick={() => onChange(p.id, -1)} aria-label="Remove one"><Icon name="minus" size={18} stroke={2} /></button>
            <span key={qty}>{qty}</span>
            <button onClick={(e) => onAdd(p, e.currentTarget)} aria-label="Add one"><Icon name="plus" size={18} stroke={2} /></button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Home sections                                                       */
/* ------------------------------------------------------------------ */

function Hero({ openCategory }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [paused]);

  const s = SLIDES[i];

  return (
    <section className="db-hero" id="db-home" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="db-hero-shape" />
      <div className="db-wrap db-hero-in">
        <div className="db-hero-copy" key={`c${i}`}>
          <span className="db-eyebrow db-sl" style={{ "--n": 0 }}>{s.eyebrow}</span>
          <h1>
            {s.title.map((line, k) => (
              <span key={line} className="db-sl" style={{ "--n": k + 1 }}>{line}</span>
            ))}
          </h1>
          <p className="db-sl" style={{ "--n": 3 }}>{s.text}</p>
          <div className="db-sl" style={{ "--n": 4 }}>
            <button className="db-dark lg" onClick={() => openCategory(...s.go)}>
              {s.cta} <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>

        {/* art pops up from the bottom, like the bag in the reference video */}
        <div className="db-hero-art" key={`a${i}`}>
          <div className="db-crate">
            {s.art.map((a, k) => (
              <div key={k} className={`db-pop db-pop-${k + 1}`}>
                <Pic src={a.src} emoji={a.emoji} alt="" />
              </div>
            ))}
            <div className="db-crate-card">
              <small>{s.label}</small>
              <b>Hand-picked for you</b>
              <i><u /></i>
            </div>
          </div>
          <span className="db-heart-fab"><Icon name="heart" size={17} /></span>
        </div>
      </div>

      <div className="db-dots">
        {SLIDES.map((_, k) => (
          <button key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
        ))}
      </div>
    </section>
  );
}

function FeaturedCategories({ openCategory }) {
  return (
    <section className="db-sec white" id="db-categories">
      <div className="db-wrap">
        <SectionHead title="Featured Categories" onViewAll={() => document.getElementById("db-categories")?.scrollIntoView({ behavior: "smooth" })} />
        <div className="db-cat-row">
          {categories.map((c, k) => (
            <Reveal key={c.name} variant={k < 3 ? "left" : k === 3 ? "up" : "right"} delay={k * 70}>
              <button className="db-cat" onClick={() => openCategory(c.name)}>
                <span className={`db-cat-circle ${k % 2 ? "cream" : "mint"}`}>{c.icon}</span>
                <b>{c.name}</b>
                <small>{products.filter((p) => p.category === c.name).length} products</small>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Popular({ cartMap, onAdd, onChange, openCategory }) {
  const items = POPULAR_IDS.map(byId).filter(Boolean);
  return (
    <section className="db-sec tint" id="db-popular">
      <div className="db-wrap">
        <SectionHead title="Popular Products" onViewAll={() => openCategory("Fruits & Vegetables")} />
        <div className="db-grid-4">
          {items.map((p, k) => (
            <ProductCard key={p.id} p={p} index={k} qty={cartMap[p.id] || 0} onAdd={onAdd} onChange={onChange} reveal={k % 2 ? "right" : "left"} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Daily({ cartMap, onAdd, onChange, openCategory }) {
  const items = DAILY_IDS.map(byId).filter(Boolean);
  return (
    <section className="db-sec cream" id="db-daily">
      <div className="db-wrap">
        <SectionHead title="Daily Best Sells" onViewAll={() => openCategory("Snacks & Biscuits")} />
        <div className="db-daily">
          <Reveal variant="left" className="db-nature">
            <svg className="db-leaves" viewBox="0 0 300 320" aria-hidden="true">
              <g className="db-sway a"><path d="M40 300 C 20 200, 60 90, 170 30 C 190 130, 150 250, 40 300z" /></g>
              <g className="db-sway b"><path d="M150 310 C 140 240, 190 160, 270 130 C 280 210, 240 280, 150 310z" /></g>
              <g className="db-sway c"><path d="M10 160 C 20 100, 70 60, 120 50 C 110 110, 70 150, 10 160z" /></g>
            </svg>
            <div className="db-nature-copy">
              <h3>Bring nature into your home</h3>
              <p>Everyday freshness, picked and packed with care.</p>
              <button className="db-light" onClick={() => openCategory("Fruits & Vegetables")}>Shop now</button>
            </div>
          </Reveal>

          <div className="db-daily-grid">
            {items.map((p, k) => (
              <ProductCard key={p.id} p={p} index={k} qty={cartMap[p.id] || 0} onAdd={onAdd} onChange={onChange} reveal="right" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Deals({ openCategory }) {
  return (
    <section className="db-sec white" id="db-deals">
      <div className="db-wrap">
        <div className="db-sec-head center">
          <Reveal variant="up"><h2>Deals Of The Day</h2></Reveal>
        </div>
        <div className="db-deals">
          {DEALS.map((d, k) => (
            <Reveal key={d.title} variant={k === 0 ? "left" : k === 1 ? "up" : "right"} delay={k * 100} className={`db-deal ${d.tone}`}>
              <div className="db-deal-art">
                {d.art.map((e, j) => <span key={j} style={{ "--j": j }}>{e}</span>)}
              </div>
              <div className="db-deal-info">
                <h3>{d.title}</h3>
                <small>{d.sub}</small>
                <button className="db-dark sm" onClick={() => openCategory(...d.go)}>Shop now</button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// dark arch cards rising from below, line icons that draw themselves
function Why() {
  return (
    <section className="db-why">
      <div className="db-wrap">
        <Reveal variant="up" className="db-why-head">
          <h2>We always provide the best in town</h2>
          <p>From the first tap to your front door, we keep shopping simple.</p>
        </Reveal>
        <div className="db-arches">
          {WHY.map(([icon, t, d], k) => (
            <Reveal key={t} variant="rise" delay={k * 140} className="db-arch">
              <span className="db-arch-icon"><Icon name={icon} size={34} stroke={1.5} /></span>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ openCategory }) {
  return (
    <footer className="db-footer">
      <div className="db-wrap db-footer-in">
        <div>
          <div className="db-brand static">Assan<span>Mart</span></div>
          <p>Making grocery shopping simple, smart and convenient.</p>
        </div>
        <div className="db-footer-links">
          {categories.slice(0, 4).map((c) => (
            <button key={c.name} onClick={() => openCategory(c.name)}>{c.name}</button>
          ))}
        </div>
      </div>
      <div className="db-wrap db-footer-bottom"><small>© 2026 AssanMart. All rights reserved.</small></div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Category / search results                                           */
/* ------------------------------------------------------------------ */

function Results({
  category, sub, setSub, search, setSearch, sort, setSort, list, countsBySub,
  cartMap, onAdd, onChange, goHome, clearCategory,
}) {
  const cat = categories.find((c) => c.name === category);
  const title = sub || category || "Search results";
  const subtitle = category
    ? sub ? `Products in ${sub}` : `Explore everything in ${category}`
    : `Showing matches for “${search}”`;

  return (
    <>
      <section className="db-banner">
        <div className="db-banner-shape" />
        <div className="db-wrap db-banner-in">
          <div className="db-banner-copy">
            <nav className="db-crumbs db-sl" style={{ "--n": 0 }}>
              <button onClick={() => goHome()}>Home</button>
              {category && (<><i>/</i><button onClick={clearCategory}>Categories</button></>)}
              {category && (<><i>/</i><button onClick={() => setSub(null)} className={!sub ? "on" : ""}>{category}</button></>)}
              {sub && (<><i>/</i><span>{sub}</span></>)}
            </nav>
            <h1 className="db-sl" style={{ "--n": 1 }}>{title}</h1>
            <p className="db-sl" style={{ "--n": 2 }}>{subtitle}</p>
          </div>
          {cat && <div className="db-banner-art"><span key={category}>{cat.icon}</span></div>}
        </div>
      </section>

      {/* skin-coloured section behind the white product cards */}
      <section className="db-sec skin db-results">
        <div className="db-wrap">
          {cat && (
            <div className="db-chips">
              <button className={!sub ? "on" : ""} onClick={() => setSub(null)}>
                All <em>{countsBySub.all}</em>
              </button>
              {cat.subcategories.map((s) => (
                <button key={s} className={sub === s ? "on" : ""} onClick={() => setSub(s)}>
                  {s} <em>{countsBySub[s] || 0}</em>
                </button>
              ))}
            </div>
          )}

          <div className="db-toolbar">
            <p><b>{list.length}</b> product{list.length === 1 ? "" : "s"} found</p>
            <label className="db-sort">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="default">Featured</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </label>
          </div>

          {list.length === 0 ? (
            <div className="db-empty">
              <span>🔍</span>
              <h3>No products found</h3>
              <p>Try a different search or category.</p>
              <button className="db-dark" onClick={() => { setSearch(""); setSub(null); }}>Clear filters</button>
            </div>
          ) : (
            // key remounts the grid so cards re-enter with a stagger on every change
            <div className="db-grid-4" key={`${category}-${sub}-${sort}-${search}`}>
              {list.map((p, k) => (
                <ProductCard key={p.id} p={p} index={Math.min(k, 12)} qty={cartMap[p.id] || 0} onAdd={onAdd} onChange={onChange} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cart drawer                                                         */
/* ------------------------------------------------------------------ */

function CartDrawer({ cart, count, total, onClose, onChange, onRemove, onCheckout }) {
  return (
    <div className="db-overlay" onClick={onClose}>
      <aside className="db-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your cart">
        <div className="db-drawer-head">
          <h2>Your Cart <span>({count})</span></h2>
          <button onClick={onClose} aria-label="Close cart"><Icon name="close" size={18} /></button>
        </div>

        {cart.length === 0 ? (
          <div className="db-empty-cart">
            <span>🛒</span>
            <h3>Your cart is empty</h3>
            <p>Add some products to get started.</p>
            <button className="db-dark" onClick={onClose}>Continue shopping</button>
          </div>
        ) : (
          <>
            <div className="db-drawer-items">
              {cart.map((item, k) => (
                <div className="db-citem" key={item.id} style={{ "--i": k }}>
                  <div className="db-cthumb"><Pic src={item.image} emoji={item.icon} alt={item.name} /></div>
                  <div className="db-cinfo">
                    <strong>{item.name}</strong>
                    <small>{item.size} · {money(item.price)}</small>
                    <div className="db-cqty">
                      <div className="db-stepper sm">
                        <button onClick={() => onChange(item.id, -1)} aria-label="Remove one"><Icon name="minus" size={12} stroke={2.6} /></button>
                        <span key={item.quantity}>{item.quantity}</span>
                        <button onClick={() => onChange(item.id, 1)} aria-label="Add one"><Icon name="plus" size={12} stroke={2.6} /></button>
                      </div>
                      <button className="db-remove" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                  <b className="db-cline">{money(item.price * item.quantity)}</b>
                </div>
              ))}
            </div>

            <div className="db-drawer-foot">
              <div className="db-total"><span>Subtotal</span><strong>{money(total)}</strong></div>
              <button className="db-dark lg block" onClick={onCheckout}>Proceed to Checkout</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Dashboard({ user, onLogout }) {
  const [category, setCategory] = useState(null);
  const [sub, setSub] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [message, setMessage] = useState("");
  const [flies, setFlies] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [hit, setHit] = useState(0); // bumps the header cart icon when a flying product lands

  const rootRef = useRef(null);
  const cartRef = useRef(null);
  const toastTimer = useRef(null);

  const name =
    user?.name || user?.fullName || user?.full_name || user?.username ||
    (user?.email ? user.email.split("@")[0] : "there");

  /* scroll: header shadow + parallax variable for the hero */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      rootRef.current?.style.setProperty("--sy", Math.min(window.scrollY, 900));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Esc closes the cart; lock page scroll while it is open */
  useEffect(() => {
    if (!showCart) return;
    const onKey = (e) => e.key === "Escape" && setShowCart(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [showCart]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const toast = (text) => {
    setMessage(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 2200);
  };

  /* navigation */
  const openCategory = (cat, subcategory = null) => {
    setCategory(cat);
    setSub(subcategory);
    setSearch("");
    setSort("default");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = (sectionId) => {
    setCategory(null);
    setSub(null);
    setSearch("");
    setTimeout(() => {
      if (sectionId) document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 60);
  };

  /* cart */
  const cartMap = useMemo(() => Object.fromEntries(cart.map((i) => [i.id, i.quantity])), [cart]);
  const count = cart.reduce((t, i) => t + i.quantity, 0);
  const total = cart.reduce((t, i) => t + i.price * i.quantity, 0);

  // The product photo lifts off the card and flies into the header cart icon,
  // then the cart icon bumps (same idea as the reference video).
  const fly = (btn, product) => {
    const to = cartRef.current?.getBoundingClientRect();
    const pic = btn?.closest(".db-gcard")?.querySelector(".db-gimg img, .db-gimg .db-emoji");
    const from = (pic || btn)?.getBoundingClientRect();
    if (!from || !to) return;
    const size = Math.max(40, Math.min(from.width, from.height, 96));
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    const key = Date.now() + Math.random();
    setFlies((f) => [
      ...f,
      {
        key, size, image: product.image, icon: product.icon,
        x: cx - size / 2, y: cy - size / 2,
        dx: to.left + to.width / 2 - cx, dy: to.top + to.height / 2 - cy,
      },
    ]);
    setTimeout(() => setHit((h) => h + 1), 640);
    setTimeout(() => setFlies((f) => f.filter((v) => v.key !== key)), 800);
  };

  const addToCart = (product, el) => {
    if (product.stock === 0) {
      toast("This product is out of stock.");
      return;
    }
    if (product.price == null) {
      toast("Price is not available for this product yet.");
      return;
    }
    setCart((prev) =>
      prev.some((i) => i.id === product.id)
        ? prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { ...product, quantity: 1 }]
    );
    if (el) fly(el, product);
    toast(`${product.name} added to cart.`);
  };

  const changeQty = (id, d) =>
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + d } : i)).filter((i) => i.quantity > 0));

  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.id !== id));

  /* product list for category / search views */
  const term = search.trim().toLowerCase();

  const countsBySub = useMemo(() => {
    const c = { all: 0 };
    products.forEach((p) => {
      if (p.category !== category) return;
      c.all += 1;
      c[p.subcategory] = (c[p.subcategory] || 0) + 1;
    });
    return c;
  }, [category]);

  const list = useMemo(() => {
    // p.search holds name + brand + Urdu brand + aliases, so English and Urdu search both work
    const out = products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!sub || p.subcategory === sub) &&
        (!term || (p.search || p.name.toLowerCase()).includes(term))
    );
    if (sort === "low") out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sort === "high") out.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    else if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [category, sub, term, sort]);

  const showResults = Boolean(category || term);

  return (
    <div className="dashboard-page" ref={rootRef}>
      <CardShapes />
      <Header
        name={name}
        search={search}
        setSearch={(v) => {
          setSearch(v);
          // searching looks through the whole store, not just the open category
          if (v) { setCategory(null); setSub(null); window.scrollTo({ top: 0 }); }
        }}
        count={count}
        onCart={() => setShowCart(true)}
        cartRef={cartRef}
        onLogout={onLogout}
        goHome={goHome}
        scrolled={scrolled}
        hit={hit}
      />

      <main>
        {showResults ? (
          <Results
            category={category}
            sub={sub}
            setSub={setSub}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            list={list}
            countsBySub={countsBySub}
            cartMap={cartMap}
            onAdd={addToCart}
            onChange={changeQty}
            goHome={goHome}
            clearCategory={() => { setCategory(null); setSub(null); }}
          />
        ) : (
          <>
            <Hero openCategory={openCategory} />
            <FeaturedCategories openCategory={openCategory} />
            <Popular cartMap={cartMap} onAdd={addToCart} onChange={changeQty} openCategory={openCategory} />
            <Daily cartMap={cartMap} onAdd={addToCart} onChange={changeQty} openCategory={openCategory} />
            <Deals openCategory={openCategory} />
            <Why />
          </>
        )}
      </main>

      <Footer openCategory={openCategory} />

      {flies.map((f) => (
        <span
          key={f.key}
          className="db-gfly"
          style={{ left: f.x, top: f.y, width: f.size, height: f.size, "--dx": `${f.dx}px`, "--dy": `${f.dy}px` }}
        >
          <i><Pic src={f.image} emoji={f.icon} alt="" /></i>
        </span>
      ))}

      {message && <div className="db-toast" key={message}><Icon name="check" size={16} stroke={2.4} /> {message}</div>}

      {showCart && (
        <CartDrawer
          cart={cart}
          count={count}
          total={total}
          onClose={() => setShowCart(false)}
          onChange={changeQty}
          onRemove={removeItem}
          onCheckout={() => toast("Checkout will be connected in the next step.")}
        />
      )}
    </div>
  );
}

export default Dashboard;