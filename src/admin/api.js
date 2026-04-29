import { SERVICE_UNITS } from "../data.js";

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

const seed = {
  admins: [
    { id: 1, full_name: "Super Admin", username: "superadmin", email: "superadmin@smhos.org", role: "super_admin", service_unit_id: null, sub_unit_name: "", is_active: 1, last_login: null, password: "Admin@1234" },
    { id: 2, full_name: "Media Leader", username: "media.leader", email: "media.leader@smhos.org", role: "service_unit_leader", service_unit_id: mediaUnitId, sub_unit_name: "", is_active: 1, last_login: null, password: "Leader@1234" },
    { id: 3, full_name: "Audio Lead", username: "audio.lead", email: "audio.lead@smhos.org", role: "sub_unit_leader", service_unit_id: mediaUnitId, sub_unit_name: "Audio", is_active: 1, last_login: null, password: "Subunit@1234" },
  ],
  units: mappedUnits,
  sub_units: mappedSubs,
  registrations: [
    { id: 1, first_name: "Chinwe", surname: "Okafor", other_names: "", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "Port Harcourt", bus_stop: "Rumuokoro", phone1: "+2348031112222", email: "chinwe@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Audio", status: "new", notes: "", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), photo_path: "" },
    { id: 2, first_name: "Daniel", surname: "Eze", other_names: "", sex: "Male", marital_status: "Married", nationality: "Nigerian", address: "Abuja", bus_stop: "Wuse", phone1: "+2348033334444", email: "daniel@example.com", unit_id: 1, unit_name: "Choir", sub_unit: "", status: "accepted", notes: "", submitted_at: new Date().toISOString(), photo_path: "" },
    { id: 3, first_name: "Peace", surname: "Udo", other_names: "", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "Lagos", bus_stop: "CMS", phone1: "+2348090001111", email: "peace@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Video", status: "in_progress", notes: "", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), photo_path: "" },
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
  nextIds: { admin: 4, unit: mappedUnits.length + 1, sub: 1000, reg: 4, act: 1, req: 2 },
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

function ensureDemoData(db) {
  let changed = false;
  const byUsername = new Set(db.admins.map((a) => String(a.username || "").toLowerCase()));
  const byEmail = new Set(db.admins.map((a) => String(a.email || "").toLowerCase()));

  const demoAdmins = [
    { full_name: "Operations Admin", username: "ops.admin", email: "ops.admin@smhos.org", role: "super_admin", service_unit_id: null, sub_unit_name: "", password: "Admin@1234" },
    { full_name: "Choir Leader", username: "choir.leader", email: "choir.leader@smhos.org", role: "service_unit_leader", service_unit_id: choirUnitId, sub_unit_name: "", password: "Leader@1234" },
    { full_name: "Ushering Leader", username: "ushering.leader", email: "ushering.leader@smhos.org", role: "service_unit_leader", service_unit_id: usheringUnitId, sub_unit_name: "", password: "Leader@1234" },
    { full_name: "Video Sub-unit Lead", username: "video.lead", email: "video.lead@smhos.org", role: "sub_unit_leader", service_unit_id: mediaUnitId, sub_unit_name: "Video", password: "Subunit@1234" },
    { full_name: "Graphics Sub-unit Lead", username: "graphics.lead", email: "graphics.lead@smhos.org", role: "sub_unit_leader", service_unit_id: mediaUnitId, sub_unit_name: "Graphics", password: "Subunit@1234" },
    { full_name: "Tenor Coordinator", username: "tenor.lead", email: "tenor.lead@smhos.org", role: "sub_unit_leader", service_unit_id: choirUnitId, sub_unit_name: "Tenor", password: "Subunit@1234" },
  ];

  demoAdmins.forEach((entry) => {
    if (byUsername.has(entry.username.toLowerCase()) || byEmail.has(entry.email.toLowerCase())) return;
    db.admins.push({
      id: db.nextIds.admin++,
      is_active: 1,
      last_login: null,
      ...entry,
    });
    changed = true;
  });

  const demoRegs = [
    { first_name: "Favour", surname: "Okon", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "GRA, Port Harcourt", bus_stop: "Garrison", phone1: "+2348021010001", email: "favour.okon@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Graphics", status: "new", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
    { first_name: "Elijah", surname: "Bassey", sex: "Male", marital_status: "Single", nationality: "Nigerian", address: "Aba Road", bus_stop: "Artillery", phone1: "+2348021010002", email: "elijah.bassey@example.com", unit_id: mediaUnitId, unit_name: "Media & Service", sub_unit: "Video", status: "in_progress", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString() },
    { first_name: "Joy", surname: "Amadi", sex: "Female", marital_status: "Married", nationality: "Nigerian", address: "Woji", bus_stop: "Slaughter", phone1: "+2348021010003", email: "joy.amadi@example.com", unit_id: choirUnitId, unit_name: "Choir", sub_unit: "Soprano", status: "accepted", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 44).toISOString() },
    { first_name: "Michael", surname: "Edet", sex: "Male", marital_status: "Single", nationality: "Nigerian", address: "Rumuola", bus_stop: "Rumuola", phone1: "+2348021010004", email: "michael.edet@example.com", unit_id: choirUnitId, unit_name: "Choir", sub_unit: "Tenor", status: "new", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
    { first_name: "Blessing", surname: "Nwankwo", sex: "Female", marital_status: "Single", nationality: "Nigerian", address: "Mile 3", bus_stop: "Mile 3", phone1: "+2348021010005", email: "blessing.nwankwo@example.com", unit_id: usheringUnitId, unit_name: "Ushering", sub_unit: "Main Auditorium", status: "accepted", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 58).toISOString() },
    { first_name: "Samuel", surname: "John", sex: "Male", marital_status: "Married", nationality: "Nigerian", address: "Ada George", bus_stop: "Agip", phone1: "+2348021010006", email: "samuel.john@example.com", unit_id: usheringUnitId, unit_name: "Ushering", sub_unit: "Overflow", status: "in_progress", submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString() },
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
    log(db, "System Seeder", "seed.populate", "settings", 1, "Added sample admins and queue data");
  }
  recomputeNextIds(db);
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
        db.registrations.push({ ...r, status: normalizeStatus(r.status || "new") });
      });
    }
    const missingUnits = mappedUnits.filter((u) => !db.units.some((x) => Number(x.id) === Number(u.id)));
    if (missingUnits.length) db.units.push(...missingUnits);
    const missingSubs = mappedSubs.filter((s) => !db.sub_units.some((x) => Number(x.unit_id) === Number(s.unit_id) && String(x.name) === String(s.name)));
    if (missingSubs.length) db.sub_units.push(...missingSubs);
    db.registrations = db.registrations.map((r) => ({ ...r, status: normalizeStatus(r.status) }));
    const changed = ensureDemoData(db);
    if (changed) writeDb(db);
    return db;
  } catch {
    return structuredClone(seed);
  }
}
function writeDb(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function normText(v) {
  return String(v ?? "").trim();
}
function normalizeStatus(s) {
  const map = { pending: "new", approved: "accepted", waitlisted: "in_progress" };
  return map[s] || s || "new";
}
function canAccessRegistration(admin, row) {
  if (!admin || admin.role === "super_admin") return true;
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
      admin: {
        id: admin.id,
        full_name: admin.full_name,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        service_unit_id: admin.service_unit_id,
        sub_unit_name: admin.sub_unit_name,
      },
    };
  },
  async logout() { return { ok: true }; },

  async stats(params = {}) {
    const db = readDb();
    let regs = db.registrations;
    if (params.viewer) regs = regs.filter((r) => canAccessRegistration(params.viewer, r));
    const totals = {
      registrations: regs.length,
      pending: regs.filter((r) => normalizeStatus(r.status) === "new").length,
      approved: regs.filter((r) => normalizeStatus(r.status) === "accepted").length,
      rejected: regs.filter((r) => r.status === "rejected").length,
      waitlisted: regs.filter((r) => normalizeStatus(r.status) === "in_progress").length,
      active_units: params.viewer?.role === "service_unit_leader" ? 1 : db.units.filter((u) => u.is_active === 1).length,
      this_week: regs.length,
    };
    const byUnitMap = {};
    regs.forEach((r) => { byUnitMap[r.unit_name || "Unknown"] = (byUnitMap[r.unit_name || "Unknown"] || 0) + 1; });
    const by_unit = Object.entries(byUnitMap).map(([unit_name, cnt]) => ({ unit_name, cnt }));
    const bySexMap = {};
    regs.forEach((r) => { bySexMap[r.sex || "Unknown"] = (bySexMap[r.sex || "Unknown"] || 0) + 1; });
    const by_sex = Object.entries(bySexMap).map(([sex, cnt]) => ({ sex, cnt }));
    const today = new Date();
    const trend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (13 - i));
      const day = d.toISOString().slice(0, 10);
      const cnt = regs.filter((r) => String(r.submitted_at || "").slice(0, 10) === day).length;
      return { day, cnt };
    });
    return { totals, by_unit, by_sex, trend, recent_activity: db.activity.slice(0, 10) };
  },

  async queue(params = {}) {
    const db = readDb();
    let rows = db.registrations.map((r) => ({ ...r, status: normalizeStatus(r.status) })).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    if (params.viewer) rows = rows.filter((r) => canAccessRegistration(params.viewer, r));
    if (params.status) rows = rows.filter((r) => normalizeStatus(r.status) === normalizeStatus(params.status));
    if (params.unit_id) rows = rows.filter((r) => Number(r.unit_id) === Number(params.unit_id));
    if (params.sub_unit) rows = rows.filter((r) => String(r.sub_unit || "").toLowerCase() === String(params.sub_unit || "").toLowerCase());
    if (params.sex) rows = rows.filter((r) => (r.sex || "") === params.sex);
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((r) => `${r.first_name} ${r.surname} ${r.email} ${r.phone1}`.toLowerCase().includes(q));
    }
    if (params.from) rows = rows.filter((r) => String(r.submitted_at).slice(0, 10) >= params.from);
    if (params.to) rows = rows.filter((r) => String(r.submitted_at).slice(0, 10) <= params.to);
    return paginate(rows, params.page, params.per_page);
  },
  async updateStatus(id, body) {
    const db = readDb();
    const row = db.registrations.find((r) => Number(r.id) === Number(id));
    if (!row) throw new Error("Registration not found.");
    const viewer = body.viewer || null;
    if (viewer && !canAccessRegistration(viewer, row)) throw new Error("Not allowed for this queue item.");
    const current = normalizeStatus(row.status);
    const target = normalizeStatus(body.status || current);
    const allowedTransitions = {
      new: ["in_progress", "accepted", "rejected"],
      in_progress: ["accepted", "rejected", "new"],
      accepted: ["accepted"],
      rejected: ["rejected"],
    };
    if (viewer?.role !== "super_admin" && !(allowedTransitions[current] || []).includes(target)) {
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
    db.registrations = db.registrations.filter((r) => Number(r.id) !== Number(id));
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
      data: db.admins.map((a) => ({
        ...(a),
        id: a.id,
        full_name: a.full_name,
        username: a.username,
        email: a.email,
        role: a.role,
        service_unit_name: db.units.find((u) => Number(u.id) === Number(a.service_unit_id))?.name || "",
        service_unit_id: a.service_unit_id ?? null,
        sub_unit_name: a.sub_unit_name || "",
        is_active: a.is_active,
        last_login: a.last_login,
      })),
    };
  },
  async createAdmin(body) {
    const db = readDb();
    const username = normText(body.username);
    const email = normText(body.email);
    const fullName = normText(body.full_name);
    const role = body.role || "viewer";
    const serviceUnitId = body.service_unit_id ? Number(body.service_unit_id) : null;
    const subUnitName = normText(body.sub_unit_name);
    const password = String(body.password ?? "");
    if (!username) throw new Error("Username is required.");
    if (!email) throw new Error("Email is required.");
    if (!fullName) throw new Error("Full name is required.");
    const existingByUsername = db.admins.find((a) => normText(a.username).toLowerCase() === username.toLowerCase());
    const existingByEmail = db.admins.find((a) => normText(a.email).toLowerCase() === email.toLowerCase());
    if (existingByUsername && existingByEmail && Number(existingByUsername.id) !== Number(existingByEmail.id)) {
      throw new Error("Username and email already belong to different accounts.");
    }
    const existing = existingByUsername || existingByEmail;

    if (role !== "super_admin" && !serviceUnitId) throw new Error("Service unit is required for leaders.");
    if (role === "sub_unit_leader" && !subUnitName) throw new Error("Sub-unit is required for sub-unit leaders.");

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
      existing.service_unit_id = serviceUnitId;
      existing.sub_unit_name = subUnitName;
      existing.is_active = Number(body.is_active ?? 1);
      if (password.trim()) existing.password = password;
      else if (!normText(existing.password)) existing.password = "Admin@1234";
      log(db, "Super Admin", "admin.reactivate", "admin", existing.id, `Reactivated admin ${existing.username}`);
      writeDb(db);
      return { data: existing };
    }

    const admin = {
      id: db.nextIds.admin++,
      full_name: fullName,
      username,
      email,
      password: password.trim() ? password : "Admin@1234",
      role,
      service_unit_id: serviceUnitId,
      sub_unit_name: subUnitName,
      is_active: Number(body.is_active ?? 1),
      last_login: null,
    };
    db.admins.push(admin);
    log(db, "Super Admin", "admin.create", "admin", admin.id, `Created admin ${admin.username}`);
    writeDb(db);
    return { data: admin };
  },
  async updateAdmin(id, body) {
    const db = readDb();
    const admin = db.admins.find((a) => Number(a.id) === Number(id));
    if (!admin) throw new Error("Admin not found.");
    const nextRole = body.role ?? admin.role;
    const nextServiceUnitId = body.service_unit_id !== undefined ? (body.service_unit_id ? Number(body.service_unit_id) : null) : admin.service_unit_id;
    const nextSubUnitName = body.sub_unit_name !== undefined ? body.sub_unit_name : admin.sub_unit_name;
    if (nextRole !== "super_admin" && !nextServiceUnitId) throw new Error("Service unit is required for leaders.");
    if (nextRole === "sub_unit_leader" && !nextSubUnitName) throw new Error("Sub-unit is required for sub-unit leaders.");
    admin.full_name = body.full_name ?? admin.full_name;
    admin.email = body.email ?? admin.email;
    admin.role = body.role ?? admin.role;
    admin.service_unit_id = body.service_unit_id !== undefined ? (body.service_unit_id ? Number(body.service_unit_id) : null) : admin.service_unit_id;
    admin.sub_unit_name = body.sub_unit_name !== undefined ? body.sub_unit_name : admin.sub_unit_name;
    admin.is_active = Number(body.is_active ?? admin.is_active);
    if (body.password) admin.password = body.password;
    log(db, "Super Admin", "admin.update", "admin", admin.id, `Updated admin ${admin.username}`);
    writeDb(db);
    return { data: admin };
  },
  async deleteAdmin(id) {
    const db = readDb();
    db.admins = db.admins.filter((a) => Number(a.id) !== Number(id));
    log(db, "Super Admin", "admin.delete", "admin", id, "Deleted admin");
    writeDb(db);
    return { ok: true };
  },

  async members(params = {}) {
    const db = readDb();
    let rows = db.registrations.map((r) => ({ ...r, status: normalizeStatus(r.status) })).filter((r) => r.status === "accepted");
    if (params.viewer) rows = rows.filter((r) => canAccessRegistration(params.viewer, r));
    if (params.unit_id) rows = rows.filter((r) => Number(r.unit_id) === Number(params.unit_id));
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((r) => `${r.first_name} ${r.surname} ${r.email} ${r.phone1}`.toLowerCase().includes(q));
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
    if (params.viewer?.role === "service_unit_leader") {
      const allowedRegs = new Set(
        db.registrations
          .filter((r) => canAccessRegistration(params.viewer, r))
          .map((r) => Number(r.id))
      );
      rows = rows.filter(
        (r) =>
          (r.entity_type === "registration" && allowedRegs.has(Number(r.entity_id))) ||
          r.admin_name === params.viewer.full_name
      );
    }
    if (params.viewer?.role === "sub_unit_leader") {
      const allowedRegs = new Set(
        db.registrations
          .filter((r) => canAccessRegistration(params.viewer, r))
          .map((r) => Number(r.id))
      );
      rows = rows.filter(
        (r) =>
          (r.entity_type === "registration" && allowedRegs.has(Number(r.entity_id))) ||
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
