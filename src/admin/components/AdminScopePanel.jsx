import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import { ROLES_WITH_COUNTRY } from "../adminAccountForm.js";

/** One-line scope summary for create / edit admin forms. */
export function formatAdminScopeDraft(form) {
  const role = form?.role || "";
  if (!ROLES_WITH_COUNTRY.includes(role)) return "";
  const parts = [];
  const cc = String(form?.branch_country || "").trim();
  const st = String(form?.branch_state || "").trim();
  const sat = String(form?.satellite_site || "").trim();
  if (cc) parts.push(branchCountryLabel(cc) || cc);
  if (st) {
    parts.push(
      role === "country_super_admin"
        ? `HQ ${branchStateLabel(cc, st) || st}`
        : branchStateLabel(cc, st) || st,
    );
  }
  if (sat) parts.push(sat);
  return parts.length ? parts.join(" · ") : "Select location";
}

export function adminScopePanelLabel(role) {
  if (role === "country_super_admin") return "Headquarters & scope";
  if (role === "state_super_admin") return "State branch scope";
  return "Scope / location";
}

/**
 * Collapsible scope block — same shell as Country Admin HQ settings (Profile).
 */
export function AdminScopePanel({
  label,
  summary,
  hint,
  children,
  defaultOpen = true,
  open,
  onToggle,
}) {
  const controlled = open !== undefined;
  return (
    <details
      className="sa-users-hq-settings"
      open={controlled ? open : defaultOpen ? true : undefined}
      onToggle={controlled && onToggle ? (e) => onToggle(e.target.open) : undefined}
    >
      <summary className="sa-users-hq-settings-summary">
        <span className="sa-users-hq-settings-label">{label}</span>
        <span className="sa-users-hq-settings-value">{summary || "Not set"}</span>
      </summary>
      <div className="sa-users-hq-settings-body">
        {hint ? (
          <p className="sa-text-muted sa-text-sm" style={{ margin: "12px 0 16px", lineHeight: 1.55 }}>
            {hint}
          </p>
        ) : null}
        {children}
      </div>
    </details>
  );
}
