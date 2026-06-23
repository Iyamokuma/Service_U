import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { AdminAuthCard } from "../components/AdminAuthCard.jsx";
import { PasswordField } from "../components/PasswordField.jsx";
import { roleDisplayLabel } from "../roles.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";

const RESET_STEPS = ["Open link", "Set password", "Sign in"];

export function AdminResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const token = String(searchParams.get("token") || "").trim();

  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (admin) {
      navigate("/admin", { replace: true });
      return;
    }
    if (!token) {
      setError("This link is missing its reset token. Use Forgot password on the sign-in page to get a new link.");
      setPhase("error");
      return;
    }
    api
      .validatePasswordReset(token)
      .then((r) => {
        setProfile(r);
        setPhase("form");
      })
      .catch((e) => {
        setError(e.message);
        setPhase("error");
      });
  }, [token, admin, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.completePasswordReset(token, password);
      if (!res?.ok) {
        throw new Error("Password could not be updated. Try again or request a new link.");
      }
      const email = String(res.email || profile?.email || "").trim();
      navigate(`/admin?${new URLSearchParams({ email, reset: "success" }).toString()}`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const activeStep = phase === "form" ? 1 : 0;

  return (
    <AdminAuthCard
      subtitle="Reset password"
      steps={RESET_STEPS}
      activeStep={activeStep}
      description={
        phase === "form"
          ? "Choose a new password for your admin account. After confirming, sign in with it on the login page."
          : phase === "loading"
            ? "Checking your reset link…"
            : ""
      }
      footer={
        phase === "error"
          ? "Link expired? Use Forgot password on the sign-in page to get a new link."
          : "Secure admin access · Salvation Ministries"
      }
    >
      {phase === "loading" ? <SmhLoader label="Checking reset link" size={48} /> : null}

      {error ? <div className="sa-login-err" role="alert">{error}</div> : null}

      {profile && phase === "form" ? (
        <div className="sa-login-invite-profile">
          <div className="sa-login-invite-name">{profile.full_name}</div>
          <div className="sa-login-invite-meta">{profile.email}</div>
          <div className="sa-login-invite-role">{roleDisplayLabel(profile.role)}</div>
        </div>
      ) : null}

      {profile && phase === "form" ? (
        <form onSubmit={onSubmit}>
          <div className="sa-login-group">
            <label className="sa-login-label" htmlFor="reset-password">
              New password
            </label>
            <PasswordField
              id="reset-password"
              inputClassName="sa-login-input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="sa-login-group">
            <label className="sa-login-label" htmlFor="reset-confirm">
              Confirm password
            </label>
            <PasswordField
              id="reset-confirm"
              inputClassName="sa-login-input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button className="sa-login-btn" type="submit" disabled={saving}>
            {saving ? "Updating password…" : "Confirm password"}
          </button>
        </form>
      ) : null}

      {phase === "error" ? (
        <Link to="/admin" className="sa-login-btn sa-login-btn-outline" style={{ marginTop: 16, display: "inline-block", textAlign: "center", textDecoration: "none" }}>
          Back to sign in
        </Link>
      ) : null}
    </AdminAuthCard>
  );
}
