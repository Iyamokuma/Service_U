import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { fetchAdminChurchesCatalog } from "../churchesCatalog.js";
import { hydrateBranchLabelsFromCatalog, hydrateBranchLabelsFromDirectoryStates } from "../branchRegions.js";

/**
 * Live directory countries/states + church branches for admin forms (scoped by role on the API).
 */
export function useAdminLocationCatalog({ enabled = true, refreshOnFocus = true } = {}) {
  const [churches, setChurches] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    Promise.all([
      fetchAdminChurchesCatalog()
        .then(setChurches)
        .catch(() => setChurches([])),
      api
        .catalogList()
        .then((r) => {
          setCatalog(r);
          hydrateBranchLabelsFromCatalog(r);
          const countries = r?.countries || [];
          return Promise.all(
            countries.map((c) => {
              const cc = String(c.branch_country_code || "").trim().toUpperCase();
              if (!cc) return Promise.resolve();
              return api
                .catalogStatesForCountry(cc)
                .then((res) => {
                  hydrateBranchLabelsFromDirectoryStates(cc, res?.states || []);
                })
                .catch(() => {});
            }),
          );
        })
        .catch(() => setCatalog(null)),
    ]).finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled || !refreshOnFocus) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      reload();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, refreshOnFocus, reload]);

  return { churches, catalog, loading, reload };
}
