import { useEffect, useState } from "react";
import { api } from "../api.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";
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

  if (!settings) return <SmhLoader label="Loading settings" />;

  const templates = settings.templates ?? { approved: "", rejected: "" };

  return (
    <div className="sa-card">
      <div className="sa-card-body">
        <h3 style={{ marginBottom: 12 }}>Applicant notification templates</h3>
        <p className="sa-text-sm sa-text-muted" style={{ maxWidth: 640, lineHeight: 1.55, marginBottom: 14 }}>
          Applicants receive a confirmation email when they submit the form. When an admin moves an application to{" "}
          <strong>Accepted</strong> or <strong>Rejected</strong>, the matching template below is emailed automatically.
          Use <code>{`{{name}}`}</code> and <code>{`{{unit}}`}</code> (department / service unit).
        </p>
        <div className="sa-field">
          <label className="sa-label">Approved template</label>
          <textarea className="sa-textarea" value={templates.approved} onChange={(e) => setSettings((s) => ({ ...s, templates: { ...(s.templates ?? {}), approved: e.target.value } }))} />
        </div>
        <div className="sa-field">
          <label className="sa-label">Rejected template</label>
          <textarea className="sa-textarea" value={templates.rejected} onChange={(e) => setSettings((s) => ({ ...s, templates: { ...(s.templates ?? {}), rejected: e.target.value } }))} />
        </div>

        <h3 style={{ margin: "20px 0 12px" }}>Overdue &amp; alerts</h3>
        <p className="sa-text-sm sa-text-muted" style={{ maxWidth: 640, lineHeight: 1.55, marginBottom: 14 }}>
          Overdue is <strong>not a status</strong>. Records stay <strong>New</strong> or <strong>In Progress</strong> and appear on the
          Overdue queue tab once they pass the overdue threshold (1–30 days). Override per service unit on Service Units.
          Sub-unit leaders receive batched email and in-app alerts for overdue records.
          Service unit leaders receive batched email when records become <strong>critical</strong> (days overdue past the critical threshold below).
        </p>
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Global overdue threshold (days)</label>
            <input
              className="sa-input"
              type="number"
              min={1}
              max={30}
              step={1}
              value={settings.overdue_threshold_days ?? Math.max(1, Math.round((settings.overdue_threshold_hours || 72) / 24))}
              onChange={(e) => {
                const days = Math.min(30, Math.max(1, Number(e.target.value || 1)));
                setSettings((s) => ({
                  ...s,
                  overdue_threshold_days: days,
                  overdue_threshold_hours: days * 24,
                }));
              }}
            />
          </div>
          <div className="sa-field">
            <label className="sa-label">Critical threshold (days overdue)</label>
            <input
              className="sa-input"
              type="number"
              min={1}
              max={90}
              step={1}
              value={settings.critical_threshold_days ?? 30}
              onChange={(e) => {
                const days = Math.min(90, Math.max(1, Number(e.target.value || 30)));
                setSettings((s) => ({ ...s, critical_threshold_days: days }));
              }}
            />
          </div>
        </div>
        <p className="sa-text-sm sa-text-muted" style={{ maxWidth: 640, lineHeight: 1.55, marginBottom: 14 }}>
          Placeholders for applicant emails: <code>{"{{name}}"}</code>, <code>{"{{unit}}"}</code>
        </p>

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

