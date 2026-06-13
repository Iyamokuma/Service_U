import { useAdminAuth } from "../AdminContext.jsx";
import { AdminTotpSecurity } from "./AdminTotpSecurity.jsx";
import { isRootSuperAdmin } from "../roles.js";

/** Hard block after grace period until authenticator is enabled. */
export function TotpEnrollmentGate({ page, children }) {
  const { admin } = useAdminAuth();

  if (!admin || isRootSuperAdmin(admin.role)) return children;
  if (admin.totp_enabled) return children;
  if (!admin.totp_enrollment_required) return children;
  if (page === "profile") return children;

  return (
    <div className="sa-totp-gate">
      <div className="sa-totp-gate-card">
        <h2 className="sa-totp-gate-title">Two-factor authentication required</h2>
        <p className="sa-text-sm sa-text-muted" style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
          Set up your authenticator app to continue.
        </p>
        <AdminTotpSecurity />
      </div>
    </div>
  );
}
