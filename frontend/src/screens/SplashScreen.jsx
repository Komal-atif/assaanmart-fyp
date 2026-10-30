
import { useState } from "react";
import "./SignUpScreen.css";

export default function SignUpScreen({ onNavigate, onSignup }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (onSignup) {
      onSignup({ name, email, password });
    } else {
      setError("Signup action is not connected yet.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <button className="auth-brand" onClick={() => onNavigate("home")}>
          <img src="/products/Logo.png" alt="AssanMart logo" />
          <span>AssanMart</span>
        </button>

        <div className="auth-welcome">
          <span className="auth-eyebrow">JOIN ASSANMART</span>
          <h1>Fresh shopping starts <span>here.</span></h1>
          <p>
            Create your account and enjoy a simple grocery
            shopping experience with voice and manual ordering.
          </p>

          <div className="auth-decoration">
            <div className="auth-decoration-icon">A</div>
            <div>
              <strong>Your groceries, your way</strong>
              <small>Simple, convenient everyday shopping.</small>
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
            <span className="auth-eyebrow">CREATE YOUR ACCOUNT</span>
            <h2>Sign up for AssanMart</h2>
            <p>Enter your details to get started.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label htmlFor="signup-email">Email Address</label>
            <input
              id="signup-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="signup-password">Password</label>
            <div className="password-field">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <label htmlFor="signup-confirm">Confirm Password</label>
            <input
              id="signup-confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit">
              Create Account <span>→</span>
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <button onClick={() => onNavigate("login")}>
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
