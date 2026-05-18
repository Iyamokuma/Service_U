import { branchCountryLabel, branchStateLabel } from "./branchRegions.js";

function normUp(s) {
  return String(s ?? "").trim().toUpperCase();
}

function norm(s) {
  return String(s ?? "").trim();
}

export function stateKey(country, state) {
  return `${normUp(country)}:${normUp(state)}`;
}

export function satelliteKey(country, state, site) {
  return `${normUp(country)}:${normUp(state)}:${norm(site)}`;
}

function activeAdmin(admins, pred) {
  return (admins || []).find((a) => Number(a.is_active) === 1 && pred(a)) || null;
}

export function countryAdminFor(admins, countryCode) {
  const cc = normUp(countryCode);
  return activeAdmin(admins, (a) => a.role === "country_super_admin" && normUp(a.branch_country) === cc);
}

export function stateAdminFor(admins, countryCode, stateCode) {
  const cc = normUp(countryCode);
  const st = normUp(stateCode);
  return activeAdmin(
    admins,
    (a) => a.role === "state_super_admin" && normUp(a.branch_country) === cc && normUp(a.branch_state) === st,
  );
}

export function satelliteAdminFor(admins, countryCode, stateCode, siteName) {
  const cc = normUp(countryCode);
  const st = normUp(stateCode);
  const sat = norm(siteName);
  return activeAdmin(
    admins,
    (a) =>
      a.role === "satellite_church_admin" &&
      normUp(a.branch_country) === cc &&
      normUp(a.branch_state) === st &&
      norm(a.satellite_site) === sat,
  );
}

export function countLeadersInState(admins, countryCode, stateCode) {
  const cc = normUp(countryCode);
  const st = normUp(stateCode);
  return (admins || []).filter(
    (a) =>
      Number(a.is_active) === 1 &&
      normUp(a.branch_country) === cc &&
      normUp(a.branch_state) === st &&
      (a.role === "service_unit_leader" || a.role === "sub_unit_leader"),
  ).length;
}

export function satelliteMetaByChurch(satellites) {
  const m = new Map();
  for (const s of satellites || []) {
    const cc = normUp(s.branch_country);
    const st = normUp(s.branch_state);
    const name = norm(s.site_name);
    if (!cc || !st || !name) continue;
    m.set(`${cc}:${st}:${name.toLowerCase()}`, s);
  }
  return m;
}

export function buildAllRows(catalog) {
  const { churches, satellites, admins, stats } = catalog;
  const satMeta = satelliteMetaByChurch(satellites);
  return (churches || []).map((ch) => {
    const cc = normUp(ch.branch_country);
    const st = normUp(ch.branch_state);
    const name = norm(ch.name);
    const meta = satMeta.get(`${cc}:${st}:${name.toLowerCase()}`) || {};
    const countryAdmin = countryAdminFor(admins, cc);
    const branchAdmin = stateAdminFor(admins, cc, st);
    const satAdmin = satelliteAdminFor(admins, cc, st, name);
    return {
      kind: "church",
      id: ch.id,
      name,
      branch_country: cc,
      branch_state: st,
      continent: meta.continent || "",
      lga: meta.lga || "",
      is_active: Number(ch.is_active) === 1,
      countryLabel: branchCountryLabel(cc),
      stateLabel: branchStateLabel(cc, st),
      branchAdminName: branchAdmin?.full_name || stateAdminFor(admins, cc, st)?.full_name || "—",
      satelliteAdminName: satAdmin?.full_name || "—",
      countryAdminName: countryAdmin?.full_name || "—",
      members: stats?.membersBySatellite?.[satelliteKey(cc, st, name)] || 0,
    };
  });
}

export function buildCountryRows(catalog) {
  const { countries, states, admins, stats, churches } = catalog;
  const stateCountByCountry = new Map();
  for (const s of states || []) {
    const c = countries?.find((x) => Number(x.id) === Number(s.country_id));
    const cc = normUp(c?.branch_country_code);
    if (!cc) continue;
    stateCountByCountry.set(cc, (stateCountByCountry.get(cc) || 0) + 1);
  }
  const satCountByCountry = new Map();
  for (const ch of churches || []) {
    const cc = normUp(ch.branch_country);
    if (!cc) continue;
    satCountByCountry.set(cc, (satCountByCountry.get(cc) || 0) + 1);
  }

  return (countries || [])
    .map((c) => {
      const cc = normUp(c.branch_country_code);
      const countryAdmin = countryAdminFor(admins, cc);
      const satelliteAdmins = (admins || []).filter(
        (a) => a.role === "satellite_church_admin" && normUp(a.branch_country) === cc && Number(a.is_active) === 1,
      ).length;
      const primaryState = (states || []).find((s) => Number(s.country_id) === Number(c.id));
      return {
        kind: "country",
        code: cc,
        name: c.name,
        stateCount: stateCountByCountry.get(cc) || 0,
        stateLabel: primaryState?.name || (stateCountByCountry.get(cc) ? `${stateCountByCountry.get(cc)} states` : "—"),
        branchAdminName: countryAdmin?.full_name || "—",
        satelliteAdminCount: satelliteAdmins,
        satelliteCount: satCountByCountry.get(cc) || 0,
        members: stats?.membersByCountry?.[cc] || 0,
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function buildStateRows(catalog) {
  const { states, countries, churches, admins, stats } = catalog;
  const countryById = new Map((countries || []).map((c) => [Number(c.id), c]));
  const satCount = new Map();
  for (const ch of churches || []) {
    const k = stateKey(ch.branch_country, ch.branch_state);
    satCount.set(k, (satCount.get(k) || 0) + 1);
  }

  return (states || [])
    .map((s) => {
      const country = countryById.get(Number(s.country_id));
      const cc = normUp(country?.branch_country_code);
      const st = normUp(s.branch_state_code);
      const branchAdmin = stateAdminFor(admins, cc, st);
      return {
        kind: "state",
        branch_country: cc,
        branch_state: st,
        countryLabel: branchCountryLabel(cc),
        stateLabel: s.name || branchStateLabel(cc, st),
        satelliteCount: satCount.get(stateKey(cc, st)) || 0,
        unitLeaders: countLeadersInState(admins, cc, st),
        contact: branchAdmin?.email || branchAdmin?.full_name || "—",
        members: stats?.membersByState?.[stateKey(cc, st)] || 0,
      };
    })
    .sort((a, b) => {
      const ac = a.countryLabel.localeCompare(b.countryLabel);
      if (ac !== 0) return ac;
      return a.stateLabel.localeCompare(b.stateLabel);
    });
}

export function buildSatelliteRows(catalog) {
  const { satellites, churches, admins, stats } = catalog;
  const churchByKey = new Map();
  for (const ch of churches || []) {
    const cc = normUp(ch.branch_country);
    const st = normUp(ch.branch_state);
    const name = norm(ch.name);
    churchByKey.set(`${cc}:${st}:${name.toLowerCase()}`, ch);
  }
  return (satellites || [])
    .map((s) => {
      const cc = normUp(s.branch_country);
      const st = normUp(s.branch_state);
      const name = norm(s.site_name);
      const ch = churchByKey.get(`${cc}:${st}:${name.toLowerCase()}`);
      const satAdmin = satelliteAdminFor(admins, cc, st, name);
      return {
        kind: "satellite",
        id: s.id,
        churchId: ch?.id,
        name,
        branch_country: cc,
        branch_state: st,
        continent: norm(s.continent),
        lga: norm(s.lga),
        is_active: ch ? Number(ch.is_active) === 1 : Number(s.is_active) === 1,
        countryLabel: branchCountryLabel(cc),
        stateLabel: branchStateLabel(cc, st),
        pastorName: satAdmin?.full_name || "—",
        members: stats?.membersBySatellite?.[satelliteKey(cc, st, name)] ?? 0,
      };
    })
    .sort((a, b) => {
      const ac = a.countryLabel.localeCompare(b.countryLabel);
      if (ac !== 0) return ac;
      const st = a.stateLabel.localeCompare(b.stateLabel);
      if (st !== 0) return st;
      return a.name.localeCompare(b.name);
    });
}

export function uniqueContinents(satellites, churches) {
  const set = new Set();
  for (const s of satellites || []) {
    const c = norm(s.continent);
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
