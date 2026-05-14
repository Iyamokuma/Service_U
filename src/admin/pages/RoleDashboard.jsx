import { useAdminAuth } from "../AdminContext.jsx";

const SATELLITE_COPY = {
  title: "Satellite pastor workspace",
  body: "Manage registrations for your branch, appoint service unit and sub-unit leaders, request new ministry units for Super Admin approval, and send announcements scoped to your satellite.",
};

export function RoleDashboard({ setPage }) {
  const { admin } = useAdminAuth();

  if (admin?.role === "data_entry_admin") {
    return (
      <div className="sa-card sa-data-entry-home">
        <div className="sa-card-head">
          <span className="sa-card-title">Data entry</span>
        </div>
        <div className="sa-card-body">
          <div className="sa-de-hero">
            <p className="sa-text-muted sa-text-sm" style={{ lineHeight: 1.6, margin: 0 }}>
              Populate the system with new church locations. Geography comes from the public directory (continent
              through LGA). You type satellite church names. Each proposal is reviewed by a Super Admin or General Admin
              before sites go live.
            </p>
            <div className="sa-de-actions">
              <button type="button" className="sa-btn sa-btn-primary" onClick={() => setPage?.("data-locations")}>
                Propose new location
              </button>
              <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("queue")}>
                Application queue
              </button>
              <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("requests")}>
                My requests
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (admin?.role === "satellite_church_admin") {
    return (
      <div className="sa-card sa-data-entry-home">
        <div className="sa-card-head">
          <span className="sa-card-title">{SATELLITE_COPY.title}</span>
        </div>
        <div className="sa-card-body">
          <div className="sa-de-hero">
            <p className="sa-text-muted sa-text-sm" style={{ lineHeight: 1.6, margin: 0 }}>
              {SATELLITE_COPY.body}
            </p>
            <div className="sa-de-actions">
              <button type="button" className="sa-btn sa-btn-primary" onClick={() => setPage?.("oversight")}>
                Registrations &amp; filters
              </button>
              <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("admins")}>
                Team leaders
              </button>
              <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("unit-request")}>
                Request service unit
              </button>
              <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("announcements")}>
                Announcements
              </button>
              <button type="button" className="sa-btn sa-btn-outline" onClick={() => setPage?.("requests")}>
                My requests
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-card">
      <div className="sa-card-head">
        <span className="sa-card-title">Dashboard</span>
      </div>
      <div className="sa-card-body">
        <p className="sa-text-muted sa-text-sm" style={{ maxWidth: 560, lineHeight: 1.55 }}>
          Content for this role will be added here.
        </p>
      </div>
    </div>
  );
}
