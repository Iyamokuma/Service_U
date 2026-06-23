import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { AdminAuthCard } from "../components/AdminAuthCard.jsx";
import { PasswordField } from "../components/PasswordField.jsx";
import { roleDisplayLabel } from "../roles.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";

const RESET_STEPS = ["Open link", "New password", "Sign in"];

export function AdminResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { admin, loginWithToken } = useAdminAuth();
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
      setError("This link is missing its reset token. Request a new link from the sign-in page.");
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
      if (res?.token && res?.admin) {
        await loginWithToken(res.token, res.admin);
        setPhase("success");
        return;
      }
      throw new Error("Password was updated but sign-in failed. Use the admin login page with your new password.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (phase !== "success") return undefined;
    const t = setTimeout(() => navigate("/admin", { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  const activeStep = phase === "success" ? 2 : 1;

  return (
    <AdminAuthCard
      subtitle="Reset password"
      steps={RESET_STEPS}
      activeStep={activeStep}
      description={
        phase === "form"
          ? "Choose a new password for your admin account. You will be signed in automatically."
          : phase === "success"
            ? "Your password is updated. Redirecting to the dashboard…"
            : phase === "loading"
              ? "Checking your reset link…"
              : ""
      }
      footer={
        phase === "error"
          ? "Link expired? Request a new reset from the sign-in page."
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

      {phase === "success" ? (
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
          <div className="sa-login-success-title">Password updated</div>
          <p className="sa-login-success-text">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}. Taking you to the dashboard…
          </p>
          <SmhLoader label="" variant="compact" size={28} />
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
            {saving ? "Updating password…" : "Update & sign in"}
          </button>
        </form>
      ) : null}

      {phase === "error" ? (
        <div className="sa-login-forgot" style={{ marginTop: 16 }}>
          <Link to="/admin/forgot-password">Request a new reset link</Link>
          {" · "}
          <Link to="/admin">Back to sign in</Link>
        </div>
      ) : null}
    </AdminAuthCard>
  );
}
