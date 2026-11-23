import { useState } from "react";
import { request } from "../lib/api.js";

const initialFields = { name: "", email: "", password: "" };

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [fields, setFields] = useState(initialFields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  function changeMode(nextMode) {
    setMode(nextMode);
    setFields(initialFields);
    setError("");
  }

  function updateField(event) {
    setFields((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request(
        isRegister ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: isRegister
            ? {
                name: fields.name,
                email: fields.email,
                password: fields.password,
              }
            : { email: fields.email, password: fields.password },
        },
      );
      onAuthenticated({ token: result.token, user: result.user });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <div className="brand-lockup brand-lockup-light">
          <span className="brand-mark">N</span>
          <span>
            Northstar <b>Supply</b>
          </span>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">OPERATIONS, IN SYNC</span>
          <h1>Good inventory is good business.</h1>
          <p>
            Bring products, stock and orders together in one clear view. Spend
            less time searching, and more time moving forward.
          </p>
        </div>
        <div className="story-foot">
          <span className="story-spark">✳</span>
          <span>Built for the people who keep things moving.</span>
        </div>
        <div className="story-orb story-orb-one" />
        <div className="story-orb story-orb-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand brand-lockup">
            <span className="brand-mark">N</span>
            <span>
              Northstar <b>Supply</b>
            </span>
          </div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2>{isRegister ? "Create your account" : "Welcome back"}</h2>
          <p className="muted auth-intro">
            {isRegister
              ? "Start managing your operations in one place."
              : "Sign in to manage your inventory and orders."}
          </p>

          {error && (
            <div
              className={`auth-notice ${error.includes("Sign in") ? "notice-success" : ""}`}
              role="status"
            >
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <label className="field">
                <span>Full name</span>
                <input
                  autoComplete="name"
                  maxLength="100"
                  name="name"
                  onChange={updateField}
                  placeholder="Jordan Lee"
                  required
                  value={fields.name}
                />
              </label>
            )}
            <label className="field">
              <span>Work email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={updateField}
                placeholder="you@company.com"
                required
                type="email"
                value={fields.email}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength="8"
                name="password"
                onChange={updateField}
                placeholder="At least 8 characters"
                required
                type="password"
                value={fields.password}
              />
            </label>
            <button
              className="button button-primary auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to Northstar?"}{" "}
            <button
              className="text-button"
              onClick={() => changeMode(isRegister ? "login" : "register")}
              type="button"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="auth-legal">
            Protected workspace · Your data stays yours
          </p>
        </div>
      </section>
    </main>
  );
}
