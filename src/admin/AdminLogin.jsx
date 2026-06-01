import { useState } from "react";
import { useAdminAuth } from "./AdminContext.jsx";
import { AdminBrandLogo } from "./components/AdminBrandLogo.jsx";

export function AdminLogin() {
  const { login, loading, error } = useAdminAuth();
  const [form, setForm] = useState({ username: "", password: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    await login(form.username, form.password);
  };

  return (
    <div className="sa-login-page">
      <form className="sa-login-card" onSubmit={onSubmit}>
        <div className="sa-login-logo">
          <AdminBrandLogo variant="login" />
          <div>
            <div className="sa-login-title">Salvation Ministries</div>
            <div className="sa-login-sub">Admin Portal</div>
          </div>
        </div>

        {error && <div className="sa-login-err">{error}</div>}

        <div className="sa-login-group">
          <label className="sa-login-label">Username or Email</label>
          <input
            className="sa-login-input"
            type="text"
            autoComplete="username"
            placeholder="superadmin"
            value={form.username}
            onChange={set("username")}
            required
          />
        </div>

        <div className="sa-login-group">
          <label className="sa-login-label">Password</label>
          <input
            className="sa-login-input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
            required
          />
        </div>

        <button className="sa-login-btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
