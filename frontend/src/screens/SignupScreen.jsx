
import { useState } from "react";
import "./SignupScreen.css";

function SignupScreen({ onSignup, onNavigate }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 4) {
      setError("Password must contain at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    onSignup({
      name: fullName,
      email: email,
      password: password,
    });
  };

  return (
    <div className="auth-page">

      <button
        className="auth-back"
        type="button"
        onClick={() => onNavigate("home")}
      >
        ← Back to Home
      </button>

      <div className="auth-card">

        <div className="auth-logo">
          <img src="/products/Logo.png" alt="AssanMart" />
        </div>

        <span className="eyebrow">JOIN ASSANMART</span>

        <h2>Create Your Account</h2>

        <p className="auth-description">
          Start your smarter grocery shopping experience.
        </p>

        <form onSubmit={handleSubmit}>

          <label htmlFor="signup-name">Full Name</label>

          <input
            id="signup-name"
            type="text"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <label htmlFor="signup-email">Email Address</label>

          <input
            id="signup-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="signup-password">Password</label>

          <input
            id="signup-password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required
          />

          <label htmlFor="confirm-password">Confirm Password</label>

          <input
            id="confirm-password"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <p className="auth-error">{error}</p>
          )}

          <button
            type="submit"
            className="primary-btn auth-submit"
          >
            Create Account →
          </button>

        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => onNavigate("login")}
          >
            Login
          </button>
        </p>

      </div>
    </div>
  );
}

export default SignupScreen;
