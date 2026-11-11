
import React, { useState } from "react";
import "./auth.css";

const API = "http://localhost:5000";

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/${mode === "login" ? "login" : "signup"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || "Could not connect to DeepTrace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">◉</div>
          <div>
            <h1>DEEPTRACE</h1>
            <span>DIGITAL MEDIA FORENSICS</span>
          </div>
        </div>

        <div className="auth-eyebrow">
          SECURE INVESTIGATOR ACCESS
        </div>

        <h2>
          {mode === "login"
            ? "Welcome back."
            : "Create your account."}
        </h2>

        <p className="auth-description">
          {mode === "login"
            ? "Sign in to continue your forensic investigations."
            : "Register to start using the DeepTrace workspace."}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign In
          </button>

          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="auth-field">
              FULL NAME
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}

          <label className="auth-field">
            EMAIL ADDRESS
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            PASSWORD
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />
          </label>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "PLEASE WAIT..."
              : mode === "login"
                ? "SIGN IN TO DEEPTRACE →"
                : "CREATE ACCOUNT →"}
          </button>
        </form>

        <div className="auth-footer">
          <span className="auth-status-dot" />
          SECURE AUTHENTICATION · DEEPTRACE 2026
        </div>
      </section>
    </main>
  );
}
