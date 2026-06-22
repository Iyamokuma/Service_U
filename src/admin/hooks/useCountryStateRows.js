import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { hydrateBranchLabelsFromDirectoryStates } from "../branchRegions.js";
import { statesForCountryPicker } from "../catalogGeoOptions.js";
import { useAdminLocationCatalog } from "./useAdminLocationCatalog.js";

/**
 * Directory-backed state/region rows for admin pickers (full names, codes stored internally).
 */
export function useCountryStateRows(countryCode, { enabled = true } = {}) {
  const cc = String(countryCode || "").trim().toUpperCase();
  const active = enabled && !!cc;
  const { churches, catalog, loading: catalogLoading } = useAdminLocationCatalog({ enabled: active });
  const [directoryStates, setDirectoryStates] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  useEffect(() => {
    if (!active) {
      setDirectoryStates([]);
      setDirectoryLoading(false);
      return;
    }
    let cancelled = false;
    setDirectoryLoading(true);
    api
      .catalogStatesForCountry(cc)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res?.states) ? res.states : [];
        hydrateBranchLabelsFromDirectoryStates(cc, rows);
        setDirectoryStates(rows);
      })
      .catch(() => {
        if (!cancelled) setDirectoryStates([]);
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, cc]);

  const stateRows = useMemo(
    () => (active ? statesForCountryPicker(cc, { catalog, churches, directoryStates }) : []),
    [active, cc, catalog, churches, directoryStates],
  );

  return {
    stateRows,
    loading: catalogLoading || directoryLoading,
    churches,
    catalog,
    directoryStates,
  };
}
