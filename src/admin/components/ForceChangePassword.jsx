import { useState } from "react";
import { api } from "../api.js";
import { useAdminAuth } from "../AdminContext.jsx";
import { PasswordField } from "./PasswordField.jsx";
import { useToast } from "./Toast.jsx";

export function ForceChangePassword() {
  const toast = useToast();
  const { admin, refreshAdmin } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      toast("Password must be at least 8 characters.", "error");
      return;
    }
    if (password !== confirm) {
      toast("Passwords do not match.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.updateAdmin(admin.id, { password, viewer: admin });
      await refreshAdmin();
      toast("Password updated.", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sa-login-page">
      <div className="sa-login-backdrop" aria-hidden="true">
        <span className="sa-login-orb sa-login-orb-1" />
        <span className="sa-login-orb sa-login-orb-2" />
        <span className="sa-login-orb sa-login-orb-3" />
        <span className="sa-login-orb sa-login-orb-4" />
      </div>
      <form className="sa-login-card" onSubmit={onSubmit}>
        <div className="sa-login-title" style={{ marginBottom: 8 }}>
          Set a new password
        </div>
        <div className="sa-login-group">
          <label className="sa-login-label">New password</label>
          <PasswordField
            inputClassName="sa-login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="sa-login-group">
          <label className="sa-login-label">Confirm password</label>
          <PasswordField
            inputClassName="sa-login-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button className="sa-login-btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
