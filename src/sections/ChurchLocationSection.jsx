import { useEffect, useMemo, useState, useCallback } from "react";
import { Field } from "../components/Field.jsx";
import { SectionHead } from "./SectionHead.jsx";
import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStatesForCountry,
  branchStateLabel,
  isStateValidForCountry,
} from "../admin/branchRegions.js";
import { fetchChurchesCatalog } from "../lib/churchesCatalog.js";
import { fetchDirectoryCountries, fetchDirectoryStates } from "../lib/directoryCatalog.js";

function norm(s) {
  return String(s ?? "").trim().toUpperCase();
}

/** Effective branch_state code for payloads (single-state countries, directory vs legacy). */
export function effectiveBranchStateForPayload(form) {
  const cc = norm(form.branchCountry);
  if (!cc) return "";
  const ctx = form.churchLocationCtx;
  if (ctx?.source === "directory") {
    if (ctx.pending) return "";
    const codes = (ctx.stateCodes || []).map((c) => norm(c)).filter(Boolean);
    if (codes.length <= 1) return codes[0] || "";
    return norm(form.branchState);
  }
  const states = branchStatesForCountry(form.branchCountry);
  const single = states.length <= 1;
  return single ? norm(states[0]?.code || "") : norm(form.branchState);
}

export function ChurchLocationSection({ form, set, setSilent, errors }) {
  const silent = setSilent || set;
  const [catalog, setCatalog] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [churchFilter, setChurchFilter] = useState("");

  const [dirCountries, setDirCountries] = useState([]);
  const [dirStates, setDirStates] = useState([]);
  const [dirStatesLoading, setDirStatesLoading] = useState(false);
  const [dirErr, setDirErr] = useState("");

  const loadChurches = useCallback(() => {
    fetchChurchesCatalog()
      .then((rows) => {
        setCatalog(rows);
        setLoadErr(rows.length ? "" : "");
      })
      .catch(() => {
        setCatalog([]);
        setLoadErr("Could not load the church list. Check your connection and Supabase settings.");
      });
  }, []);

  useEffect(() => {
    loadChurches();
  }, [loadChurches]);

  const reloadDirectoryCountries = useCallback(() => {
    fetchDirectoryCountries()
      .then((rows) => {
        setDirCountries(rows);
        setDirErr("");
      })
      .catch(() => {
        setDirCountries([]);
        setDirErr("Could not load country directory from the server.");
      });
  }, []);

  useEffect(() => {
    reloadDirectoryCountries();
  }, [reloadDirectoryCountries]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      loadChurches();
      reloadDirectoryCountries();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadChurches, reloadDirectoryCountries]);

  const useDirectory = dirCountries.length > 0;

  const selectedDirCountry = useMemo(
    () => dirCountries.find((c) => norm(c.branch_country_code) === norm(form.branchCountry)),
    [dirCountries, form.branchCountry],
  );

  useEffect(() => {
    if (!useDirectory || !selectedDirCountry?.id) {
      setDirStates([]);
      setDirStatesLoading(false);
      return;
    }
    let cancelled = false;
    setDirStatesLoading(true);
    fetchDirectoryStates(selectedDirCountry.id)
      .then((rows) => {
        if (!cancelled) {
          setDirStates(rows);
          setDirStatesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDirStates([]);
          setDirStatesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [useDirectory, selectedDirCountry?.id]);

  const countriesInCatalog = useMemo(() => {
    if (useDirectory) {
      return [...dirCountries]
        .filter((c) => norm(c.branch_country_code))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((c) => ({ code: norm(c.branch_country_code), name: c.name }));
    }
    const codes = new Set(catalog.map((c) => norm(c.branch_country)));
    return [...BRANCH_COUNTRIES]
      .filter((c) => codes.has(norm(c.code)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, dirCountries, useDirectory]);

  const stateList = useMemo(() => {
    const byCode = new Map();
    const cc = norm(form.branchCountry);

    if (useDirectory) {
      for (const s of dirStates) {
        const code = norm(s.branch_state_code);
        if (!code) continue;
        byCode.set(code, { code, name: s.name || s.branch_state_code });
      }
    }

    if (cc) {
      for (const ch of catalog) {
        if (norm(ch.branch_country) !== cc) continue;
        const code = norm(ch.branch_state);
        if (!code || byCode.has(code)) continue;
        byCode.set(code, { code, name: branchStateLabel(cc, code) || code });
      }
    }

    for (const s of branchStatesForCountry(form.branchCountry)) {
      const code = norm(s.code);
      if (!code || byCode.has(code)) continue;
      byCode.set(code, { code, name: s.name });
    }

    return [...byCode.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [useDirectory, dirStates, form.branchCountry, catalog]);

  const singleStateMode = stateList.length <= 1;

  useEffect(() => {
    if (!form.branchCountry) return;
    if (stateList.length === 1 && stateList[0]?.code && form.branchState !== stateList[0].code) {
      set("branchState", stateList[0].code);
    }
  }, [form.branchCountry, form.branchState, stateList, set]);

  const effectiveState = singleStateMode ? stateList[0]?.code || "" : form.branchState;

  useEffect(() => {
    const cc = norm(form.branchCountry);
    const st = norm(effectiveState);
    if (!cc || !st || (useDirectory && dirStatesLoading)) return;
    loadChurches();
  }, [form.branchCountry, effectiveState, useDirectory, dirStatesLoading, loadChurches]);

  useEffect(() => {
    if (!norm(form.branchCountry)) return;
    reloadDirectoryCountries();
  }, [form.branchCountry, reloadDirectoryCountries]);

  useEffect(() => {
    if (!useDirectory) {
      silent("churchLocationCtx", form.branchCountry ? { source: "legacy" } : null);
      return;
    }
    if (!form.branchCountry) {
      silent("churchLocationCtx", null);
      return;
    }
    const codes = stateList.map((s) => norm(s.code)).filter(Boolean);
    silent("churchLocationCtx", {
      source: "directory",
      stateCodes: codes,
      pending: dirStatesLoading,
    });
  }, [form.branchCountry, stateList, useDirectory, silent, dirStatesLoading]);

  const churchesForPick = useMemo(() => {
    const cc = norm(form.branchCountry);
    const st = norm(effectiveState);
    if (!cc || !st) return [];
    let rows = catalog.filter((c) => norm(c.branch_country) === cc && norm(c.branch_state) === st);
    const q = churchFilter.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          String(c.name || "").toLowerCase().includes(q) || String(c.address || "").toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [catalog, form.branchCountry, effectiveState, churchFilter]);

  const onCountryChange = (e) => {
    const v = e.target.value;
    set("branchCountry", v);
    set("branchState", "");
    set("churchId", "");
    set("satelliteSite", "");
    setChurchFilter("");
  };

  const onStateChange = (e) => {
    set("branchState", e.target.value);
    set("churchId", "");
    set("satelliteSite", "");
    setChurchFilter("");
  };

  const onChurchChange = (e) => {
    const id = e.target.value;
    if (!id) {
      set("churchId", "");
      set("satelliteSite", "");
      return;
    }
    const row = catalog.find((c) => String(c.id) === String(id));
    if (!row) return;
    set("churchId", id);
    set("branchCountry", norm(row.branch_country));
    set("branchState", norm(row.branch_state));
    set("satelliteSite", String(row.name || "").trim());
  };

  const selectState = errors.churchState ? "error" : effectiveState ? "valid" : undefined;
  const selectChurch = errors.churchSelect ? "error" : form.churchId ? "valid" : undefined;

  const stateLineLabel = useMemo(() => {
    const row = stateList.find((s) => norm(s.code) === norm(effectiveState));
    if (row?.name) return row.name;
    return branchStateLabel(form.branchCountry, effectiveState);
  }, [stateList, form.branchCountry, effectiveState]);

  return (
    <section className="section">
      <SectionHead
        num="03"
        title="Your church / branch"
        desc="Select the country and branch where you fellowship. Leaders in that state will receive your application together with your chosen service unit."
      />
      <div className="grid">
        <Field label="Country" required error={errors.churchCountry} hint="Where your branch is located.">
          <select
            className="select"
            value={form.branchCountry}
            onChange={onCountryChange}
            aria-invalid={!!errors.churchCountry}
            data-state={errors.churchCountry ? "error" : undefined}
          >
            <option value="">Select country</option>
            {countriesInCatalog.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {!singleStateMode && (
          <Field label="State / region" required error={errors.churchState} hint="State where your branch is located.">
            <select
              className="select"
              value={form.branchState}
              onChange={onStateChange}
              disabled={!form.branchCountry}
              aria-invalid={!!errors.churchState}
              data-state={selectState}
            >
              <option value="">{form.branchCountry ? "Select state" : "Select country first"}</option>
              {stateList.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label="Church / branch"
          required
          error={errors.churchSelect}
          span="2"
          hint={
            singleStateMode && form.branchCountry
              ? `Showing branches in ${branchCountryLabel(form.branchCountry)}.`
              : "Pick the branch name as listed in the directory."
          }
        >
          <input
            type="search"
            className="input"
            placeholder="Filter by name or address…"
            value={churchFilter}
            onChange={(e) => setChurchFilter(e.target.value)}
            disabled={!form.branchCountry || (!singleStateMode && !form.branchState)}
            style={{ marginBottom: 8 }}
            aria-label="Filter churches"
          />
          <select
            className="select"
            value={form.churchId}
            onChange={onChurchChange}
            disabled={
              !form.branchCountry ||
              (!singleStateMode && !form.branchState) ||
              (useDirectory && dirStatesLoading)
            }
            data-state={selectChurch}
          >
            <option value="">
              {!form.branchCountry
                ? "Select country first"
                : !singleStateMode && !form.branchState
                  ? "Select state first"
                  : churchesForPick.length
                    ? "Select your church / branch"
                    : "No branches found for this area"}
            </option>
            {churchesForPick.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
                {c.address ? ` — ${c.address.slice(0, 80)}${c.address.length > 80 ? "…" : ""}` : ""}
              </option>
            ))}
          </select>
        </Field>

        {form.churchId && form.satelliteSite && (
          <div className="field col-span-2">
            <div className="field-hint" style={{ marginTop: -4 }}>
              Selected: <strong>{form.satelliteSite}</strong>
              {effectiveState ? (
                <>
                  {" "}
                  · {stateLineLabel}
                </>
              ) : null}
            </div>
          </div>
        )}

        {loadErr ? (
          <div className="field col-span-2 error-msg" role="alert">
            {loadErr}
          </div>
        ) : null}
        {dirErr ? (
          <div className="field col-span-2 error-msg" role="alert">
            {dirErr}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Validation helpers for App.jsx */
export function validateChurchLocation(form) {
  const e = {};
  if (!norm(form.branchCountry)) e.churchCountry = "Select the country where your branch is located.";
  const ctx = form.churchLocationCtx;
  const cc = norm(form.branchCountry);

  if (ctx?.source === "directory") {
    if (ctx.pending) {
      e.churchState = "Loading regions for this country…";
      return e;
    }
    const codes = (ctx.stateCodes || []).map((c) => norm(c)).filter(Boolean);
    if (cc && codes.length === 0) {
      e.churchState = "No states or regions are listed for this country yet. Please contact the office.";
    }
    const single = codes.length <= 1;
    const st = single ? codes[0] || "" : norm(form.branchState);
    if (cc && !single && !norm(form.branchState)) {
      e.churchState = "Select the state / region for your branch.";
    }
    if (cc && st && codes.length > 0 && !codes.includes(norm(st))) {
      e.churchState = "State does not match the selected country.";
    }
  } else {
    const states = branchStatesForCountry(form.branchCountry);
    const single = states.length <= 1;
    const st = single ? states[0]?.code || "" : norm(form.branchState);
    if (cc && !single && !norm(form.branchState)) {
      e.churchState = "Select the state / region for your branch.";
    }
    if (cc && st && !isStateValidForCountry(form.branchCountry, st)) {
      e.churchState = "State does not match the selected country.";
    }
  }

  if (!String(form.churchId || "").trim()) e.churchSelect = "Select your church / branch from the list.";
  return e;
}
