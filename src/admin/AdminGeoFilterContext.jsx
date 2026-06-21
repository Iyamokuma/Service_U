import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { fetchAdminChurchesCatalog } from "./churchesCatalog.js";
import { countriesFromCatalog, statesFromCatalogAndChurches } from "./catalogGeoOptions.js";
import { hydrateBranchLabelsFromCatalog } from "./branchRegions.js";
import { geoFilterApiParams, hasGeoFilters, satelliteOptionsForGeoFilter } from "./geoFilterUtils.js";
import { isGlobalAdminRole } from "./roles.js";

const AdminGeoFilterContext = createContext(null);

const EMPTY = {
  enabled: false,
  filters: { country: "", state: "", satellite: "" },
  apiParams: {},
  hasFilters: false,
  churches: [],
  countryOptions: [],
  stateOptions: [],
  satelliteOptions: [],
  setCountry: () => {},
  setState: () => {},
  setSatellite: () => {},
  clear: () => {},
};

export function useAdminGeoFilters() {
  return useContext(AdminGeoFilterContext) || EMPTY;
}

export function AdminGeoFilterProvider({ admin, children }) {
  const enabled = isGlobalAdminRole(admin?.role);
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [satellite, setSatellite] = useState("");
  const [churches, setChurches] = useState([]);
  const [catalog, setCatalog] = useState(null);

  const reloadCatalog = useCallback(() => {
    if (!enabled) return;
    fetchAdminChurchesCatalog().then(setChurches).catch(() => setChurches([]));
    api
      .catalogList()
      .then((r) => {
        setCatalog(r);
        hydrateBranchLabelsFromCatalog(r);
      })
      .catch(() => setCatalog(null));
  }, [enabled]);

  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      reloadCatalog();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, reloadCatalog]);

  const clear = useCallback(() => {
    setCountry("");
    setState("");
    setSatellite("");
  }, []);

  const setCountrySafe = useCallback((code) => {
    setCountry(code);
    setState("");
    setSatellite("");
  }, []);

  const setStateSafe = useCallback((code) => {
    setState(code);
    setSatellite("");
  }, []);

  const filters = useMemo(
    () => ({ country, state, satellite }),
    [country, state, satellite],
  );

  const value = useMemo(
    () => ({
      enabled,
      filters,
      apiParams: geoFilterApiParams(filters),
      hasFilters: hasGeoFilters(filters),
      churches,
      catalog,
      countryOptions: countriesFromCatalog(catalog || { countries: [] }),
      stateOptions: country
        ? statesFromCatalogAndChurches(catalog, country, churches).map((s) => ({
            value: s.code,
            label: s.name,
          }))
        : [],
      satelliteOptions:
        country && state ? satelliteOptionsForGeoFilter(churches, country, state) : [],
      country,
      state,
      satellite,
      setCountry: setCountrySafe,
      setState: setStateSafe,
      setSatellite,
      clear,
    }),
    [
      enabled,
      filters,
      churches,
      catalog,
      country,
      state,
      satellite,
      setCountrySafe,
      setStateSafe,
      clear,
    ],
  );

  return <AdminGeoFilterContext.Provider value={value}>{children}</AdminGeoFilterContext.Provider>;
}
