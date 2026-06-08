import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { AdminBrandLogo } from "../components/AdminBrandLogo.jsx";

export function AdminAcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { admin, loginWithToken } = useAdminAuth();
  const token = String(searchParams.get("token") || "").trim();

  const [loading, setLoading] = useState(true);
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
      setError("Missing invitation token. Use the link from your email.");
      setLoading(false);
      return;
    }
    api
      .validateInvite(token)
      .then((r) => setProfile(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
      await loginWithToken(res.token, res.admin);
      navigate("/admin", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sa-login-page">
      <form className="sa-login-card" onSubmit={onSubmit}>
        <div className="sa-login-logo">
          <AdminBrandLogo variant="login" />
          <div>
            <div className="sa-login-title">Activate admin account</div>
            <div className="sa-login-sub">Set your password to continue</div>
          </div>
        </div>

        {loading ? (
          <p className="sa-text-muted sa-text-sm">Checking invitation…</p>
        ) : null}

        {error ? <div className="sa-login-err">{error}</div> : null}

        {profile && !loading ? (
          <>
            <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
              Welcome, <strong>{profile.full_name}</strong>.
              {profile.role ? (
                <>
                  {" "}
                  You are joining as <strong>{String(profile.role).replace(/_/g, " ")}</strong>.
                </>
              ) : null}{" "}
              Use <strong>{profile.email}</strong> to sign in after you set your password.
            </p>
            <div className="sa-login-group">
              <label className="sa-login-label">New password</label>
              <input
                className="sa-login-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="sa-login-group">
              <label className="sa-login-label">Confirm password</label>
              <input
                className="sa-login-input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button className="sa-login-btn" type="submit" disabled={saving}>
              {saving ? "Activating…" : "Activate & sign in"}
            </button>
          </>
        ) : null}

        {!loading && !profile && !token ? (
          <button type="button" className="sa-btn sa-btn-outline" onClick={() => navigate("/admin")}>
            Back to sign in
          </button>
        ) : null}
      </form>
    </div>
  );
}
