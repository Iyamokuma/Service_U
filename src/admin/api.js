import { SERVICE_UNITS } from "../data.js";
import { branchCountryLabel, branchStateLabel, assertStateBelongsToCountry } from "./branchRegions.js";
import { isRootSuperAdmin, isGlobalAdminRole, isSupervisoryBranchRole } from "./roles.js";

const DB_KEY = "sm_admin_demo_db_v1";
const FORM_DB_KEY = "sm_form_db_v1";

const mappedUnits = SERVICE_UNITS.map((u, idx) => ({
  id: u.id,
  name: u.name,
  description: "",
  coordinator: "",
  sort_order: idx,
  is_active: 1,
}));
const mappedSubs = SERVICE_UNITS.flatMap((u) =>
  (u.subs || []).map((s, i) => ({ id: Number(`${u.id}${i + 1}`), unit_id: u.id, name: s, sort_order: i, is_active: 1 }))
);
const mediaUnitId = SERVICE_UNITS.find((u) => u.name === "Media & Service")?.id || SERVICE_UNITS[0]?.id || 1;
const choirUnitId = SERVICE_UNITS.find((u) => u.name === "Choir")?.id || SERVICE_UNITS[1]?.id || mediaUnitId;
const usheringUnitId = SERVICE_UNITS.find((u) => u.name === "Ushering")?.id || SERVICE_UNITS[2]?.id || mediaUnitId;

/** Bump this string to reset the admin roster in localStorage (replaces entire `admins` array). */
const ADMIN_ROSTER_REVISION = "2026-05-01-general-admin-branch-oversight";

const seed = {
  admins: [
    { id: 1, full_name: "Super Admin", username: "superadmin", email: "superadmin@smhos.org", role: "super_admin", service_unit_id: null, sub_unit_name: "", branch_country: "", branch_state: "", is_active: 1, last_login: null, password: "Admin@1234" },
    { id: 2, full_name: "Chuks", username: "chuks", email: "chuks@smhos.org", role: "service_unit_leader", service_unit_id: mediaUnitId, sub_unit_name: "", branch_country: "", branch_state: "", is_active: 1, last_login: null, password: "Ibiyeomie@58" },
    { id: 3, full_name: "Inatimi", username: "inatimi", email: "inatimi@smhos.org", role: "sub_unit_leader", service_unit_id: mediaUnitId, sub_unit_name: "Audio", branch_country: "", branch_state: "", is_active: 1, last_login: null, password: "Ibiyeomie@58" },
    { id: 4, full_name: "Nigeria Country Super Admin", username: "country.admin", email: "country.admin@smhos.org", role: "country_super_admin", service_unit_id: null, sub_unit_name: "", branch_country: "NG", branch_state: "", is_active: 1, last_login: null, password: "Ibiyeomie@58" },
    { id: 5, full_name: "Rivers State Super Admin", username: "rivers.state", email: "rivers.state@smhos.org", role: "state_super_admin", service_unit_id: null, sub_unit_name: "", branch_country: "NG", branch_state: "RI", is_active: 1, last_login: null, password: "Ibiyeomie@58" },
  ],
  units: mappedUnits,
  sub_units: mappedSubs,
  registrations: [
    { id: 1, first_name: "Chinwe", surname: "Okafor", other_names: "", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "Port Harcourt", bus_stop: "Rumuokoro", phone1: "+2348031112222", email: "chinwe@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Audio", branch_country: "NG", branch_state: "RI", status: "new", notes: "", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), photo_path: "" },
    { id: 2, first_name: "Daniel", surname: "Eze", other_names: "", sex: "Male", marital_status: "Married", nationality: "Nigerian", address: "Abuja", bus_stop: "Wuse", phone1: "+2348033334444", email: "daniel@example.com", unit_id: 1, unit_name: "Choir", sub_unit: "", branch_country: "NG", branch_state: "FCT", status: "accepted", notes: "", submitted_at: new Date().toISOString(), photo_path: "" },
    { id: 3, first_name: "Peace", surname: "Udo", other_names: "", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "Lagos", bus_stop: "CMS", phone1: "+2348090001111", email: "peace@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Video", branch_country: "NG", branch_state: "LA", status: "in_progress", notes: "", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), photo_path: "" },
  ],
  requests: [
    { id: 1, from_admin_id: 1, from_name: "Super Admin", from_role: "super_admin", message: "Welcome to the platform.", status: "resolved", created_at: new Date().toISOString() },
  ],
  settings: {
    templates: {
      approved: "Hello {{name}}, your registration has been approved.",
      rejected: "Hello {{name}}, your registration was not approved.",
      waitlisted: "Hello {{name}}, your registration is currently waitlisted.",
    },
    overdue_threshold_hours: 72,
    permissions: {
      leaders_can_update_queue: true,
      leaders_can_send_requests: true,
      sub_unit_leaders_can_update_queue: true,
    },
  },
  activity: [],
  nextIds: { admin: 6, unit: mappedUnits.length + 1, sub: 1000, reg: 4, act: 1, req: 2 },
};

function recomputeNextIds(db) {
  const maxId = (rows) => rows.reduce((m, r) => Math.max(m, Number(r?.id) || 0), 0);
  db.nextIds = {
    ...(db.nextIds || {}),
    admin: Math.max(Number(db.nextIds?.admin) || 1, maxId(db.admins) + 1),
    unit: Math.max(Number(db.nextIds?.unit) || 1, maxId(db.units) + 1),
    sub: Math.max(Number(db.nextIds?.sub) || 1, maxId(db.sub_units) + 1),
    reg: Math.max(Number(db.nextIds?.reg) || 1, maxId(db.registrations) + 1),
    act: Math.max(Number(db.nextIds?.act) || 1, maxId(db.activity) + 1),
    req: Math.max(Number(db.nextIds?.req) || 1, maxId(db.requests) + 1),
  };
}

function applyCanonicalAdminRoster(db) {
  try {
    if (localStorage.getItem("sm_admin_roster_rev") === ADMIN_ROSTER_REVISION) return false;
  } catch {
    return false;
  }
  const seedIds = new Set(seed.admins.map((a) => Number(a.id)));
  const customAdmins = (db.admins || []).filter((a) => !seedIds.has(Number(a.id)));
  const canonical = structuredClone(seed.admins).map((a) => ({
    ...a,
    branch_country: a.branch_country ?? "",
    branch_state: a.branch_state ?? "",
  }));
  db.admins = [...canonical, ...customAdmins];
  recomputeNextIds(db);
  try {
    localStorage.setItem("sm_admin_roster_rev", ADMIN_ROSTER_REVISION);
  } catch { /* ignore */ }
  log(db, "System", "admin.roster.reset", "settings", 1, "Canonical seed admins merged; custom admins preserved");
  return true;
}

function ensureDemoData(db) {
  let changed = false;

  const demoRegs = [
    { first_name: "Favour", surname: "Okon", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "GRA, Port Harcourt", bus_stop: "Garrison", phone1: "+2348021010001", email: "favour.okon@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Electrical", branch_country: "NG", branch_state: "RI", status: "new", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
    { first_name: "Elijah", surname: "Bassey", sex: "Male", marital_status: "Single", nationality: "Nigerian", address: "Aba Road", bus_stop: "Artillery", phone1: "+2348021010002", email: "elijah.bassey@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Video", branch_country: "NG", branch_state: "RI", status: "in_progress", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString() },
    { first_name: "Joy", surname: "Amadi", sex: "Female", marital_status: "Married", nationality: "Nigerian", address: "Woji", bus_stop: "Slaughter", phone1: "+2348021010003", email: "joy.amadi@example.com", unit_id: choirUnitId, unit_name: "Choir", sub_unit: "Soprano", branch_country: "NG", branch_state: "RI", status: "accepted", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 44).toISOString() },
    { first_name: "Michael", surname: "Edet", sex: "Male", marital_status: "Single", nationality: "Nigerian", address: "Rumuola", bus_stop: "Rumuola", phone1: "+2348021010004", email: "michael.edet@example.com", unit_id: choirUnitId, unit_name: "Choir", sub_unit: "Tenor", branch_country: "NG", branch_state: "LA", status: "new", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
    { first_name: "Blessing", surname: "Nwankwo", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "Mile 3", bus_stop: "Mile 3", phone1: "+2348021010005", email: "blessing.nwankwo@example.com", unit_id: usheringUnitId, unit_name: "Ushering", sub_unit: "Main Auditorium", branch_country: "NG", branch_state: "DE", status: "accepted", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 58).toISOString() },
    { first_name: "Samuel", surname: "John", sex: "Male", marital_status: "Married", nationality: "Nigerian", address: "Ada George", bus_stop: "Agip", phone1: "+2348021010006", email: "samuel.john@example.com", unit_id: usheringUnitId, unit_name: "Ushering", sub_unit: "Overflow", branch_country: "GH", branch_state: "GA", status: "in_progress", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString() },
  ];

  const byRegEmail = new Set(db.registrations.map((r) => String(r.email || "").toLowerCase()));
  demoRegs.forEach((entry) => {
    if (byRegEmail.has(entry.email.toLowerCase())) return;
    db.registrations.push({
      id: db.nextIds.reg++,
      other_names: "",
      notes: "",
      photo_path: "",
      ...entry,
    });
    changed = true;
  });

  if (changed) {
    log(db, "System Seeder", "seed.populate", "settings", 1, "Added sample queue data");
  }
  recomputeNextIds(db);
  return changed;
}

/** Media & Service only has Audio, Video, Electrical — strip legacy "Graphics" from persisted DBs. */
function removeLegacyMediaGraphics(db) {
  let changed = false;
  const mid = mediaUnitId;
  const isGraphics = (s) => String(s || "").toLowerCase() === "graphics";
  db.sub_units = (db.sub_units || []).filter((s) => {
    if (Number(s.unit_id) !== Number(mid)) return true;
    if (isGraphics(s.name)) {
      changed = true;
      return false;
    }
    return true;
  });
  (db.registrations || []).forEach((r) => {
    if (Number(r.unit_id) !== Number(mid) || !isGraphics(r.sub_unit)) return;
    r.sub_unit = "Electrical";
    changed = true;
  });
  (db.admins || []).forEach((a) => {
    if (Number(a.service_unit_id) !== Number(mid) || !isGraphics(a.sub_unit_name)) return;
    a.sub_unit_name = "Electrical";
    changed = true;
  });
  return changed;
}

function readDb() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    const db = parsed || structuredClone(seed);
    const formDb = JSON.parse(localStorage.getItem(FORM_DB_KEY) || "null");
    if (formDb?.registrations?.length) {
      const existingIds = new Set(db.registrations.map((r) => String(r.id)));
      formDb.registrations.forEach((r) => {
        if (existingIds.has(String(r.id))) return;
        db.registrations.push({
          ...r,
          status: normalizeStatus(r.status || "new"),
          branch_country: normBranchCode(r.branch_country) || "NG",
          branch_state: normBranchCode(r.branch_state) || "",
        });
      });
    }
    const missingUnits = mappedUnits.filter((u) => !db.units.some((x) => Number(x.id) === Number(u.id)));
    if (missingUnits.length) db.units.push(...missingUnits);
    const missingSubs = mappedSubs.filter((s) => !db.sub_units.some((x) => Number(x.unit_id) === Number(s.unit_id) && String(x.name) === String(s.name)));
    if (missingSubs.length) db.sub_units.push(...missingSubs);
    db.registrations = db.registrations.map((r) => ({
      ...r,
      status: normalizeStatus(r.status),
      branch_country: normBranchCode(r.branch_country) || "NG",
      branch_state: normBranchCode(r.branch_state) || "",
    }));
    const graphicsPurge = removeLegacyMediaGraphics(db);
    const rosterChanged = applyCanonicalAdminRoster(db);
    const changed = ensureDemoData(db);
    if (rosterChanged || changed || graphicsPurge) writeDb(db);
    return db;
  } catch {
    return structuredClone(seed);
  }
}
function writeDb(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function normText(v) {
  return String(v ?? "").trim();
}
function normBranchCode(v) {
  return normText(v).toUpperCase();
}
/** YYYY-MM-DD in local timezone — aligns <input type="date"> with submission timestamps. */
function submittedLocalDateKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function normalizeStatus(s) {
  const map = { pending: "new", approved: "accepted", waitlisted: "in_progress" };
  return map[s] || s || "new";
}
function canAccessRegistration(admin, row) {
  if (!admin || isGlobalAdminRole(admin.role)) return true;
  if (admin.role === "country_super_admin") {
    const rc = normBranchCode(row.branch_country);
    const ac = normBranchCode(admin.branch_country);
    if (!rc || !ac) return false;
    return rc === ac;
  }
  if (admin.role === "state_super_admin") {
    const rc = normBranchCode(row.branch_country);
    const rs = normBranchCode(row.branch_state);
    const ac = normBranchCode(admin.branch_country);
    const ast = normBranchCode(admin.branch_state);
    if (!rc || !rs || !ac || !ast) return false;
    return rc === ac && rs === ast;
  }
  if (admin.role === "service_unit_leader") return Number(row.unit_id) === Number(admin.service_unit_id);
  if (admin.role === "sub_unit_leader") return Number(row.unit_id) === Number(admin.service_unit_id) && String(row.sub_unit || "").toLowerCase() === String(admin.sub_unit_name || "").toLowerCase();
  return false;
}
function log(db, admin_name, action, entity_type, entity_id, description) {
  db.activity.unshift({
    id: db.nextIds.act++,
    admin_name,
    action,
    entity_type,
    entity_id,
    description,
    ip_address: "browser",
    created_at: new Date().toISOString(),
  });
}
function paginate(rows, page = 1, per_page = 25) {
  const p = Math.max(1, Number(page) || 1);
  const pp = Math.max(1, Number(per_page) || 25);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pp));
  return { data: rows.slice((p - 1) * pp, (p - 1) * pp + pp), pagination: { page: p, per_page: pp, total, pages } };
}
function serviceUnitNameFromDb(db, serviceUnitId) {
  if (serviceUnitId == null || serviceUnitId === "") return "";
  return db.units.find((u) => Number(u.id) === Number(serviceUnitId))?.name || "";
}

/** Client-safe admin object (no password); includes resolved service_unit_name for UI. */
function shapeAdminClient(row, db) {
  return {
    id: row.id,
    full_name: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    service_unit_id: row.service_unit_id,
    sub_unit_name: row.sub_unit_name || "",
    branch_country: row.branch_country ?? "",
    branch_state: row.branch_state ?? "",
    service_unit_name: serviceUnitNameFromDb(db, row.service_unit_id),
  };
}

function withUnits(db) {
  return db.units
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
    .map((u) => ({
      ...u,
      sub_units: db.sub_units
        .filter((s) => Number(s.unit_id) === Number(u.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    }));
}

export const api = {
  async populateDemoData() {
    const db = readDb();
    if (ensureDemoData(db)) writeDb(db);
    return { ok: true };
  },
  async login(body) {
    const db = readDb();
    const username = normText(body?.username).toLowerCase();
    const password = normText(body?.password);
    const admin = db.admins.find(
      (a) =>
        Number(a?.is_active ?? 1) === 1 &&
        (normText(a?.username).toLowerCase() === username || normText(a?.email).toLowerCase() === username) &&
        (String(a?.password ?? "") === password || normText(a?.password) === password)
    );
    if (!admin) throw new Error("Invalid credentials.");
    admin.last_login = new Date().toISOString();
    writeDb(db);
    log(db, admin.full_name, "admin.login", "admin", admin.id, "Admin logged in");
    writeDb(db);
    return {
      token: `local-${Date.now()}`,
      admin: shapeAdminClient(admin, db),
    };
  },
  /** Merge latest DB fields (incl. renamed units) into a stored client admin. */
  async refreshSession(stored) {
    const db = readDb();
    const row = db.admins.find((a) => Number(a.id) === Number(stored?.id));
    if (!row || Number(row.is_active ?? 1) !== 1) return stored || null;
    return { ...stored, ...shapeAdminClient(row, db) };
  },
  async logout() { return { ok: true }; },

  async stats(params = {}) {
    const db = readDb();
    let regs = db.registrations;
    if (params.viewer) regs = regs.filter((r) => canAccessRegistration(params.viewer, r));
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStartMs = weekAgo.getTime();
    const totals = {
      registrations: regs.length,
      pending: regs.filter((r) => normalizeStatus(r.status) === "new").length,
      approved: regs.filter((r) => normalizeStatus(r.status) === "accepted").length,
      rejected: regs.filter((r) => r.status === "rejected").length,
      waitlisted: regs.filter((r) => normalizeStatus(r.status) === "in_progress").length,
      active_units:
        params.viewer?.role === "service_unit_leader"
          ? 1
          : ["country_super_admin", "state_super_admin"].includes(params.viewer?.role)
            ? new Set(regs.map((r) => r.unit_id)).size || 0
            : db.units.filter((u) => u.is_active === 1).length,
      this_week: regs.filter((r) => new Date(r.submitted_at).getTime() >= weekStartMs).length,
    };
    const byUnitMap = {};
    regs.forEach((r) => { byUnitMap[r.unit_name || "Unknown"] = (byUnitMap[r.unit_name || "Unknown"] || 0) + 1; });
    const by_unit = Object.entries(byUnitMap).map(([unit_name, cnt]) => ({ unit_name, cnt }));
    const bySexMap = {};
    regs.forEach((r) => { bySexMap[r.sex || "Unknown"] = (bySexMap[r.sex || "Unknown"] || 0) + 1; });
    const by_sex = Object.entries(bySexMap).map(([sex, cnt]) => ({ sex, cnt }));
    const trendDays = Math.min(365, Math.max(7, Number(params.trend_days) || 365));
    const trend = Array.from({ length: trendDays }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (trendDays - 1 - i));
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayRegs = regs.filter((r) => submittedLocalDateKey(r.submitted_at) === day);
      const st = (r) => normalizeStatus(r.status);
      const open = dayRegs.filter((r) => ["new", "in_progress"].includes(st(r))).length;
      const closed = dayRegs.filter((r) => ["accepted", "rejected", "archived"].includes(st(r))).length;
      return { day, cnt: dayRegs.length, open, closed };
    });
    return { totals, by_unit, by_sex, trend, recent_activity: db.activity.slice(0, 10) };
  },

  async queue(params = {}) {
    const db = readDb();
    let rows = db.registrations.map((r) => ({ ...r, status: normalizeStatus(r.status) })).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    if (params.viewer) rows = rows.filter((r) => canAccessRegistration(params.viewer, r));
    if (params.overdue_only) {
      const threshold = Number(db.settings?.overdue_threshold_hours || 72);
      const now = Date.now();
      rows = rows.filter((r) => {
        const st = normalizeStatus(r.status);
        if (!["new", "in_progress"].includes(st)) return false;
        const hours = (now - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60);
        return hours >= threshold;
      });
    } else if (params.status) {
      rows = rows.filter((r) => normalizeStatus(r.status) === normalizeStatus(params.status));
    }
    if (params.unit_id) rows = rows.filter((r) => Number(r.unit_id) === Number(params.unit_id));
    if (params.sub_unit) rows = rows.filter((r) => String(r.sub_unit || "").toLowerCase() === String(params.sub_unit || "").toLowerCase());
    if (params.sex) rows = rows.filter((r) => (r.sex || "") === params.sex);
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((r) =>
        `${r.first_name} ${r.surname} ${r.other_names || ""} ${r.email} ${r.phone1} ${r.phone2 || ""}`.toLowerCase().includes(q)
      );
    }
    if (params.from) rows = rows.filter((r) => submittedLocalDateKey(r.submitted_at) >= String(params.from));
    if (params.to) rows = rows.filter((r) => submittedLocalDateKey(r.submitted_at) <= String(params.to));
    if (params.filter_branch_state) {
      const fs = normBranchCode(params.filter_branch_state);
      rows = rows.filter((r) => normBranchCode(r.branch_state) === fs);
    }
    return paginate(rows, params.page, params.per_page);
  },
  async updateStatus(id, body) {
    const db = readDb();
    const row = db.registrations.find((r) => String(r.id) === String(id));
    if (!row) throw new Error("Registration not found.");
    const viewer = body.viewer || null;
    if (viewer && !canAccessRegistration(viewer, row)) throw new Error("Not allowed for this queue item.");
    if (viewer && isSupervisoryBranchRole(viewer.role)) {
      throw new Error("Supervisory admins can view data only. Status changes are done by service unit leaders.");
    }
    const current = normalizeStatus(row.status);
    const target = normalizeStatus(body.status || current);
    const allowedTransitions = {
      new: ["in_progress", "accepted", "rejected", "archived"],
      in_progress: ["accepted", "rejected", "new", "archived"],
      accepted: ["accepted", "archived"],
      rejected: ["rejected", "archived"],
      archived: ["archived"],
    };
    if (!isGlobalAdminRole(viewer?.role) && !(allowedTransitions[current] || []).includes(target)) {
      throw new Error("Invalid status transition.");
    }
    row.status = target;
    row.notes = body.notes || "";
    log(db, viewer?.full_name || "Super Admin", "queue.update", "registration", row.id, `Status updated to ${row.status}`);
    writeDb(db);
    return { ok: true };
  },
  async deleteReg(id) {
    const db = readDb();
    db.registrations = db.registrations.filter((r) => String(r.id) !== String(id));
    log(db, "Super Admin", "queue.delete", "registration", id, "Registration deleted");
    writeDb(db);
    return { ok: true };
  },

  async units() { return { data: withUnits(readDb()) }; },
  async createUnit(body) {
    const db = readDb();
    const unit = { id: db.nextIds.unit++, name: body.name, description: body.description || "", coordinator: body.coordinator || "", sort_order: Number(body.sort_order || 0), is_active: Number(body.is_active ?? 1) };
    db.units.push(unit);
    log(db, "Super Admin", "unit.create", "unit", unit.id, `Created unit ${unit.name}`);
    writeDb(db);
    return { data: unit };
  },
  async updateUnit(id, body) {
    const db = readDb();
    const unit = db.units.find((u) => Number(u.id) === Number(id));
    if (!unit) throw new Error("Unit not found.");
    Object.assign(unit, { name: body.name, description: body.description || "", coordinator: body.coordinator || "", sort_order: Number(body.sort_order || 0), is_active: Number(body.is_active ?? 1) });
    log(db, "Super Admin", "unit.update", "unit", unit.id, `Updated unit ${unit.name}`);
    writeDb(db);
    return { data: unit };
  },
  async deleteUnit(id) {
    const db = readDb();
    db.units = db.units.filter((u) => Number(u.id) !== Number(id));
    db.sub_units = db.sub_units.filter((s) => Number(s.unit_id) !== Number(id));
    log(db, "Super Admin", "unit.delete", "unit", id, "Deleted unit");
    writeDb(db);
    return { ok: true };
  },

  async createSub(body) {
    const db = readDb();
    const sub = { id: db.nextIds.sub++, unit_id: Number(body.unit_id), name: body.name, sort_order: Number(body.sort_order || 0), is_active: Number(body.is_active ?? 1) };
    db.sub_units.push(sub);
    log(db, "Super Admin", "sub.create", "sub_unit", sub.id, `Created sub-unit ${sub.name}`);
    writeDb(db);
    return { data: sub };
  },
  async updateSub(id, body) {
    const db = readDb();
    const sub = db.sub_units.find((s) => Number(s.id) === Number(id));
    if (!sub) throw new Error("Sub-unit not found.");
    Object.assign(sub, { name: body.name, sort_order: Number(body.sort_order || 0), is_active: Number(body.is_active ?? 1) });
    log(db, "Super Admin", "sub.update", "sub_unit", sub.id, `Updated sub-unit ${sub.name}`);
    writeDb(db);
    return { data: sub };
  },
  async deleteSub(id) {
    const db = readDb();
    db.sub_units = db.sub_units.filter((s) => Number(s.id) !== Number(id));
    log(db, "Super Admin", "sub.delete", "sub_unit", id, "Deleted sub-unit");
    writeDb(db);
    return { ok: true };
  },

  async admins() {
    const db = readDb();
    return {
      data: db.admins.map((a) => {
        const { password: _omit, ...rest } = a;
        return {
          ...rest,
          id: a.id,
          full_name: a.full_name,
          username: a.username,
          email: a.email,
          role: a.role,
          service_unit_name: db.units.find((u) => Number(u.id) === Number(a.service_unit_id))?.name || "",
          service_unit_id: a.service_unit_id ?? null,
          sub_unit_name: a.sub_unit_name || "",
          branch_country: a.branch_country ?? "",
          branch_state: a.branch_state ?? "",
          branch_country_label: branchCountryLabel(a.branch_country),
          branch_state_label: branchStateLabel(a.branch_country, a.branch_state),
          is_active: a.is_active,
          last_login: a.last_login,
        };
      }),
    };
  },
  async createAdmin(body) {
    const db = readDb();
    const viewerRole = body.viewer?.role;
    const username = normText(body.username);
    const email = normText(body.email);
    const fullName = normText(body.full_name);
    const role = body.role || "viewer";
    let serviceUnitId = body.service_unit_id ? Number(body.service_unit_id) : null;
    const subUnitName = normText(body.sub_unit_name);
    const branchCountry = normBranchCode(body.branch_country);
    const branchState = normBranchCode(body.branch_state);
    const password = String(body.password ?? "");
    if (!username) throw new Error("Username is required.");
    if (!email) throw new Error("Email is required.");
    if (!fullName) throw new Error("Full name is required.");
    if (role === "super_admin" && !isRootSuperAdmin(viewerRole)) {
      throw new Error("Only a Super Admin can create or assign the Super Admin role.");
    }
    const existingByUsername = db.admins.find((a) => normText(a.username).toLowerCase() === username.toLowerCase());
    const existingByEmail = db.admins.find((a) => normText(a.email).toLowerCase() === email.toLowerCase());
    if (existingByUsername && existingByEmail && Number(existingByUsername.id) !== Number(existingByEmail.id)) {
      throw new Error("Username and email already belong to different accounts.");
    }
    const existing = existingByUsername || existingByEmail;

    let outBranchCountry = "";
    let outBranchState = "";
    let outSubUnit = "";
    let outServiceUnitId = null;

    if (role === "super_admin" || role === "general_admin") {
      outServiceUnitId = null;
      outSubUnit = "";
    } else if (role === "country_super_admin") {
      if (!branchCountry) throw new Error("Country is required for country super admin.");
      outBranchCountry = branchCountry;
      outBranchState = "";
      outServiceUnitId = null;
      outSubUnit = "";
    } else if (role === "state_super_admin") {
      if (!branchCountry) throw new Error("Country is required for state super admin.");
      assertStateBelongsToCountry(branchCountry, branchState);
      outBranchCountry = branchCountry;
      outBranchState = normBranchCode(branchState);
      outServiceUnitId = null;
      outSubUnit = "";
    } else if (role === "service_unit_leader") {
      if (!serviceUnitId) throw new Error("Service unit is required for service unit leaders.");
      outServiceUnitId = serviceUnitId;
      outSubUnit = "";
    } else if (role === "sub_unit_leader") {
      if (!serviceUnitId) throw new Error("Service unit is required for sub-unit leaders.");
      if (!subUnitName) throw new Error("Sub-unit is required for sub-unit leaders.");
      outServiceUnitId = serviceUnitId;
      outSubUnit = subUnitName;
    } else {
      throw new Error("Unsupported role.");
    }

    // If an account with same username/email exists but is inactive, revive it safely.
    if (existing) {
      if (Number(existing.is_active ?? 1) === 1) {
        if (existingByUsername) throw new Error("Username already exists.");
        throw new Error("Email already exists.");
      }
      existing.full_name = fullName;
      existing.username = username;
      existing.email = email;
      existing.role = role;
      existing.service_unit_id = outServiceUnitId;
      existing.sub_unit_name = outSubUnit;
      existing.branch_country = outBranchCountry;
      existing.branch_state = outBranchState;
      existing.is_active = Number(body.is_active ?? 1);
      if (password.trim()) existing.password = password;
      else if (!normText(existing.password)) existing.password = "Admin@1234";
      log(db, "Super Admin", "admin.reactivate", "admin", existing.id, `Reactivated admin ${existing.username}`);
      writeDb(db);
      return { data: existing };
    }

    const adminRow = {
      id: db.nextIds.admin++,
      full_name: fullName,
      username,
      email,
      password: password.trim() ? password : "Admin@1234",
      role,
      service_unit_id: outServiceUnitId,
      sub_unit_name: outSubUnit,
      branch_country: outBranchCountry,
      branch_state: outBranchState,
      is_active: Number(body.is_active ?? 1),
      last_login: null,
    };
    db.admins.push(adminRow);
    log(db, "Super Admin", "admin.create", "admin", adminRow.id, `Created admin ${adminRow.username}`);
    writeDb(db);
    return { data: adminRow };
  },
  async updateAdmin(id, body) {
    const db = readDb();
    const admin = db.admins.find((a) => Number(a.id) === Number(id));
    if (!admin) throw new Error("Admin not found.");
    const viewerRole = body.viewer?.role;
    const selfService = Number(body.viewer?.id) === Number(admin.id);
    if (selfService && body.role !== undefined && body.role !== admin.role) {
      throw new Error("You cannot change your own role here.");
    }
    const nextRole = body.role ?? admin.role;
    const nextServiceUnitId = body.service_unit_id !== undefined ? (body.service_unit_id ? Number(body.service_unit_id) : null) : admin.service_unit_id;
    const nextSubUnitName = body.sub_unit_name !== undefined ? normText(body.sub_unit_name) : admin.sub_unit_name;
    const nextBranchCountry = body.branch_country !== undefined ? normBranchCode(body.branch_country) : normBranchCode(admin.branch_country);
    const nextBranchState = body.branch_state !== undefined ? normBranchCode(body.branch_state) : normBranchCode(admin.branch_state);

    if (!selfService) {
      if (nextRole === "super_admin" && !isRootSuperAdmin(viewerRole)) {
        throw new Error("Only a Super Admin can assign the Super Admin role.");
      }
      if (admin.role === "super_admin" && !isRootSuperAdmin(viewerRole)) {
        throw new Error("Only a Super Admin can edit Super Admin accounts.");
      }
    }

    if (nextRole === "super_admin" || nextRole === "general_admin") {
      /* ok */
    } else if (nextRole === "country_super_admin") {
      if (!nextBranchCountry) throw new Error("Country is required for country super admin.");
    } else if (nextRole === "state_super_admin") {
      if (!nextBranchCountry) throw new Error("Country is required for state super admin.");
      if (!nextBranchState) throw new Error("State / region is required for state super admin.");
      assertStateBelongsToCountry(nextBranchCountry, nextBranchState);
    } else if (nextRole === "service_unit_leader") {
      if (!nextServiceUnitId) throw new Error("Service unit is required for service unit leaders.");
    } else if (nextRole === "sub_unit_leader") {
      if (!nextServiceUnitId) throw new Error("Service unit is required for sub-unit leaders.");
      if (!normText(nextSubUnitName)) throw new Error("Sub-unit is required for sub-unit leaders.");
    }

    admin.full_name = body.full_name ?? admin.full_name;
    admin.email = body.email ?? admin.email;
    admin.role = body.role ?? admin.role;
    admin.is_active = Number(body.is_active ?? admin.is_active);
    if (body.password) admin.password = body.password;

    if (nextRole === "super_admin" || nextRole === "general_admin") {
      admin.service_unit_id = null;
      admin.sub_unit_name = "";
      admin.branch_country = "";
      admin.branch_state = "";
    } else if (nextRole === "country_super_admin") {
      admin.service_unit_id = null;
      admin.sub_unit_name = "";
      admin.branch_country = nextBranchCountry;
      admin.branch_state = "";
    } else if (nextRole === "state_super_admin") {
      admin.service_unit_id = null;
      admin.sub_unit_name = "";
      admin.branch_country = nextBranchCountry;
      admin.branch_state = nextBranchState;
    } else {
      admin.service_unit_id = body.service_unit_id !== undefined ? (body.service_unit_id ? Number(body.service_unit_id) : null) : admin.service_unit_id;
      admin.sub_unit_name = body.sub_unit_name !== undefined ? normText(body.sub_unit_name) : admin.sub_unit_name;
      admin.branch_country = "";
      admin.branch_state = "";
    }

    log(db, "Super Admin", "admin.update", "admin", admin.id, `Updated admin ${admin.username}`);
    writeDb(db);
    return { data: admin };
  },
  async updateRegistrationBranch(id, body) {
    const db = readDb();
    const row = db.registrations.find((r) => String(r.id) === String(id));
    if (!row) throw new Error("Registration not found.");
    if (!isGlobalAdminRole(body.viewer?.role)) {
      throw new Error("Only a Super Admin or General Admin can change country and state on a registration.");
    }
    const bc = normBranchCode(body.branch_country);
    const bs = normBranchCode(body.branch_state);
    if (!bc) throw new Error("Country is required.");
    assertStateBelongsToCountry(bc, bs);
    row.branch_country = bc;
    row.branch_state = bs;
    log(
      db,
      body.viewer?.full_name || "Super Admin",
      "registration.branch.update",
      "registration",
      row.id,
      `Branch set to ${bc} / ${bs || "—"}`
    );
    writeDb(db);
    return { ok: true };
  },
  async deleteAdmin(id, body = {}) {
    const db = readDb();
    const target = db.admins.find((a) => Number(a.id) === Number(id));
    if (!target) throw new Error("Admin not found.");
    if (target.role === "super_admin" && !isRootSuperAdmin(body.viewer?.role)) {
      throw new Error("Only a Super Admin can delete a Super Admin account.");
    }
    db.admins = db.admins.filter((a) => Number(a.id) !== Number(id));
    log(db, "Super Admin", "admin.delete", "admin", id, "Deleted admin");
    writeDb(db);
    return { ok: true };
  },

  async members(params = {}) {
    const db = readDb();
    let rows = db.registrations.map((r) => ({ ...r, status: normalizeStatus(r.status) })).filter((r) => r.status === "accepted");
    if (params.viewer) rows = rows.filter((r) => canAccessRegistration(params.viewer, r));
    if (params.filter_branch_state) {
      const fs = normBranchCode(params.filter_branch_state);
      rows = rows.filter((r) => normBranchCode(r.branch_state) === fs);
    }
    if (params.unit_id) rows = rows.filter((r) => Number(r.unit_id) === Number(params.unit_id));
    if (params.sub_unit) {
      rows = rows.filter((r) => String(r.sub_unit || "").toLowerCase() === String(params.sub_unit || "").toLowerCase());
    }
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((r) =>
        `${r.first_name} ${r.surname} ${r.other_names || ""} ${r.email} ${r.phone1} ${r.phone2 || ""}`.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    return paginate(rows, params.page, params.per_page || 25);
  },

  async requests(params = {}) {
    const db = readDb();
    let rows = db.requests.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (params.status) rows = rows.filter((r) => r.status === params.status);
    if (params.from_admin_id) rows = rows.filter((r) => Number(r.from_admin_id) === Number(params.from_admin_id));
    return paginate(rows, params.page, params.per_page || 25);
  },
  async createRequest(body) {
    const db = readDb();
    const req = {
      id: db.nextIds.req++,
      from_admin_id: Number(body.from_admin_id),
      from_name: body.from_name,
      from_role: body.from_role,
      message: body.message,
      status: "open",
      created_at: new Date().toISOString(),
    };
    db.requests.unshift(req);
    log(db, body.from_name || "Admin", "request.create", "request", req.id, "Created support request");
    writeDb(db);
    return { data: req };
  },
  async updateRequest(id, body) {
    const db = readDb();
    const req = db.requests.find((r) => Number(r.id) === Number(id));
    if (!req) throw new Error("Request not found.");
    req.status = body.status || req.status;
    log(db, "Super Admin", "request.update", "request", req.id, `Request marked ${req.status}`);
    writeDb(db);
    return { data: req };
  },

  async settings() {
    return { data: readDb().settings };
  },
  async updateSettings(body) {
    const db = readDb();
    db.settings = {
      ...db.settings,
      ...body,
      templates: { ...(db.settings?.templates || {}), ...(body.templates || {}) },
      permissions: { ...(db.settings?.permissions || {}), ...(body.permissions || {}) },
    };
    log(db, "Super Admin", "settings.update", "settings", 1, "Updated platform settings");
    writeDb(db);
    return { data: db.settings };
  },

  async activity(params = {}) {
    const db = readDb();
    let rows = db.activity.slice();
    if (params.viewer && !isGlobalAdminRole(params.viewer.role)) {
      const allowedRegs = new Set(
        db.registrations
          .filter((r) => canAccessRegistration(params.viewer, r))
          .map((r) => String(r.id))
      );
      rows = rows.filter(
        (r) =>
          (r.entity_type === "registration" && allowedRegs.has(String(r.entity_id))) ||
          r.admin_name === params.viewer.full_name
      );
    }
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((r) => `${r.description} ${r.action} ${r.admin_name}`.toLowerCase().includes(q));
    }
    if (params.action) rows = rows.filter((r) => r.action === params.action);
    if (params.entity) rows = rows.filter((r) => r.entity_type === params.entity);
    if (params.admin_id) rows = rows.filter((r) => String(r.entity_id) === String(params.admin_id) || String(r.admin_id) === String(params.admin_id));
    if (params.from) rows = rows.filter((r) => String(r.created_at).slice(0, 10) >= params.from);
    if (params.to) rows = rows.filter((r) => String(r.created_at).slice(0, 10) <= params.to);
    const result = paginate(rows, params.page, 50);
    const admins = db.admins.map((a) => ({ admin_id: a.id, admin_name: a.full_name }));
    return { ...result, admins };
  },
  async subUnitQueuesByUnit(viewer) {
    const db = readDb();
    const unitId = Number(viewer?.service_unit_id || 0);
    const rows = db.registrations.map((r) => ({ ...r, status: normalizeStatus(r.status) })).filter((r) => Number(r.unit_id) === unitId);
    const grouped = {};
    rows.forEach((r) => {
      const key = r.sub_unit || "No sub-unit";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
    return { data: Object.entries(grouped).map(([sub_unit, items]) => ({ sub_unit, items: items.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)) })) };
  },
  async overdueAlerts(viewer) {
    const db = readDb();
    const threshold = Number(db.settings?.overdue_threshold_hours || 72);
    const now = Date.now();
    const alerts = db.registrations
      .map((r) => ({ ...r, status: normalizeStatus(r.status) }))
      .filter((r) => canAccessRegistration(viewer, r))
      .filter((r) => ["new", "in_progress"].includes(r.status))
      .filter((r) => ((now - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60)) >= threshold)
      .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    return { data: alerts };
  },
};
