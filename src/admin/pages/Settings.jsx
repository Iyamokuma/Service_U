import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";

export function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings().then((r) => setSettings(r.data)).catch((e) => toast(e.message, "error"));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      toast("Settings saved.", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="sa-loading"><div className="sa-spinner" /><span>Loading…</span></div>;

  return (
    <div className="sa-card">
      <div className="sa-card-body">
        <h3 style={{ marginBottom: 12 }}>Notification Templates</h3>
        <div className="sa-field">
          <label className="sa-label">Approved template</label>
          <textarea className="sa-textarea" value={settings.templates.approved} onChange={(e) => setSettings((s) => ({ ...s, templates: { ...s.templates, approved: e.target.value } }))} />
        </div>
        <div className="sa-field">
          <label className="sa-label">Rejected template</label>
          <textarea className="sa-textarea" value={settings.templates.rejected} onChange={(e) => setSettings((s) => ({ ...s, templates: { ...s.templates, rejected: e.target.value } }))} />
        </div>
        <div className="sa-field">
          <label className="sa-label">Waitlisted template</label>
          <textarea className="sa-textarea" value={settings.templates.waitlisted} onChange={(e) => setSettings((s) => ({ ...s, templates: { ...s.templates, waitlisted: e.target.value } }))} />
        </div>

        <h3 style={{ margin: "20px 0 12px" }}>Overdue &amp; alerts</h3>
        <p className="sa-text-sm sa-text-muted" style={{ maxWidth: 640, lineHeight: 1.55, marginBottom: 14 }}>
          Applications in <strong>New</strong> or <strong>In progress</strong> are marked <strong>overdue</strong> after this many hours without a status change.
          The relevant <strong>service unit</strong> and <strong>sub-unit leaders</strong> get one in-app notification per application (until it moves forward), and an email if Resend is configured on the server (<code>RESEND_API_KEY</code>, <code>RESEND_FROM_EMAIL</code>).
        </p>
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Overdue threshold (hours)</label>
            <input className="sa-input" type="number" min="1" step="1" value={settings.overdue_threshold_hours} onChange={(e) => setSettings((s) => ({ ...s, overdue_threshold_hours: Number(e.target.value || 1) }))} />
          </div>
        </div>

        <h3 style={{ margin: "20px 0 12px" }}>User Permissions</h3>
        <div className="sa-form-row">
          {Object.entries(settings.permissions).map(([k, v]) => (
            <div className="sa-field" key={k}>
              <label className="sa-label">{k.replace(/_/g, " ")}</label>
              <select className="sa-field-select" value={v ? "1" : "0"} onChange={(e) => setSettings((s) => ({ ...s, permissions: { ...s.permissions, [k]: e.target.value === "1" } }))}>
                <option value="1">Enabled</option>
                <option value="0">Disabled</option>
              </select>
            </div>
          ))}
        </div>

        <button className="sa-btn sa-btn-primary" style={{ width: "auto", marginTop: 8 }} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

