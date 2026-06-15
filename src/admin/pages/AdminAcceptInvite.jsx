import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { AdminAuthCard } from "../components/AdminAuthCard.jsx";
import { PasswordField } from "../components/PasswordField.jsx";
import { roleDisplayLabel } from "../roles.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";

const INVITE_STEPS = ["Open invite", "Set password", "You're in"];

export function AdminAcceptInvite() {
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
      setError("This link is missing its invitation token. Open the link from your invite email.");
      setPhase("error");
      return;
    }
    api
      .validateInvite(token)
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
      const res = await api.completeInvite(token, password);
      if (res?.token && res?.admin) {
        await loginWithToken(res.token, res.admin);
        setPhase("success");
        return;
      }
      throw new Error("Account was activated but sign-in failed. Use the admin login page with your new password.");
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
      subtitle="Admin account setup"
      steps={INVITE_STEPS}
      activeStep={activeStep}
      description={
        phase === "form"
          ? "Create a password for your admin account. You will be signed in automatically — verification codes are only needed when you sign in again later."
          : phase === "success"
            ? "Your account is ready."
            : phase === "loading"
              ? "Checking your invitation…"
              : ""
      }
      footer={
        phase === "error"
          ? "Need help? Ask your Super Admin to resend the invitation."
          : "Secure admin access · Salvation Ministries"
      }
    >
      {phase === "loading" ? <SmhLoader label="Checking invitation" size={48} /> : null}

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
          <div className="sa-login-success-title">Account activated</div>
          <p className="sa-login-success-text">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}. Taking you to the dashboard…
          </p>
          <SmhLoader label="" variant="compact" size={28} />
        </div>
      ) : null}

      {profile && phase === "form" ? (
        <form onSubmit={onSubmit}>
          <div className="sa-login-group">
            <label className="sa-login-label" htmlFor="invite-password">
              New password
            </label>
            <PasswordField
              id="invite-password"
              inputClassName="sa-login-input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="sa-login-group">
            <label className="sa-login-label" htmlFor="invite-confirm">
              Confirm password
            </label>
            <PasswordField
              id="invite-confirm"
              inputClassName="sa-login-input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button className="sa-login-btn" type="submit" disabled={saving}>
            {saving ? "Activating account…" : "Activate & sign in"}
          </button>
        </form>
      ) : null}

      {phase === "error" && !token ? (
        <button type="button" className="sa-login-btn sa-login-btn-outline" onClick={() => navigate("/admin")}>
          Go to sign in
        </button>
      ) : null}
    </AdminAuthCard>
  );
}
