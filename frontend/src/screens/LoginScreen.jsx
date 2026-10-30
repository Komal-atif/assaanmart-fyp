
import { useState } from "react";
import "./LoginScreen.css";

export default function LoginScreen({ onNavigate, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    onLogin({ email, password });
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <button
          className="auth-brand"
          onClick={() => onNavigate("home")}
        >
          <img src="/products/Logo.png" alt="AssanMart logo" />
          <span>AssanMart</span>
        </button>

        <div className="auth-welcome">
          <span className="auth-eyebrow">WELCOME BACK</span>

          <h1>
            Good to see you <span>again!</span>
          </h1>

          <p>
            Sign in to continue your grocery shopping.
            Your everyday essentials are just a few steps away.
          </p>

          <div className="auth-decoration">
            <div className="auth-decoration-icon">A</div>
            <div>
              <strong>Shop your way</strong>
              <small>Use your voice or browse manually.</small>
            </div>
          </div>
        </div>

        <span className="auth-copyright">
          © 2026 AssanMart. All rights reserved.
        </span>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <button
            className="auth-back"
            onClick={() => onNavigate("home")}
          >
            ← Back to Home
          </button>

          <div className="auth-heading">
            <span className="auth-eyebrow">
              YOUR GROCERY ASSISTANT
            </span>

            <h2>Login to your account</h2>

            <p>Enter your details to access AssanMart.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email Address</label>

            <input
              id="login-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="login-password">Password</label>

            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p className="auth-error">{error}</p>
            )}

            <button type="submit" className="auth-submit">
              Login to AssanMart <span>→</span>
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{" "}
            <button onClick={() => onNavigate("signup")}>
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
