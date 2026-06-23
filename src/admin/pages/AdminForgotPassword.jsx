import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { AdminAuthCard } from "../components/AdminAuthCard.jsx";
import { SmhLoader } from "../../components/SmhLoader.jsx";

export function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await api.requestPasswordReset(email);
      setMessage(
        res?.message ||
          "If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.",
      );
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminAuthCard
      subtitle="Forgot password"
      description={
        sent
          ? message
          : "Enter the email on your admin account. We will send a link to choose a new password."
      }
      footer="Super Admin accounts must contact the platform owner · Salvation Ministries"
    >
      {error ? <div className="sa-login-err" role="alert">{error}</div> : null}

      {sent ? (
        <div className="sa-login-success-panel" role="status">
          <div className="sa-login-success-icon" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 12.5L10 16.5L18 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="sa-login-success-title">Check your email</div>
          <p className="sa-login-success-text">{message}</p>
          <Link to="/admin" className="sa-login-btn sa-login-btn-outline" style={{ marginTop: 16, display: "inline-block", textAlign: "center", textDecoration: "none" }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="sa-login-group">
            <label className="sa-login-label" htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              className="sa-login-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button className="sa-login-btn" type="submit" disabled={submitting}>
            {submitting ? (
              <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
            ) : (
              "Send reset link"
            )}
          </button>
          <div className="sa-login-forgot">
            <Link to="/admin">Back to sign in</Link>
          </div>
        </form>
      )}
    </AdminAuthCard>
  );
}
