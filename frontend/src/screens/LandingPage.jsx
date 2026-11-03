import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";

/* ------------------------------------------------------------------ */
/* Icons (inline SVG – no icon library needed)                         */
/* ------------------------------------------------------------------ */

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  heart: <path d="M12 20s-7-4.4-9-9.2C1.8 7.6 3.6 4.5 6.8 4.5c2 0 3.4 1 5.2 3 1.8-2 3.2-3 5.2-3 3.2 0 5 3.1 3.8 6.300C19 15.6 12 20 12 20z" />,
  cart: <><path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.200h8.200a1.5 1.5 0 0 0 1.5-1.100L20.5 8H6.2" /><circle cx="9.5" cy="19.5" r="1.2" /><circle cx="17" cy="19.5" r="1.2" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  check: <path d="M5 12.500l4.5 4.500L19 7.5" />,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  leaf: <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19c3-4 6-6 10-8" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chev: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
};

function Icon({ name, size = 20, stroke = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks / helpers                                                     */
/* ------------------------------------------------------------------ */

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

// Slides in from the side when scrolled into view.
// variant: "left" | "right" | "up"
function Reveal({ variant = "up", delay = 0, className = "", children, ...rest }) {
  const [ref, seen] = useInView();
  return (
    <div
      ref={ref}
      className={`reveal ${variant} ${seen ? "in" : ""} ${className}`}
      style={{ "--d": delay }}
      {...rest}
    >
      {children}
    </div>
  );
}

function SectionHead({ title, action, children }) {
  return (
    <div className="sec-head">
      <Reveal variant="left"><h2>{title}</h2></Reveal>
      <Reveal variant="right" className="sec-head-right">
        {children}
        {action && <a href={action.href} className="view-all">{action.label}</a>}
      </Reveal>
    </div>
  );
}

// product image: uses a real photo when `img` is set, otherwise an emoji
function Thumb({ p, className = "" }) {
  return p.img ? (
    <img src={p.img} alt={p.name} className={className} loading="lazy" />
  ) : (
    <span className={`emoji ${className}`} role="img" aria-label={p.name}>{p.emoji}</span>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const NAV = [
  ["home", "Home"],
  ["categories", "Categories"],
  ["products", "Products"],
  ["how-it-works", "How It Works"],
  ["deals", "Deals"],
  ["faq", "FAQ"],
];

const SLIDES = [
  {
    eyebrow: "Voice-first grocery shopping",
    title: ["Groceries Made Easier", "With Your Voice"],
    text: "Speak your order or browse manually. AssanMart turns your list into a ready-to-confirm cart in seconds.",
    cta: "Start Shopping",
    go: "signup",
  },
  {
    eyebrow: "Fresh every morning",
    title: ["Fresh Vegetables", "Big Discount"],
    text: "Hand-picked produce and daily essentials at honest prices, delivered straight to your door.",
    cta: "Shop Now",
    go: "signup",
  },
  {
    eyebrow: "Simple checkout",
    title: ["Review, Confirm,", "and You’re Done"],
    text: "Check your items and quantities before ordering. Nothing is placed until you say so.",
    cta: "See How It Works",
    href: "#how-it-works",
  },
];

const BENEFITS = [
  ["truck", "Fast Delivery", "Groceries at your door"],
  ["shield", "Secure Ordering", "Confirm before you pay"],
  ["leaf", "Fresh Guarantee", "Quality you can trust"],
  ["headset", "Friendly Support", "Here when you need us"],
];

const CATEGORIES = [
  ["🥦", "Vegetables"],
  ["🍎", "Fruits"],
  ["🥛", "Dairy & Milk"],
  ["🍞", "Bakery"],
  ["🥩", "Meat & Fish"],
  ["🧃", "Beverages"],
  ["🍿", "Snacks"],
];

// add `img: "/images/tomatoes.jpg"` to any product to show a real photo
const POPULAR = [
  { id: "p1", emoji: "🍅", name: "Fresh Tomatoes (1 kg)", price: 180, old: 220 },
  { id: "p2", emoji: "🥑", name: "Organic Avocado (2 pcs)", price: 340, old: 400 },
  { id: "p3", emoji: "🥒", name: "Garden Cucumber (500 g)", price: 100, old: 130 },
  { id: "p4", emoji: "🥕", name: "Farm Carrots (1 kg)", price: 120, old: 150 },
];

const DAILY = [
  { id: "d1", emoji: "🥛", name: "Fresh Milk (1 L)", price: 230, old: 260 },
  { id: "d2", emoji: "🫑", name: "Mixed Peppers (500 g)", price: 210, old: 250 },
  { id: "d3", emoji: "🥗", name: "Salad Mix (250 g)", price: 160, old: 190 },
  { id: "d4", emoji: "🍎", name: "Red Apples (1 kg)", price: 380, old: 430 },
];

const DEALS = [
  { tone: "citrus", off: "25% OFF", title: "Fresh Fruit Basket", sub: "Seasonal picks", art: ["🍊", "🍌", "🍋", "🍇"] },
  { tone: "garden", off: "15% OFF", title: "Garden Vegetables", sub: "Picked this morning", art: ["🥦", "🍅", "🌽", "🥕"] },
  { tone: "leafy", off: "20% OFF", title: "Leafy Greens", sub: "Crisp and clean", art: ["🥬", "🥒", "🫛", "🧅"] },
];

const STEPS = [
  ["mic", "Speak or browse", "Say what you need, or add products yourself from any category."],
  ["cart", "Review your cart", "Check items and quantities. Correct anything by voice or with a tap."],
  ["check", "Confirm your order", "Confirm when you’re happy and AssanMart handles the rest."],
];

const VOICE = [
  { text: "Two kilos of tomatoes and a litre of milk", items: [["Tomatoes", "2 kg"], ["Milk", "1 L"]] },
  { text: "Add a dozen eggs and a fresh loaf of bread", items: [["Eggs", "1 dozen"], ["Bread", "1 loaf"]] },
  { text: "One kilo of apples and half a kilo of grapes", items: [["Apples", "1 kg"], ["Grapes", "500 g"]] },
];

const FAQS = [
  ["How does voice ordering work?", "Tap the microphone and say what you need, for example “two kilos of tomatoes and a litre of milk”. AssanMart adds the items to your cart so you can review them."],
  ["Can I still shop manually?", "Yes. Browse categories, add products yourself and change quantities any time before you confirm."],
  ["What if it hears me wrong?", "Nothing is placed until you confirm. You can correct items by voice or by editing your cart."],
  ["How do I track my orders?", "Every order is saved in your account so you can check its status and reorder in a tap."],
];

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function TopBar() {
  return (
    <div className="topbar">
      <div className="wrap topbar-in">
        <span><Icon name="leaf" size={14} /> Fresh vegetables, delivered daily</span>
        <span className="topbar-right">
          <span><Icon name="truck" size={14} /> Free delivery on orders over Rs 2,000</span>
          <span><Icon name="headset" size={14} /> Support 24/7</span>
        </span>
      </div>
    </div>
  );
}

function Navbar({ onNavigate, active, scrolled, count }) {
  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap nav-in">
        <a className="brand" href="#home">Assan<span>Mart</span></a>

        <nav className="nav-links">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>{label}</a>
          ))}
        </nav>

        <div className="nav-right">
          <button className="search-pill" onClick={() => onNavigate("signup")}>
            <Icon name="search" size={16} /> <span>Search</span>
          </button>
          <button className="icon-btn" aria-label="Wishlist"><Icon name="heart" size={19} /></button>
          <button className="icon-btn cart-btn" aria-label="Cart" onClick={() => onNavigate("signup")}>
            <Icon name="cart" size={19} />
            {count > 0 && <b key={count} className="badge">{count}</b>}
          </button>
          <button className="ghost-btn" onClick={() => onNavigate("login")}>Login</button>
          <button className="dark-btn" onClick={() => onNavigate("signup")}>Sign Up</button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero – slider, text enters from the left, art from the right        */
/* ------------------------------------------------------------------ */

function Hero({ onNavigate }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [paused]);

  const s = SLIDES[i];

  return (
    <section
      className="hero"
      id="home"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-shape" />
      <div className="wrap hero-in">
        {/* key forces the entrance animation to replay on every slide */}
        <div className="hero-copy" key={i}>
          <span className="hero-eyebrow slide-l" style={{ "--n": 0 }}>{s.eyebrow}</span>
          <h1>
            {s.title.map((line, k) => (
              <span key={line} className="slide-l" style={{ "--n": k + 1 }}>{line}</span>
            ))}
          </h1>
          <p className="slide-l" style={{ "--n": 3 }}>{s.text}</p>
          <div className="slide-l" style={{ "--n": 4 }}>
            {s.href ? (
              <a href={s.href} className="dark-btn lg">{s.cta} <Icon name="arrow" size={16} /></a>
            ) : (
              <button className="dark-btn lg" onClick={() => onNavigate(s.go)}>
                {s.cta} <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="hero-art slide-r">
          <div className="art-card">
            <img className="mascot" src="/mascot.png" alt="AssanMart grocery assistant" />
          </div>

          <div className="float-card fc-top">
            <span className="fc-icon"><Icon name="mic" size={18} /></span>
            <div>
              <b>Just say it</b>
              <small>“Two kilos of tomatoes”</small>
            </div>
          </div>

          <div className="float-card fc-bottom">
            <small>Fresh Vegetables</small>
            <b>Picked this morning</b>
            <i className="fc-bar"><u /></i>
          </div>

          <button className="heart-fab" aria-label="Save"><Icon name="heart" size={18} /></button>
        </div>
      </div>

      <div className="dots">
        {SLIDES.map((_, k) => (
          <button key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
        ))}
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="benefits">
      <div className="wrap benefits-in">
        {BENEFITS.map(([icon, t, d], k) => (
          <Reveal key={t} variant={k < 2 ? "left" : "right"} delay={(k % 2) * 120} className="benefit">
            <span className="benefit-icon"><Icon name={icon} size={22} /></span>
            <div><b>{t}</b><small>{d}</small></div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

function Categories() {
  return (
    <section className="sec white" id="categories">
      <div className="wrap">
        <SectionHead title="Featured Categories" action={{ label: "View all", href: "#categories" }} />
        <div className="cat-row">
          {CATEGORIES.map(([emoji, name], k) => (
            <Reveal key={name} variant={k < 3 ? "left" : k === 3 ? "up" : "right"} delay={k * 70} className="cat">
              <span className={`cat-circle ${k % 2 ? "cream" : "mint"}`}>{emoji}</span>
              <b>{name}</b>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function AddControl({ id, name, qty, setQty }) {
  const n = qty[id] || 0;
  return n === 0 ? (
    <button className="add-btn" onClick={() => setQty(id, 1)} aria-label={`Add ${name} to cart`}>
      Add to cart
    </button>
  ) : (
    <div className="stepper">
      <button onClick={() => setQty(id, -1)} aria-label="Remove one"><Icon name="minus" size={14} stroke={2.4} /></button>
      <span key={n}>{n}</span>
      <button onClick={() => setQty(id, 1)} aria-label="Add one"><Icon name="plus" size={14} stroke={2.4} /></button>
    </div>
  );
}

function Popular({ qty, setQty }) {
  return (
    <section className="sec tint" id="products">
      <div className="wrap">
        <SectionHead title="Popular Products" action={{ label: "View all", href: "#products" }} />
        <div className="grid-4">
          {POPULAR.map((p, k) => (
            <Reveal key={p.id} variant={k % 2 ? "right" : "left"} delay={k * 90} className="pcard">
              <div className="pcard-img">
                <Thumb p={p} />
                <button className="mini-cart" aria-label="Quick add" onClick={() => setQty(p.id, 1)}>
                  <Icon name="cart" size={15} />
                </button>
              </div>
              <div className="pcard-body">
                <h4>{p.name}</h4>
                <s>Rs {p.old}</s>
                <div className="pcard-row">
                  <b>Rs {p.price}</b>
                  <AddControl id={p.id} name={p.name} qty={qty} setQty={setQty} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works + live voice demo                                      */
/* ------------------------------------------------------------------ */

function VoiceDemo() {
  const [idx, setIdx] = useState(0);
  const [n, setN] = useState(0);
  const phrase = VOICE[idx];
  const done = n >= phrase.text.length;

  useEffect(() => {
    const t = setTimeout(
      () => {
        if (!done) setN(n + 1);
        else { setIdx((idx + 1) % VOICE.length); setN(0); }
      },
      done ? 3200 : 48
    );
    return () => clearTimeout(t);
  }, [n, done, idx]);

  return (
    <div className="voice-card">
      <div className="voice-top">
        <span className={`mic-orb ${done ? "" : "live"}`}>
          <i /><i />
          <Icon name="mic" size={22} />
        </span>
        <div>
          <b>{done ? "Added to your cart" : "Listening…"}</b>
          <small>{done ? "Review before you confirm" : "Speak naturally"}</small>
        </div>
        <span className="eq">{[0, 1, 2, 3, 4].map((b) => <u key={b} style={{ "--b": b }} />)}</span>
      </div>

      <p className="transcript">
        “{phrase.text.slice(0, n)}<span className="caret" />”
      </p>

      <div className={`parsed ${done ? "show" : ""}`} key={idx + String(done)}>
        {done && phrase.items.map(([name, q], k) => (
          <div className="parsed-item" key={name} style={{ "--n": k }}>
            <span><Icon name="check" size={14} stroke={2.6} /></span>
            <b>{name}</b>
            <small>{q}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="sec white" id="how-it-works">
      <div className="wrap how-grid">
        <div>
          <Reveal variant="left">
            <span className="kicker">Simple &amp; easy</span>
            <h2 className="h2">How AssanMart Works</h2>
            <p className="lead">Getting your groceries has never been this easy. Three steps, and you stay in control the whole way.</p>
          </Reveal>

          <div className="steps">
            {STEPS.map(([icon, t, d], k) => (
              <Reveal key={t} variant="left" delay={120 + k * 130} className="step">
                <span className="step-n">0{k + 1}</span>
                <span className="step-icon"><Icon name={icon} size={22} /></span>
                <div><h4>{t}</h4><p>{d}</p></div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal variant="right" delay={150}><VoiceDemo /></Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Daily best sells                                                    */
/* ------------------------------------------------------------------ */

function Daily({ qty, setQty, onNavigate }) {
  return (
    <section className="sec cream" id="daily">
      <div className="wrap">
        <SectionHead title="Daily Best Sells" action={{ label: "View all", href: "#daily" }} />
        <div className="daily-grid">
          <Reveal variant="left" className="nature">
            <svg className="leaves" viewBox="0 0 300 320" aria-hidden="true">
              <g className="sway s1"><path d="M40 300 C 20 200, 60 90, 170 30 C 190 130, 150 250, 40 300z" /></g>
              <g className="sway s2"><path d="M150 310 C 140 240, 190 160, 270 130 C 280 210, 240 280, 150 310z" /></g>
              <g className="sway s3"><path d="M10 160 C 20 100, 70 60, 120 50 C 110 110, 70 150, 10 160z" /></g>
            </svg>
            <div className="nature-copy">
              <h3>Bring nature into your home</h3>
              <p>Everyday freshness, picked and packed with care.</p>
              <button className="light-btn" onClick={() => onNavigate("signup")}>Shop now</button>
            </div>
          </Reveal>

          <div className="daily-cards">
            {DAILY.map((p, k) => (
              <Reveal key={p.id} variant="right" delay={k * 100} className="dcard">
                <Thumb p={p} className="dthumb" />
                <h4>{p.name}</h4>
                <div className="pcard-row">
                  <b>Rs {p.price}</b>
                  <AddControl id={p.id} name={p.name} qty={qty} setQty={setQty} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Deals of the day + countdown                                        */
/* ------------------------------------------------------------------ */

function Countdown() {
  const left = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(24, 0, 0, 0);
    return Math.max(0, Math.floor((end - now) / 1000));
  };
  const [s, setS] = useState(left);
  useEffect(() => {
    const t = setInterval(() => setS(left()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (v) => String(v).padStart(2, "0");
  const parts = [["Hrs", Math.floor(s / 3600)], ["Min", Math.floor((s % 3600) / 60)], ["Sec", s % 60]];
  return (
    <div className="countdown" aria-label="Time left today">
      <Icon name="clock" size={16} />
      {parts.map(([l, v]) => (
        <span key={l}><b key={v}>{pad(v)}</b><small>{l}</small></span>
      ))}
    </div>
  );
}

function Deals({ onNavigate }) {
  return (
    <section className="sec white" id="deals">
      <div className="wrap">
        <div className="sec-head center">
          <Reveal variant="left"><h2>Deals Of The Day</h2></Reveal>
          <Reveal variant="right"><Countdown /></Reveal>
        </div>

        <div className="deal-grid">
          {DEALS.map((d, k) => (
            <Reveal key={d.title} variant={k === 0 ? "left" : k === 1 ? "up" : "right"} delay={k * 100} className={`deal ${d.tone}`}>
              <div className="deal-art">
                {d.art.map((e, j) => <span key={j} style={{ "--j": j }}>{e}</span>)}
              </div>
              <div className="deal-info">
                <em>{d.off}</em>
                <h3>{d.title}</h3>
                <small>{d.sub}</small>
                <button className="dark-btn sm" onClick={() => onNavigate("signup")}>Grab the deal</button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ, CTA, footer                                                    */
/* ------------------------------------------------------------------ */

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="sec tint" id="faq">
      <div className="wrap faq-grid">
        <Reveal variant="left">
          <span className="kicker">Got questions?</span>
          <h2 className="h2">Frequently Asked Questions</h2>
          <p className="lead">Answers to the things people ask us most.</p>
        </Reveal>

        <Reveal variant="right" className="faq-list">
          {FAQS.map(([q, a], k) => (
            <div key={q} className={`faq ${open === k ? "open" : ""}`}>
              <button onClick={() => setOpen(open === k ? -1 : k)} aria-expanded={open === k}>
                {q}<Icon name="chev" size={18} />
              </button>
              <div className="faq-body"><p>{a}</p></div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function CTA({ onNavigate }) {
  return (
    <section className="cta">
      <div className="wrap cta-in">
        <Reveal variant="left">
          <h2>Ready to make grocery shopping easier?</h2>
          <p>Join AssanMart and experience a smarter way to shop.</p>
        </Reveal>
        <Reveal variant="right">
          <button className="light-btn lg" onClick={() => onNavigate("signup")}>
            Get Started Today <Icon name="arrow" size={16} />
          </button>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (email.trim()) { setDone(true); setEmail(""); }
  };
  const cols = [
    ["Shop", ["Vegetables", "Fruits", "Dairy & Milk", "Bakery"]],
    ["Company", ["About us", "How it works", "Careers", "Contact"]],
    ["Support", ["Help centre", "Track an order", "Delivery info", "Returns"]],
  ];
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <a className="brand" href="#home">Assan<span>Mart</span></a>
          <p>Making grocery shopping simple, smart and convenient.</p>
          <form className="news" onSubmit={submit}>
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setDone(false); }}
              aria-label="Email address"
            />
            <button className="dark-btn sm" type="submit">Subscribe</button>
          </form>
          {done && <small className="news-ok">Thanks! You’re on the list.</small>}
        </div>
        {cols.map(([t, links]) => (
          <div key={t} className="footer-col">
            <h5>{t}</h5>
            {links.map((l) => <a key={l} href="#home">{l}</a>)}
          </div>
        ))}
      </div>
      <div className="wrap footer-bottom">
        <small>© 2026 AssanMart. All rights reserved.</small>
        <small>Privacy Policy · Terms of Service</small>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LandingPage({ onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const [qty, setQtyState] = useState({});

  const setQty = (id, d) =>
    setQtyState((q) => {
      const next = Math.max(0, (q[id] || 0) + d);
      const copy = { ...q, [id]: next };
      if (!next) delete copy[id];
      return copy;
    });

  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      let cur = "home";
      NAV.forEach(([id]) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.35) cur = id;
      });
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-page">
      <TopBar />
      <Navbar onNavigate={onNavigate} active={active} scrolled={scrolled} count={count} />
      <Hero onNavigate={onNavigate} />
      <Benefits />
      <Categories />
      <Popular qty={qty} setQty={setQty} />
      <HowItWorks />
      <Daily qty={qty} setQty={setQty} onNavigate={onNavigate} />
      <Deals onNavigate={onNavigate} />
      <FAQ />
      <CTA onNavigate={onNavigate} />
      <Footer />
    </div>
  );
}

export default LandingPage;