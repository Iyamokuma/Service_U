import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { api } from "../api.js";
import { isCountrySuperAdmin, countryAdminHomeState } from "../roles.js";
import { CountryAdminHqSettings } from "../components/CountryAdminHqSettings.jsx";
import { AdminTotpSecurity } from "../components/AdminTotpSecurity.jsx";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { availableHomeStatesForCountryAdmin } from "../stateAdminForm.js";

export function ProfileSettings() {
  const { admin, refreshAdmin } = useAdminAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: admin?.full_name || "",
    email: admin?.email || "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [allAdmins, setAllAdmins] = useState([]);
  const [churches, setChurches] = useState([]);
  const [homeStateDraft, setHomeStateDraft] = useState(admin?.branch_state || "");
  const [savingHome, setSavingHome] = useState(false);
  const [hqOpenSignal, setHqOpenSignal] = useState(0);

  const isCountryAdmin = isCountrySuperAdmin(admin?.role);
  const countryCode = String(admin?.branch_country || "").toUpperCase();
  const myHomeState = countryAdminHomeState(admin, { churches }) || String(admin?.branch_state || "").trim();
  const hqChurch = String(admin?.satellite_site || "").trim();

  const loadAdmins = useCallback(() => {
    if (!isCountryAdmin) return;
    api
      .admins()
      .then((r) => setAllAdmins(r.data || []))
      .catch(() => setAllAdmins([]));
  }, [isCountryAdmin]);

  useEffect(() => {
    loadAdmins();
    if (isCountryAdmin) {
      fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
    }
  }, [loadAdmins, isCountryAdmin]);

  useEffect(() => {
    const hq = countryAdminHomeState(admin, { churches }) || admin?.branch_state || "";
    setHomeStateDraft(hq);
  }, [admin?.branch_state, admin?.satellite_site, churches, admin]);

  const homeStateOptions = isCountryAdmin
    ? availableHomeStatesForCountryAdmin(countryCode, allAdmins, [], admin?.id, { churches })
    : [];

  async function saveHomeState() {
    if (!isCountryAdmin) return;
    setSavingHome(true);
    try {
      await api.updateAdmin(admin.id, {
        branch_state: homeStateDraft,
        viewer: admin,
      });
      await refreshAdmin();
      loadAdmins();
      toast("Headquarters state saved.", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSavingHome(false);
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.updateAdmin(admin.id, {
        full_name: form.full_name,
        email: form.email,
        ...(form.password ? { password: form.password } : {}),
        viewer: admin,
      });
      await refreshAdmin();
      toast("Profile updated.", "success");
      setForm((f) => ({ ...f, password: "" }));
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminTotpSecurity />

      {isCountryAdmin ? (
        <div className="sa-card" style={{ marginBottom: 16 }}>
          <div className="sa-card-body">
            <p className="sa-text-sm sa-text-muted" style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
              Your <strong>headquarters state</strong> unlocks the State Branch Admin view (satellite pastors,
              workforce leaders, and state unit members).
            </p>
            <CountryAdminHqSettings
              countryCode={countryCode}
              homeStateDraft={homeStateDraft}
              homeStateOptions={homeStateOptions}
              myHomeState={myHomeState}
              hqChurch={hqChurch}
              savingHome={savingHome}
              onChangeHomeState={setHomeStateDraft}
              onSave={saveHomeState}
              forceOpenSignal={hqOpenSignal}
            />
            {!myHomeState ? (
              <button
                type="button"
                className="sa-btn sa-btn-outline sa-btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setHqOpenSignal((n) => n + 1)}
              >
                Set headquarters state
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="sa-card">
        <div className="sa-card-body">
          <div className="sa-form-row">
            <div className="sa-field">
              <label className="sa-label">Full Name</label>
              <input
                className="sa-input"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="sa-field">
              <label className="sa-label">Email</label>
              <input
                className="sa-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="sa-field">
            <label className="sa-label">New Password (optional)</label>
            <input
              className="sa-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <button
            className="sa-btn sa-btn-primary"
            style={{ width: "auto" }}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>
    </>
  );
}
