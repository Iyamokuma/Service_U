import { useEffect, useMemo, useState, useCallback } from "react";
import { Field } from "../components/Field.jsx";
import { SearchableDropdown } from "../components/SearchableDropdown.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { branchCountryLabel, mergeStateOptions, hydrateBranchLabelsFromDirectoryCountries, hydrateBranchLabelsFromDirectoryStates } from "../admin/branchRegions.js";
import { fetchChurchesCatalog } from "../lib/churchesCatalog.js";
import { fetchDirectoryCountries, fetchDirectoryStates } from "../lib/directoryCatalog.js";

function norm(s) {
  return String(s ?? "").trim().toUpperCase();
}

/** Effective branch_state code for payloads (single-state countries). */
export function effectiveBranchStateForPayload(form) {
  const cc = norm(form.branchCountry);
  if (!cc) return "";
  const ctx = form.churchLocationCtx;
  if (ctx?.pending) return "";
  const codes = (ctx?.stateCodes || []).map((c) => norm(c)).filter(Boolean);
  if (codes.length <= 1) return codes[0] || "";
  return norm(form.branchState);
}

export function ChurchLocationSection({ form, set, setSilent, errors }) {
  const silent = setSilent || set;
  const [catalog, setCatalog] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [dirCountries, setDirCountries] = useState([]);
  const [dirStates, setDirStates] = useState([]);
  const [dirStatesLoading, setDirStatesLoading] = useState(false);
  const [dirErr, setDirErr] = useState("");

  const loadChurches = useCallback(() => {
    fetchChurchesCatalog()
      .then((rows) => {
        setCatalog(rows);
        setLoadErr("");
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

  const selectedDirCountry = useMemo(
    () => dirCountries.find((c) => norm(c.branch_country_code) === norm(form.branchCountry)),
    [dirCountries, form.branchCountry],
  );

  useEffect(() => {
    if (!selectedDirCountry?.id) {
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
  }, [selectedDirCountry?.id]);

  const countriesInCatalog = useMemo(
    () =>
      [...dirCountries]
        .filter((c) => norm(c.branch_country_code))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((c) => ({ code: norm(c.branch_country_code), name: c.name })),
    [dirCountries],
  );

  const stateList = useMemo(() => {
    const cc = norm(form.branchCountry);
    if (!cc) return [];
    const fromDir = dirStates.map((s) => ({ code: s.branch_state_code, name: s.name }));
    const fromChurches = catalog
      .filter((ch) => norm(ch.branch_country) === cc)
      .map((ch) => ({ code: ch.branch_state, name: ch.branch_state }));
    return mergeStateOptions(cc, fromDir, fromChurches);
  }, [dirStates, form.branchCountry, catalog]);

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
    if (!cc || !st || dirStatesLoading) return;
    loadChurches();
  }, [form.branchCountry, effectiveState, dirStatesLoading, loadChurches]);

  useEffect(() => {
    if (dirCountries.length) hydrateBranchLabelsFromDirectoryCountries(dirCountries);
  }, [dirCountries]);

  useEffect(() => {
    if (form.branchCountry && dirStates.length) {
      hydrateBranchLabelsFromDirectoryStates(form.branchCountry, dirStates);
    }
  }, [form.branchCountry, dirStates]);

  useEffect(() => {
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
  }, [form.branchCountry, stateList, silent, dirStatesLoading]);

  const churchesForPick = useMemo(() => {
    const cc = norm(form.branchCountry);
    const st = norm(effectiveState);
    if (!cc || !st) return [];
    return catalog
      .filter((c) => norm(c.branch_country) === cc && norm(c.branch_state) === st)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [catalog, form.branchCountry, effectiveState]);

  const churchOptions = useMemo(
    () =>
      churchesForPick.map((c) => ({
        value: String(c.id),
        label: String(c.name || "").trim() || "Unnamed branch",
        meta: String(c.address || "").trim(),
      })),
    [churchesForPick],
  );

  const stateOptions = useMemo(
    () => stateList.map((s) => ({ value: s.code, label: s.name })),
    [stateList],
  );

  const onCountryChange = (e) => {
    const v = e.target.value;
    set("branchCountry", v);
    set("branchState", "");
    set("churchId", "");
    set("satelliteSite", "");
  };

  const onStateChange = (code) => {
    set("branchState", code);
    set("churchId", "");
    set("satelliteSite", "");
  };

  const onChurchChange = (id) => {
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

  const stateLineLabel = useMemo(() => {
    const row = stateList.find((s) => norm(s.code) === norm(effectiveState));
    return row?.name || effectiveState;
  }, [stateList, effectiveState]);

  const noCountriesYet = !dirErr && dirCountries.length === 0;

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
            disabled={noCountriesYet}
          >
            <option value="">
              {noCountriesYet ? "No countries listed yet — check back soon" : "Select country"}
            </option>
            {countriesInCatalog.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {!singleStateMode && (
          <Field label="State / region" required error={errors.churchState} hint="State where your branch is located.">
            <SearchableDropdown
              value={form.branchState}
              onChange={onStateChange}
              options={stateOptions}
              disabled={!form.branchCountry || dirStatesLoading}
              placeholder={
                !form.branchCountry
                  ? "Select country first"
                  : dirStatesLoading
                    ? "Loading regions…"
                    : stateOptions.length
                      ? "Select"
                      : "No states listed for this country yet"
              }
              searchPlaceholder="Search state"
              emptyMessage="No states match your search"
              invalid={!!errors.churchState}
              valid={!!effectiveState && !errors.churchState}
              ariaLabel="State / region"
            />
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
          <SearchableDropdown
            value={form.churchId}
            onChange={onChurchChange}
            options={churchOptions}
            disabled={
              !form.branchCountry ||
              (!singleStateMode && !form.branchState) ||
              dirStatesLoading
            }
            placeholder={
              !form.branchCountry
                ? "Select country first"
                : !singleStateMode && !form.branchState
                  ? "Select state first"
                  : dirStatesLoading
                    ? "Loading regions…"
                    : churchOptions.length
                      ? "Select"
                      : "No branches listed for this area yet"
            }
            searchPlaceholder="Search by name or address"
            emptyMessage="No branches match your search"
            invalid={!!errors.churchSelect}
            valid={!!form.churchId && !errors.churchSelect}
            ariaLabel="Church / branch"
          />
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
        {noCountriesYet ? (
          <div className="field col-span-2 field-hint" role="status">
            Church locations are being set up. Please try again later or contact the office.
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

  if (ctx?.pending) {
    e.churchState = "Loading regions for this country…";
    return e;
  }
  const codes = (ctx?.stateCodes || []).map((c) => norm(c)).filter(Boolean);
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

  if (!String(form.churchId || "").trim()) e.churchSelect = "Select your church / branch from the list.";
  return e;
}
