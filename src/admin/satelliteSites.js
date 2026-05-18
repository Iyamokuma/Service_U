/** Unique satellite church names in a branch, from public.churches catalog rows. */
export function satelliteSitesForBranch(churches, branchCountry, branchState) {
  const cc = String(branchCountry || "").trim().toUpperCase();
  const st = String(branchState || "").trim().toUpperCase();
  if (!cc || !st) return [];
  const names = new Set();
  for (const ch of churches || []) {
    if (String(ch.branch_country || "").toUpperCase() !== cc) continue;
    if (String(ch.branch_state || "").toUpperCase() !== st) continue;
    const n = String(ch.name || "").trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
