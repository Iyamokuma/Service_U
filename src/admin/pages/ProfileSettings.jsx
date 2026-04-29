import { useState } from "react";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { api } from "../api.js";

export function ProfileSettings() {
  const { admin } = useAdminAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: admin?.full_name || "",
    email: admin?.email || "",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateAdmin(admin.id, { full_name: form.full_name, email: form.email, ...(form.password ? { password: form.password } : {}) });
      const current = JSON.parse(localStorage.getItem("admin_user") || "{}");
      localStorage.setItem("admin_user", JSON.stringify({ ...current, full_name: form.full_name, email: form.email }));
      toast("Profile updated.", "success");
      setForm((f) => ({ ...f, password: "" }));
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sa-card">
      <div className="sa-card-body">
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Full Name</label>
            <input className="sa-input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="sa-field">
            <label className="sa-label">Email</label>
            <input className="sa-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="sa-field">
          <label className="sa-label">New Password (optional)</label>
          <input className="sa-input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </div>
        <button className="sa-btn sa-btn-primary" style={{ width: "auto" }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Profile"}</button>
      </div>
    </div>
  );
}

