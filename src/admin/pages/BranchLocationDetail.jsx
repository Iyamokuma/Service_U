import { branchCountryLabel, branchStateLabel } from "../branchRegions.js";
import {
  countryAdminFor,
  satelliteAdminFor,
  stateAdminFor,
  stateKey,
} from "../catalogUtils.js";

export function BranchLocationDetail({ detail, catalog, onBack, onToggleChurch, onDeleteChurch, busy }) {
  const { churches, satellites, admins, stats } = catalog;

  if (detail.kind === "church") {
    const ch = churches.find((c) => Number(c.id) === Number(detail.id));
    if (!ch) {
      return (
        <div className="sa-card">
          <div className="sa-card-body">
            <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={onBack}>
              ← Back
            </button>
            <p className="sa-text-muted" style={{ marginTop: 16 }}>
              Location not found.
            </p>
          </div>
        </div>
      );
    }
    const cc = String(ch.branch_country || "").toUpperCase();
    const st = String(ch.branch_state || "").toUpperCase();
    const name = String(ch.name || "").trim();
    const meta = (satellites || []).find(
      (s) =>
        String(s.branch_country || "").toUpperCase() === cc &&
        String(s.branch_state || "").toUpperCase() === st &&
        String(s.site_name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    const countryAdmin = countryAdminFor(admins, cc);
    const branchAdmin = stateAdminFor(admins, cc, st);
    const satAdmin = satelliteAdminFor(admins, cc, st, name);
    const members = stats?.membersBySatellite?.[satelliteKey(cc, st, name)] ?? 0;

    return (
      <div className="sa-card">
        <div className="sa-card-head" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={onBack}>
            ← Back to directory
          </button>
          <span className="sa-card-title">{name}</span>
          <span className={`sa-badge ${Number(ch.is_active) === 1 ? "active" : "inactive"}`}>
            {Number(ch.is_active) === 1 ? "Active" : "Hidden"}
          </span>
        </div>
        <div className="sa-card-body">
          <div className="sa-detail-grid">
            <DetailItem label="Country" value={branchCountryLabel(cc)} />
            <DetailItem label="State / region" value={branchStateLabel(cc, st)} />
            <DetailItem label="Continent" value={meta?.continent || "—"} />
            <DetailItem label="LGA / city" value={meta?.lga || "—"} />
            <DetailItem label="Address" value={ch.address || "—"} />
            <DetailItem label="Members (accepted)" value={String(members)} />
            <DetailItem label="Country admin" value={countryAdmin?.full_name || "—"} />
            <DetailItem label="Branch / state admin" value={branchAdmin?.full_name || "—"} />
            <DetailItem label="Satellite pastor" value={satAdmin?.full_name || "—"} />
          </div>
          <div className="sa-table-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="sa-btn sa-btn-outline sa-btn-sm"
              disabled={busy}
              onClick={() => onToggleChurch(ch, Number(ch.is_active) === 1 ? 0 : 1)}
            >
              {Number(ch.is_active) === 1 ? "Hide from form" : "Show on form"}
            </button>
            <button type="button" className="sa-btn sa-btn-danger sa-btn-sm" disabled={busy} onClick={() => onDeleteChurch(ch)}>
              Delete location
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (detail.kind === "country") {
    const cc = String(detail.code || "").toUpperCase();
    const country = catalog.countries.find((c) => String(c.branch_country_code || "").toUpperCase() === cc);
    const countryStates = (catalog.states || []).filter((s) => Number(s.country_id) === Number(country?.id));
    const countryChurches = (churches || []).filter((c) => String(c.branch_country || "").toUpperCase() === cc);
    const countryAdmin = countryAdminFor(admins, cc);

    return (
      <div className="sa-card">
        <div className="sa-card-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={onBack}>
            ← Back
          </button>
          <span className="sa-card-title">{country?.name || branchCountryLabel(cc)}</span>
        </div>
        <div className="sa-card-body">
          <div className="sa-detail-grid">
            <DetailItem label="Branch code" value={cc} />
            <DetailItem label="Country admin" value={countryAdmin?.full_name || "—"} />
            <DetailItem label="States / regions" value={String(countryStates.length)} />
            <DetailItem label="Satellite churches" value={String(countryChurches.length)} />
            <DetailItem label="Members (accepted)" value={String(stats?.membersByCountry?.[cc] || 0)} />
          </div>
          <h4 style={{ marginTop: 24, marginBottom: 8 }}>States in this country</h4>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Code</th>
                  <th>Satellites</th>
                </tr>
              </thead>
              <tbody>
                {countryStates.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.branch_state_code}</td>
                    <td>
                      {countryChurches.filter(
                        (c) => String(c.branch_state || "").toUpperCase() === String(s.branch_state_code || "").toUpperCase(),
                      ).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (detail.kind === "state") {
    const cc = String(detail.branch_country || "").toUpperCase();
    const st = String(detail.branch_state || "").toUpperCase();
    const stateRow = (catalog.states || []).find(
      (s) =>
        String(s.branch_state_code || "").toUpperCase() === st &&
        catalog.countries.some(
          (c) => Number(c.id) === Number(s.country_id) && String(c.branch_country_code || "").toUpperCase() === cc,
        ),
    );
    const stateChurches = (churches || []).filter(
      (c) => String(c.branch_country || "").toUpperCase() === cc && String(c.branch_state || "").toUpperCase() === st,
    );
    const branchAdmin = stateAdminFor(admins, cc, st);
    const leaders = (admins || []).filter(
      (a) =>
        Number(a.is_active) === 1 &&
        String(a.branch_country || "").toUpperCase() === cc &&
        String(a.branch_state || "").toUpperCase() === st &&
        (a.role === "service_unit_leader" || a.role === "sub_unit_leader"),
    );

    return (
      <div className="sa-card">
        <div className="sa-card-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={onBack}>
            ← Back
          </button>
          <span className="sa-card-title">
            {stateRow?.name || branchStateLabel(cc, st)} · {branchCountryLabel(cc)}
          </span>
        </div>
        <div className="sa-card-body">
          <div className="sa-detail-grid">
            <DetailItem label="Branch admin" value={branchAdmin?.full_name || "—"} />
            <DetailItem label="Contact" value={branchAdmin?.email || "—"} />
            <DetailItem label="Unit leaders" value={String(leaders.length)} />
            <DetailItem label="Satellite churches" value={String(stateChurches.length)} />
            <DetailItem label="Members (accepted)" value={String(stats?.membersByState?.[stateKey(cc, st)] || 0)} />
          </div>
          <h4 style={{ marginTop: 24, marginBottom: 8 }}>Satellite churches</h4>
          <ul className="sa-text-sm" style={{ lineHeight: 1.6 }}>
            {stateChurches.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
            {stateChurches.length === 0 && <li className="sa-text-muted">None listed yet.</li>}
          </ul>
        </div>
      </div>
    );
  }

  return null;
}

function DetailItem({ label, value }) {
  return (
    <div>
      <div className="sa-text-muted sa-text-sm">{label}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{value}</div>
    </div>
  );
}
