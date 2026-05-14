import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";

function norm(s) {
  return String(s ?? "").trim();
}

function normUp(s) {
  return norm(s).toUpperCase();
}

export function BranchCatalog() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [churches, setChurches] = useState([]);

  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryCode, setNewCountryCode] = useState("");

  const [stateCountryId, setStateCountryId] = useState("");
  const [newStateName, setNewStateName] = useState("");
  const [newStateCode, setNewStateCode] = useState("");

  const [chCountry, setChCountry] = useState("");
  const [chState, setChState] = useState("");
  const [chStateDisplay, setChStateDisplay] = useState("");
  const [chName, setChName] = useState("");
  const [chAddress, setChAddress] = useState("");

  const [churchFilter, setChurchFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.catalogList();
      setCountries(r.countries || []);
      setStates(r.states || []);
      setChurches(r.churches || []);
    } catch (e) {
      toast(e.message || "Could not load catalog.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const statesByCountry = useMemo(() => {
    const m = new Map();
    for (const s of states) {
      const cid = Number(s.country_id);
      if (!Number.isFinite(cid)) continue;
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push(s);
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    return m;
  }, [states]);

  const filteredChurches = useMemo(() => {
    const q = churchFilter.trim().toLowerCase();
    let rows = churches;
    if (q) {
      rows = rows.filter(
        (c) =>
          String(c.name || "").toLowerCase().includes(q) ||
          String(c.address || "").toLowerCase().includes(q) ||
          String(c.branch_country || "").toLowerCase().includes(q) ||
          String(c.branch_state || "").toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => {
      const ac = String(a.branch_country || "").localeCompare(String(b.branch_country || ""));
      if (ac !== 0) return ac;
      const as = String(a.branch_state || "").localeCompare(String(b.branch_state || ""));
      if (as !== 0) return as;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [churches, churchFilter]);

  const addCountry = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.catalogAddCountry({
        name: norm(newCountryName),
        branch_country_code: normUp(newCountryCode),
      });
      toast("Country added.", "success");
      setNewCountryName("");
      setNewCountryCode("");
      await load();
    } catch (err) {
      toast(err.message || "Could not add country.", "error");
    } finally {
      setBusy(false);
    }
  };

  const addState = async (e) => {
    e.preventDefault();
    const country_id = Number(stateCountryId);
    setBusy(true);
    try {
      await api.catalogAddState({
        country_id,
        branch_state_code: normUp(newStateCode),
        state_name: norm(newStateName) || normUp(newStateCode),
      });
      toast("State / region added.", "success");
      setNewStateName("");
      setNewStateCode("");
      await load();
    } catch (err) {
      toast(err.message || "Could not add state.", "error");
    } finally {
      setBusy(false);
    }
  };

  const addChurch = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.catalogAddChurch({
        branch_country: normUp(chCountry),
        branch_state: normUp(chState),
        name: norm(chName),
        address: norm(chAddress),
        state_display_name: norm(chStateDisplay) || undefined,
      });
      toast("Church / branch saved.", "success");
      setChName("");
      setChAddress("");
      setChStateDisplay("");
      await load();
    } catch (err) {
      toast(err.message || "Could not save church.", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleChurch = async (row, nextActive) => {
    setBusy(true);
    try {
      await api.catalogSetChurchActive(row.id, nextActive);
      toast(nextActive ? "Branch reactivated." : "Branch hidden from public form.", "success");
      await load();
    } catch (err) {
      toast(err.message || "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeChurch = async (row) => {
    if (!window.confirm(`Delete “${row.name}” from the directory? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.catalogDeleteChurch(row.id);
      toast("Church removed.", "success");
      await load();
    } catch (err) {
      toast(err.message || "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-spinner" />
        <span>Loading catalog…</span>
      </div>
    );
  }

  const countryOptions = [...countries].sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return (
    <div className="sa-card">
      <div className="sa-card-body">
        <p className="sa-text-sm sa-text-muted" style={{ maxWidth: 720, lineHeight: 1.55, marginBottom: 20 }}>
          Add countries, states or regions, and churches so they appear on the public registration form. Use short
          uppercase codes (for example <code>GH</code> for country, <code>ASH</code> for a state) so they match branch
          filters in the admin queue.
        </p>

        <div className="sa-form-row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <form onSubmit={addCountry} style={{ flex: "1 1 260px", minWidth: 0 }}>
            <h3 style={{ margin: "0 0 10px" }}>Add country</h3>
            <div className="sa-field">
              <label className="sa-label">Display name</label>
              <input
                className="sa-input"
                value={newCountryName}
                onChange={(e) => setNewCountryName(e.target.value)}
                placeholder="e.g. Ghana"
                required
              />
            </div>
            <div className="sa-field">
              <label className="sa-label">Branch code (2–8 letters)</label>
              <input
                className="sa-input"
                value={newCountryCode}
                onChange={(e) => setNewCountryCode(e.target.value.toUpperCase())}
                placeholder="GH"
                maxLength={8}
                required
              />
            </div>
            <button className="sa-btn sa-btn-primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
              Add country
            </button>
          </form>

          <form onSubmit={addState} style={{ flex: "1 1 280px", minWidth: 0 }}>
            <h3 style={{ margin: "0 0 10px" }}>Add state / region</h3>
            <div className="sa-field">
              <label className="sa-label">Country</label>
              <select
                className="sa-field-select"
                value={stateCountryId}
                onChange={(e) => setStateCountryId(e.target.value)}
                required
              >
                <option value="">Select country</option>
                {countryOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} ({c.branch_country_code || "—"})
                  </option>
                ))}
              </select>
            </div>
            <div className="sa-field">
              <label className="sa-label">State name</label>
              <input
                className="sa-input"
                value={newStateName}
                onChange={(e) => setNewStateName(e.target.value)}
                placeholder="Ashanti Region"
              />
            </div>
            <div className="sa-field">
              <label className="sa-label">State code (1–12 A–Z / 0–9)</label>
              <input
                className="sa-input"
                value={newStateCode}
                onChange={(e) => setNewStateCode(e.target.value.toUpperCase())}
                placeholder="ASH"
                maxLength={12}
                required
              />
            </div>
            <button className="sa-btn sa-btn-primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
              Add state
            </button>
          </form>

          <form onSubmit={addChurch} style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h3 style={{ margin: "0 0 10px" }}>Add church / branch</h3>
            <div className="sa-form-row">
              <div className="sa-field" style={{ flex: 1 }}>
                <label className="sa-label">Country code</label>
                <input
                  className="sa-input"
                  value={chCountry}
                  onChange={(e) => setChCountry(e.target.value.toUpperCase())}
                  placeholder="GH"
                  required
                />
              </div>
              <div className="sa-field" style={{ flex: 1 }}>
                <label className="sa-label">State code</label>
                <input
                  className="sa-input"
                  value={chState}
                  onChange={(e) => setChState(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>
            <div className="sa-field">
              <label className="sa-label">State display name (if new state)</label>
              <input
                className="sa-input"
                value={chStateDisplay}
                onChange={(e) => setChStateDisplay(e.target.value)}
                placeholder="Optional — used when the state row is created automatically"
              />
            </div>
            <div className="sa-field">
              <label className="sa-label">Church / branch name</label>
              <input className="sa-input" value={chName} onChange={(e) => setChName(e.target.value)} required />
            </div>
            <div className="sa-field">
              <label className="sa-label">Address</label>
              <input className="sa-input" value={chAddress} onChange={(e) => setChAddress(e.target.value)} />
            </div>
            <button className="sa-btn sa-btn-primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
              Save church
            </button>
          </form>
        </div>

        <h3 style={{ margin: "8px 0 10px" }}>Countries ({countries.length})</h3>
        <div style={{ overflowX: "auto", marginBottom: 24, maxHeight: 220, border: "1px solid var(--sa-border, #e5e7eb)", borderRadius: 8 }}>
          <table className="sa-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>States</th>
              </tr>
            </thead>
            <tbody>
              {countryOptions.map((c) => (
                <tr key={c.id}>
                  <td>{c.branch_country_code || "—"}</td>
                  <td>{c.name}</td>
                  <td>{(statesByCountry.get(Number(c.id)) || []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ margin: "8px 0 10px" }}>Churches</h3>
        <div className="sa-field" style={{ maxWidth: 400, marginBottom: 10 }}>
          <input
            className="sa-input"
            placeholder="Filter by name, address, country, state…"
            value={churchFilter}
            onChange={(e) => setChurchFilter(e.target.value)}
          />
        </div>
        <div style={{ overflowX: "auto", maxHeight: 420, border: "1px solid var(--sa-border, #e5e7eb)", borderRadius: 8 }}>
          <table className="sa-table" style={{ margin: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th>Country</th>
                <th>State</th>
                <th>Name</th>
                <th>Active</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChurches.map((c) => (
                <tr key={c.id}>
                  <td>{c.branch_country}</td>
                  <td>{c.branch_state}</td>
                  <td>{c.name}</td>
                  <td>{Number(c.is_active) === 1 ? "Yes" : "No"}</td>
                  <td>
                    <button
                      type="button"
                      className="sa-btn"
                      style={{ padding: "4px 8px", fontSize: 12, marginRight: 6 }}
                      disabled={busy}
                      onClick={() => toggleChurch(c, Number(c.is_active) === 1 ? 0 : 1)}
                    >
                      {Number(c.is_active) === 1 ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      className="sa-btn"
                      style={{ padding: "4px 8px", fontSize: 12 }}
                      disabled={busy}
                      onClick={() => removeChurch(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="sa-btn" style={{ marginTop: 14 }} disabled={busy} onClick={() => load()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
