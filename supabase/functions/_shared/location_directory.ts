import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  branchCountryCodeFromIso2,
  branchStateCodeForLocationPublish,
  resolveStateCodeByName,
} from "./branch_regions.ts";

function norm(s: unknown): string {
  return String(s ?? "").trim();
}
function normUp(s: unknown): string {
  return norm(s).toUpperCase();
}

export type DirectoryCountryRow = { id: number; branch_country_code: string };
export type DirectoryStateRow = { id: number; branch_state_code: string };

/** Prefer an existing directory_countries row (by code or display name) — never duplicate Nigeria, UK, etc. */
export async function resolveExistingDirectoryCountry(
  supabase: SupabaseClient,
  opts: { iso2?: string; branchCountryCode?: string; countryName?: string },
): Promise<DirectoryCountryRow | null> {
  const fromIso = branchCountryCodeFromIso2(opts.iso2);
  const codeWanted = fromIso || normUp(opts.branchCountryCode);
  const nameLower = norm(opts.countryName).toLowerCase();

  const { data: rows, error } = await supabase.from("directory_countries").select("id,name,branch_country_code");
  if (error) throw new Error(error.message);
  const list = rows || [];

  if (codeWanted) {
    const byCode = list.find((r) => normUp(r.branch_country_code) === codeWanted);
    if (byCode) {
      return { id: Number(byCode.id), branch_country_code: normUp(byCode.branch_country_code) || codeWanted };
    }
  }

  if (nameLower) {
    for (const r of list) {
      if (norm(r.name).toLowerCase() === nameLower) {
        const code = normUp(r.branch_country_code) || codeWanted;
        if (code) return { id: Number(r.id), branch_country_code: code };
      }
    }
  }

  return null;
}

/** Prefer an existing directory_states row (same country) so approvals never duplicate Abia, etc. */
export async function resolveExistingDirectoryState(
  supabase: SupabaseClient,
  countryId: number,
  branchCountryCode: string,
  payloadStateName: string,
): Promise<DirectoryStateRow | null> {
  const raw = String(payloadStateName ?? "").trim();
  if (!raw) return null;
  const { data: rows } = await supabase
    .from("directory_states")
    .select("id,name,branch_state_code")
    .eq("country_id", countryId);
  const list = rows || [];
  const rawUp = normUp(raw);
  const byExactCode = list.find((r) => normUp(r.branch_state_code) === rawUp);
  if (byExactCode && String(byExactCode.branch_state_code ?? "").trim()) {
    return { id: Number(byExactCode.id), branch_state_code: normUp(byExactCode.branch_state_code) };
  }

  const lower = raw.toLowerCase();
  const stripped = lower.replace(/\s+state\s*$/i, "").replace(/\s+province\s*$/i, "").trim();

  const catalogCode = resolveStateCodeByName(branchCountryCode, raw);
  if (catalogCode) {
    const cc = normUp(catalogCode);
    const byCode = list.find((r) => normUp(r.branch_state_code) === cc);
    if (byCode && String(byCode.branch_state_code ?? "").trim()) {
      return { id: Number(byCode.id), branch_state_code: normUp(byCode.branch_state_code) };
    }
  }

  for (const r of list) {
    const n = String(r.name ?? "").trim().toLowerCase();
    if (!n) continue;
    const nStripped = n.replace(/\s+state\s*$/i, "").replace(/\s+province\s*$/i, "").trim();
    if (n === lower || n === stripped || nStripped === stripped || nStripped === lower) {
      const code = String(r.branch_state_code ?? "").trim();
      if (code) return { id: Number(r.id), branch_state_code: normUp(code) };
    }
  }

  if (stripped.length >= 4) {
    for (const r of list) {
      const n = String(r.name ?? "").trim().toLowerCase().replace(/\s+state\s*$/i, "").trim();
      if (n.length < 3) continue;
      if (n.startsWith(stripped) || stripped.startsWith(n)) {
        const code = String(r.branch_state_code ?? "").trim();
        if (code) return { id: Number(r.id), branch_state_code: normUp(code) };
      }
    }
  }

  const slug = branchStateCodeForLocationPublish(branchCountryCode, raw);
  const su = normUp(slug);
  const bySlug = list.find((r) => normUp(r.branch_state_code) === su);
  if (bySlug && String(bySlug.branch_state_code ?? "").trim()) {
    return { id: Number(bySlug.id), branch_state_code: normUp(bySlug.branch_state_code) };
  }

  return null;
}

export async function ensureDirectoryCountry(
  supabase: SupabaseClient,
  nextIntPk: (table: string) => Promise<number>,
  opts: { iso2?: string; countryName?: string },
): Promise<DirectoryCountryRow> {
  const bc = branchCountryCodeFromIso2(opts.iso2);
  if (!bc) throw new Error("Unknown or invalid country ISO code.");
  const countryDisplay = norm(opts.countryName) || bc;

  const existing = await resolveExistingDirectoryCountry(supabase, {
    iso2: opts.iso2,
    branchCountryCode: bc,
    countryName: countryDisplay,
  });
  if (existing) {
    if (!normUp(existing.branch_country_code)) {
      await supabase.from("directory_countries").update({ branch_country_code: bc }).eq("id", existing.id);
    }
    return { id: existing.id, branch_country_code: bc };
  }

  const cid = await nextIntPk("directory_countries");
  const { error: ce } = await supabase.from("directory_countries").insert({
    id: cid,
    name: countryDisplay,
    branch_country_code: bc,
  });
  if (ce) throw new Error(ce.message);
  return { id: cid, branch_country_code: bc };
}

export async function ensureDirectoryState(
  supabase: SupabaseClient,
  nextIntPk: (table: string) => Promise<number>,
  countryId: number,
  branchCountryCode: string,
  stateName: string,
): Promise<DirectoryStateRow & { displayName: string }> {
  const matched = await resolveExistingDirectoryState(supabase, countryId, branchCountryCode, stateName);
  if (matched) {
    return { ...matched, displayName: norm(stateName) || matched.branch_state_code };
  }
  const st = branchStateCodeForLocationPublish(branchCountryCode, stateName);
  const sid = await nextIntPk("directory_states");
  const displayName = norm(stateName) || st;
  const { error: se } = await supabase.from("directory_states").insert({
    id: sid,
    country_id: countryId,
    name: displayName,
    branch_state_code: st,
  });
  if (se) throw new Error(se.message);
  return { id: sid, branch_state_code: st, displayName };
}

/** Upsert satellite site + churches + directory_branches under canonical country/state codes. */
export async function publishChurchToDirectory(
  supabase: SupabaseClient,
  nextIntPk: (table: string) => Promise<number>,
  input: {
    branchCountry: string;
    branchState: string;
    stateId: number;
    siteName: string;
    address: string;
    continent?: string;
    lga?: string;
    sourceRequestId?: number;
  },
): Promise<void> {
  const bc = normUp(input.branchCountry);
  const st = normUp(input.branchState);
  const site = norm(input.siteName);
  if (!site) return;
  const lga = norm(input.lga);
  const address = norm(input.address) || site;

  await supabase.from("satellite_church_sites").upsert({
    continent: norm(input.continent),
    branch_country: bc,
    branch_state: st,
    lga,
    site_name: site,
    source_request_id: input.sourceRequestId ?? null,
    is_active: 1,
  }, { onConflict: "branch_country,branch_state,lga,site_name" });

  const { data: existingCh } = await supabase.from("churches").select("id,directory_branch_id,branch_state").eq(
    "branch_country",
    bc,
  ).eq("name", site).maybeSingle();

  if (existingCh) {
    const ex = existingCh as { id: number; directory_branch_id?: number | null; branch_state?: string };
    const { error: ue } = await supabase.from("churches").update({
      branch_state: st,
      address,
      is_active: 1,
    }).eq("id", ex.id);
    if (ue) throw new Error(ue.message);
    if (ex.directory_branch_id) {
      await supabase.from("directory_branches").update({
        state_id: input.stateId,
        name: site,
        address,
      }).eq("id", ex.directory_branch_id);
    } else {
      const bid = await nextIntPk("directory_branches");
      await supabase.from("directory_branches").insert({
        id: bid,
        state_id: input.stateId,
        name: site,
        address,
      });
      await supabase.from("churches").update({ directory_branch_id: bid }).eq("id", ex.id);
    }
    return;
  }

  const { data: branchDup } = await supabase.from("directory_branches").select("id").eq("state_id", input.stateId).eq(
    "name",
    site,
  ).maybeSingle();
  let bid = branchDup ? Number((branchDup as { id: number }).id) : 0;
  if (!bid) {
    bid = await nextIntPk("directory_branches");
    const { error: be } = await supabase.from("directory_branches").insert({
      id: bid,
      state_id: input.stateId,
      name: site,
      address,
    });
    if (be) throw new Error(be.message);
  }

  const { error: cins } = await supabase.from("churches").insert({
    branch_country: bc,
    branch_state: st,
    name: site,
    address,
    directory_branch_id: bid,
    is_active: 1,
  });
  if (cins) throw new Error(cins.message);
}

/** Registration submit: canonical codes from selected church row. */
export async function branchCodesFromChurchId(
  supabase: SupabaseClient,
  churchId: number,
): Promise<{ branch_country: string; branch_state: string; satellite_site: string } | null> {
  if (!Number.isFinite(churchId) || churchId < 1) return null;
  const { data: ch } = await supabase.from("churches").select("branch_country,branch_state,name,is_active").eq(
    "id",
    churchId,
  ).maybeSingle();
  if (!ch || Number((ch as { is_active?: number }).is_active) !== 1) return null;
  const bc = normUp((ch as { branch_country?: string }).branch_country);
  const st = normUp((ch as { branch_state?: string }).branch_state);
  if (!bc || !st) return null;
  return {
    branch_country: bc,
    branch_state: st,
    satellite_site: norm((ch as { name?: string }).name),
  };
}

/** Align submitted branch codes with directory / catalog (fixes ABIASTATE → ABI, etc.). */
export async function canonicalizeRegistrationBranch(
  supabase: SupabaseClient,
  branchCountry: string,
  branchState: string,
): Promise<{ branch_country: string; branch_state: string }> {
  const bc = normUp(branchCountry);
  let st = normUp(branchState);
  if (!bc || !st) return { branch_country: bc, branch_state: st };

  const country = await resolveExistingDirectoryCountry(supabase, { branchCountryCode: bc });
  if (country) {
    const matched = await resolveExistingDirectoryState(supabase, country.id, bc, st);
    if (matched) st = matched.branch_state_code;
    else {
      const { data: byCode } = await supabase.from("directory_states").select("branch_state_code").eq(
        "country_id",
        country.id,
      ).eq("branch_state_code", st).maybeSingle();
      if (byCode?.branch_state_code) st = normUp(byCode.branch_state_code);
    }
  }

  const fromCatalog = resolveStateCodeByName(bc, st);
  if (fromCatalog) st = normUp(fromCatalog);

  return { branch_country: bc, branch_state: st };
}
