import { useState } from "react";
import { useAdminAuth } from "../AdminContext.jsx";
import { useToast } from "./Toast.jsx";
import { api } from "../api.js";
import { isRootSuperAdmin } from "../roles.js";
import { SmhLoader } from "../../components/SmhLoader.jsx";

export function AdminTotpSecurity() {
  const { admin, refreshAdmin } = useAdminAuth();
  const toast = useToast();
  const [enrolling, setEnrolling] = useState(false);
  const [setup, setSetup] = useState(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);

  if (isRootSuperAdmin(admin?.role)) return null;

  const enabled = !!admin?.totp_enabled;
  const daysLeft = admin?.totp_grace_days_remaining;
  const required = !!admin?.totp_enrollment_required;

  async function startEnroll() {
    setEnrolling(true);
    try {
      const res = await api.startTotpEnrollment();
      setSetup(res);
      setConfirmCode("");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setEnrolling(false);
    }
  }

  async function confirmEnroll() {
    if (confirmCode.length !== 6) return;
    setSaving(true);
    try {
      const res = await api.confirmTotpEnrollment(confirmCode);
      if (res?.admin) {
        await refreshAdmin();
      }
      setSetup(null);
      setConfirmCode("");
      toast("Authenticator enabled.", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sa-card" style={{ marginBottom: 16 }}>
      <div className="sa-card-body">
        <h3 style={{ margin: "0 0 12px" }}>Two-factor authentication</h3>

        {enabled ? (
          <p className="sa-text-sm sa-text-muted" style={{ margin: 0 }}>
            Authenticator is active on this account.
          </p>
        ) : (
          <>
            {required ? (
              <div className="sa-login-err" style={{ marginBottom: 12 }} role="alert">
                Setup is required to continue using the dashboard.
              </div>
            ) : daysLeft != null && daysLeft > 0 ? (
              <p className="sa-text-sm sa-text-muted" style={{ margin: "0 0 12px" }}>
                Required in {daysLeft} day{daysLeft === 1 ? "" : "s"}.
              </p>
            ) : null}

            {!setup ? (
              <button
                type="button"
                className="sa-btn sa-btn-primary sa-btn-sm"
                onClick={startEnroll}
                disabled={enrolling}
              >
                {enrolling ? "Preparing…" : "Set up authenticator"}
              </button>
            ) : (
              <div className="sa-totp-enroll">
                <div className="sa-totp-enroll-qr">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setup.otpauth_uri || "")}`}
                    alt="Authenticator QR code"
                    width={180}
                    height={180}
                  />
                </div>
                <p className="sa-text-sm sa-text-muted" style={{ margin: "12px 0", wordBreak: "break-all" }}>
                  Manual key: <code>{setup.secret_base32}</code>
                </p>
                <div className="sa-field">
                  <label className="sa-label">Authenticator code</label>
                  <input
                    className="sa-input sa-login-otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="sa-btn sa-btn-primary sa-btn-sm"
                    onClick={confirmEnroll}
                    disabled={saving || confirmCode.length !== 6}
                  >
                    {saving ? "Saving…" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="sa-btn sa-btn-ghost sa-btn-sm"
                    onClick={() => {
                      setSetup(null);
                      setConfirmCode("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {enrolling && !setup ? (
          <div style={{ marginTop: 12 }}>
            <SmhLoader label="Preparing" variant="compact" size={32} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
