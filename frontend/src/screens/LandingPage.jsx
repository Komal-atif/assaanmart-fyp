
function LandingPage({ onNavigate }) {
  return (
    <div className="landing-page">
      <nav className="navbar">
        <a className="brand" href="#home">
          <img src="/logo.svg.png" alt="AssanMart Logo" />
          <span>Assan<span>Mart</span></span>
        </a>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
        </div>

        <div className="nav-buttons">
          <button
            className="login-nav"
            onClick={() => onNavigate("login")}
          >
            Login
          </button>

          <button
            className="primary-btn small-btn"
            onClick={() => onNavigate("signup")}
          >
            Sign Up
          </button>
        </div>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-content">
          <span className="eyebrow">
            YOUR SMART GROCERY PARTNER
          </span>

          <h1>
            Groceries Made
            <span> Easier With Your Voice!</span>
          </h1>

          <p>
            Shop for your daily groceries in a smarter way.
            Simply speak your order or browse products manually.
            AssanMart makes grocery shopping simple and convenient.
          </p>

          <div className="hero-buttons">
            <button
              className="primary-btn"
              onClick={() => onNavigate("signup")}
            >
              Start Shopping <span>→</span>
            </button>

            <button
              className="secondary-btn"
              onClick={() => onNavigate("login")}
            >
              Login to Account
            </button>
          </div>

          <div className="hero-note">
            <span>✓</span> Voice & Manual Shopping
            <span>✓</span> Easy Order Confirmation
          </div>
        </div>

        <div className="hero-image">
          <div className="hero-circle"></div>

          <img
            src="/logo.svg.png"
            alt="AssanMart Grocery Mascot"
          />

          <div className="floating-card">
            <span>🎤</span>
            <div>
              <strong>Just Say It!</strong>
              <small>Your groceries, your way.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <span className="eyebrow">SIMPLE & EASY</span>
          <h2>How AssanMart Works</h2>
          <p>Getting your groceries has never been this easy.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">🎤</div>
            <span className="step-number">01</span>
            <h3>Speak Your Order</h3>
            <p>
              Tell AssanMart what groceries you need using your voice.
            </p>
          </div>

          <div className="step-card">
            <div className="step-icon">🛒</div>
            <span className="step-number">02</span>
            <h3>Review Your Cart</h3>
            <p>
              Check your selected products and quantities before ordering.
            </p>
          </div>

          <div className="step-card">
            <div className="step-icon">✓</div>
            <span className="step-number">03</span>
            <h3>Confirm Your Order</h3>
            <p>
              Confirm your groceries and let AssanMart handle the rest.
            </p>
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-heading">
          <span className="eyebrow">WHY ASSANMART?</span>
          <h2>Shopping That Understands You</h2>
          <p>
            Designed to make everyday grocery shopping easier.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <span>🎙️</span>
            <h3>Voice Ordering</h3>
            <p>Order groceries by speaking naturally.</p>
          </div>

          <div className="feature-card">
            <span>🛍️</span>
            <h3>Manual Shopping</h3>
            <p>Browse categories and add products yourself.</p>
          </div>

          <div className="feature-card">
            <span>💬</span>
            <h3>Smart Communication</h3>
            <p>Review and correct your order through interaction.</p>
          </div>

          <div className="feature-card">
            <span>📦</span>
            <h3>Order Management</h3>
            <p>Keep track of your grocery orders easily.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Make Grocery Shopping Easier?</h2>
        <p>
          Join AssanMart and experience a smarter way to shop.
        </p>

        <button
          className="white-btn"
          onClick={() => onNavigate("signup")}
        >
          Get Started Today →
        </button>
      </section>

      <footer className="footer">
        <div className="brand">
          <img src="/logo.svg.png" alt="AssanMart Logo" />
          <span>Assan<span>Mart</span></span>
        </div>

        <p>
          Making grocery shopping simple, smart and convenient.
        </p>

        <small>© 2026 AssanMart. All rights reserved.</small>
      </footer>
    </div>
  );
}

export default LandingPage;
