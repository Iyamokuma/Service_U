import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { SearchableSelect } from "../components/SearchableSelect.jsx";
import { fetchChurchesCatalog } from "../../lib/churchesCatalog.js";
import { satelliteSitesForBranch } from "../satelliteSites.js";
import { useToast } from "../components/Toast.jsx";
import { useAdminAuth } from "../AdminContext.jsx";
import { exportCsv } from "../exportCsv.js";
import { SERVICE_UNITS } from "../../data.js";
import {
  BRANCH_COUNTRIES,
  branchCountryLabel,
  branchStateLabel,
  branchStatesForCountry,
  coerceStateForCountry,
  defaultHeadquartersStateForCountry,
} from "../branchRegions.js";
import {
  isRootSuperAdmin,
  isGlobalAdminRole,
  canManageSuperAdminAccount,
  isServiceUnitLeader,
  isCountrySuperAdmin,
  isStateSuperAdmin,
  canCountryAdminManageRole,
  canStateAdminManageRole,
  mustUseRequestFlowForCreate,
} from "../roles.js";
import { isActingAsStateAdmin } from "../adminViewMode.js";
import { useAdminGeoFilters } from "../AdminGeoFilterContext.jsx";
import { matchesAdminGeo } from "../geoFilterUtils.js";
import { StateBranchAdminModal } from "../components/StateBranchAdminModal.jsx";
import { SatellitePastorAdminModal } from "../components/SatellitePastorAdminModal.jsx";
import { AdminRowActionsMenu, AdminRowActionsTrigger } from "../components/AdminRowActionsMenu.jsx";
import {
  buildAdminRowMenuItems,
  canShowGlobalAdminActionMenu,
  isAdminActive,
  nextAdminActiveValue,
} from "../components/adminRowMenuItems.js";
import { AdminReassignModal } from "../components/AdminReassignModal.jsx";
import {
  occupiedCountryCodes,
  ROLES_WITH_COUNTRY,
  ROLES_WITH_STATE,
  usesPlatformInviteCreate,
  ADMIN_EMAIL_INVITES_ENABLED,
  validateAdminForm,
} from "../adminAccountForm.js";
import { occupiedStateCodes } from "../stateAdminForm.js";
import { AdminInviteBanner } from "../components/AdminInviteBanner.jsx";
import { adminCreateButtonLabel, toastAfterAdminCreate } from "../adminInviteUi.js";

const ROLES = [
  { value: "general_admin", label: "General Admin", desc: "Full global access except creating Super Admin accounts." },
  {
    value: "country_super_admin",
    label: "Country Admin",
    desc: "One active account per country (location required). Manages that country’s applications, members, and branch admins.",
  },
  {
    value: "state_super_admin",
    label: "State Branch Admin",
    desc: "One active account per state/region (country + state required). Supervisory intake and filters for that state.",
  },
  { value: "data_entry_admin", label: "Data Entry Admin", desc: "Global registration intake and updates; custom home dashboard; no platform settings." },
  { value: "super_admin", label: "Super Admin", desc: "Platform owner — full access including Super Admin accounts." },
  { value: "satellite_church_admin", label: "Satellite Pastor Admin", desc: "Pastoral oversight for one satellite: team leaders, unit requests, announcements, registrations in branch scope." },
  { value: "service_unit_leader", label: "Service Unit Leader", desc: "Can manage assigned service unit." },
  { value: "sub_unit_leader", label: "Sub-unit Leader", desc: "Can manage assigned sub-unit only." },
];

function roleDisplayLabel(role) {
  if (!role) return "—";
  if (role === "general_admin") return "General Admin";
  if (role === "data_entry_admin") return "Data Entry Admin";
  if (role === "super_admin") return "Super Admin";
  if (role === "country_super_admin") return "Country Admin";
  if (role === "state_super_admin") return "State Branch Admin";
  if (role === "satellite_church_admin") return "Satellite Pastor Admin";
  return String(role)
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

function adminInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatAdminScope(a) {
  if (a.role === "super_admin" || a.role === "general_admin") return "Global";
  if (a.role === "data_entry_admin") return "All branches (data entry)";
  if (a.role === "country_super_admin") {
    const cc = a.branch_country_label || a.branch_country || "—";
    const st = a.branch_state_label || a.branch_state;
    return st ? `${cc} · HQ ${st}` : `${cc} (country)`;
  }
  if (a.role === "state_super_admin") return `${a.branch_country_label || "—"} · ${a.branch_state_label || "—"}`;
  if (a.role === "satellite_church_admin") {
    const geo = `${a.branch_country_label || "—"} · ${a.branch_state_label || "—"}`;
    const sat = String(a.satellite_site || "").trim();
    return sat ? `${geo} · ${sat}` : geo;
  }
  if (a.role === "service_unit_leader" || a.role === "sub_unit_leader") {
    const unitPart = `${a.service_unit_name || "—"}${a.sub_unit_name ? ` · ${a.sub_unit_name}` : ""}`;
    const hasGeo =
      String(a.branch_country || "").trim() ||
      String(a.branch_state || "").trim() ||
      String(a.satellite_site || "").trim();
    if (hasGeo) {
      const geo = `${a.branch_country_label || "—"} · ${a.branch_state_label || "—"}`;
      const sat = String(a.satellite_site || "").trim();
      return sat ? `${unitPart} · ${geo} · ${sat}` : `${unitPart} · ${geo}`;
    }
    return unitPart;
  }
  return `${a.service_unit_name || "—"}${a.sub_unit_name ? ` / ${a.sub_unit_name}` : ""}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(str) {
  if (!str) return "Never";
  const d = new Date(str);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Login names are globally unique; seed NG country admin uses country.admin — use per-country ids. */
function suggestedCountryAdminUsername(countryCode) {
  const cc = String(countryCode || "").trim().toLowerCase();
  return cc ? `${cc}.country.admin` : "";
}

function shouldAutoFillCountryAdminUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return !u || u === "country.admin" || /^[a-z]{2}\.country\.admin$/.test(u);
}

const PENDING_ADMIN_REQUEST_STATUSES = new Set(["open", "in_review"]);

function adminFromRequestPayload(req) {
  const payload = req?.payload && typeof req.payload === "object" ? req.payload : {};
  return payload.admin && typeof payload.admin === "object" ? payload.admin : {};
}

function isLeaderAdminRole(role) {
  const r = String(role || "").trim();
  return r === "service_unit_leader" || r === "sub_unit_leader";
}

export function AdminUsers({ data, units, reload, upsertAdminInList, removeAdminFromList }) {
  const toast = useToast();
  const { admin: me, viewMode } = useAdminAuth();
  const actingAsState = isActingAsStateAdmin(me, viewMode);
  const isRootSuper = isRootSuperAdmin(me?.role);
  const isGlobalAdmin = isGlobalAdminRole(me?.role);
  const geo = useAdminGeoFilters();
  const isCountryAdmin = isCountrySuperAdmin(me?.role) && !actingAsState;
  const isStateAdmin = isStateSuperAdmin(me?.role) || actingAsState;
  const isServiceLeader = isServiceUnitLeader(me?.role);
  const isSatellitePastor = me?.role === "satellite_church_admin";
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [satelliteFilter, setSatelliteFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingAdminRequests, setPendingAdminRequests] = useState([]);
  const [actionMenu, setActionMenu] = useState({ id: null, anchor: null });
  const [reassignModal, setReassignModal] = useState(null);
  const [stateBranchModal, setStateBranchModal] = useState(null);
  const [satelliteModal, setSatelliteModal] = useState(null);
  const [churchesCatalog, setChurchesCatalog] = useState([]);

  const loadPendingAdminRequests = useCallback(() => {
    if (!isCountryAdmin && !isGlobalAdmin && !isStateAdmin && !isSatellitePastor) return;
    api
      .requests({ per_page: 500, page: 1 })
      .then((res) => {
        setPendingAdminRequests(
          (res.data || []).filter(
            (r) => r.request_type === "admin_account" && PENDING_ADMIN_REQUEST_STATUSES.has(r.status),
          ),
        );
      })
      .catch(() => setPendingAdminRequests([]));
  }, [isCountryAdmin, isGlobalAdmin, isStateAdmin, isSatellitePastor]);

  useEffect(() => {
    loadPendingAdminRequests();
  }, [loadPendingAdminRequests, data]);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    fetchChurchesCatalog().then(setChurchesCatalog).catch(() => setChurchesCatalog([]));
  }, [isGlobalAdmin]);

  const scopedAdmins = (data?.data ?? []).filter((a) => {
    if (isGlobalAdmin) return !!a?.id;
    if (isCountryAdmin) {
      if (!a?.branch_country) return false;
      if (String(a.branch_country).toUpperCase() !== String(me?.branch_country || "").toUpperCase()) return false;
      return a.role === "state_super_admin";
    }
    if (isStateAdmin) {
      const cc = String(me?.branch_country || "").toUpperCase();
      const st = String(me?.branch_state || "").toUpperCase();
      if (!a?.branch_country || String(a.branch_country).toUpperCase() !== cc) return false;
      if (!st) return true;
      return String(a.branch_state || "").toUpperCase() === st;
    }
    if (isServiceLeader) return a.role === "sub_unit_leader" && Number(a.service_unit_id) === Number(me.service_unit_id);
    if (isSatellitePastor) {
      const cc = String(me?.branch_country || "").toUpperCase();
      const st = String(me?.branch_state || "").toUpperCase();
      const sat = String(me?.satellite_site || "").trim();
      const sameBranch =
        String(a.branch_country || "").toUpperCase() === cc && String(a.branch_state || "").toUpperCase() === st;
      const sameSat = String(a.satellite_site || "").trim() === sat;
      const leaderRole = a.role === "service_unit_leader" || a.role === "sub_unit_leader";
      return leaderRole && sameBranch && sameSat;
    }
    return false;
  });
  const visibilityFiltered = useMemo(
    () => scopedAdmins.filter((a) => showInactive || Number(a.is_active) === 1),
    [scopedAdmins, showInactive],
  );

  const admins = useMemo(() => {
    if (!isGlobalAdmin) return visibilityFiltered;
    const q = search.trim().toLowerCase();
    const countryCode = countryFilter === "all" ? "" : countryFilter;
    const stateCode = stateFilter === "all" ? "" : stateFilter;
    const satelliteName = satelliteFilter === "all" ? "" : satelliteFilter;
    const filtered = visibilityFiltered.filter((a) => {
      if (!matchesAdminGeo(a, geo.filters)) return false;
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (countryCode && String(a.branch_country || "").toUpperCase() !== countryCode) return false;
      if (stateCode && String(a.branch_state || "").toUpperCase() !== stateCode) return false;
      if (satelliteName && String(a.satellite_site || "").trim() !== satelliteName) return false;
      if (!q) return true;
      const hay = [
        a.full_name,
        a.username,
        a.email,
        roleDisplayLabel(a.role),
        formatAdminScope(a),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return filtered.sort((a, b) => {
      const roleOrder = (r) => {
        const order = {
          super_admin: 0,
          general_admin: 1,
          data_entry_admin: 2,
          country_super_admin: 3,
          state_super_admin: 4,
          satellite_church_admin: 5,
          service_unit_leader: 6,
          sub_unit_leader: 7,
        };
        return order[r] ?? 99;
      };
      const rd = roleOrder(a.role) - roleOrder(b.role);
      if (rd !== 0) return rd;
      return String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, { sensitivity: "base" });
    });
  }, [
    visibilityFiltered,
    isGlobalAdmin,
    search,
    roleFilter,
    countryFilter,
    stateFilter,
    satelliteFilter,
    geo.filters,
  ]);

  const countryFilterOptions = useMemo(() => {
    if (!isGlobalAdmin) return [];
    return [...new Set(visibilityFiltered.map((a) => String(a.branch_country || "").toUpperCase()).filter(Boolean))]
      .sort((a, b) => (branchCountryLabel(a) || a).localeCompare(branchCountryLabel(b) || b))
      .map((code) => ({ value: code, label: branchCountryLabel(code) || code }));
  }, [isGlobalAdmin, visibilityFiltered]);

  const stateFilterOptions = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const currentCountry = countryFilter === "all" ? "" : countryFilter;
    return [...new Set(
      visibilityFiltered
        .filter((a) => !currentCountry || String(a.branch_country || "").toUpperCase() === currentCountry)
        .map((a) => String(a.branch_state || "").toUpperCase())
        .filter(Boolean),
    )]
      .sort((a, b) => {
        const la = branchStateLabel(currentCountry, a) || a;
        const lb = branchStateLabel(currentCountry, b) || b;
        return la.localeCompare(lb);
      })
      .map((code) => ({ value: code, label: branchStateLabel(currentCountry, code) || code }));
  }, [isGlobalAdmin, visibilityFiltered, countryFilter]);

  const satelliteFilterOptions = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const currentCountry = countryFilter === "all" ? "" : countryFilter;
    const currentState = stateFilter === "all" ? "" : stateFilter;
    return [...new Set(
      visibilityFiltered
        .filter((a) => !currentCountry || String(a.branch_country || "").toUpperCase() === currentCountry)
        .filter((a) => !currentState || String(a.branch_state || "").toUpperCase() === currentState)
        .map((a) => String(a.satellite_site || "").trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));
  }, [isGlobalAdmin, visibilityFiltered, countryFilter, stateFilter]);

  const adminStats = useMemo(() => {
    if (!isGlobalAdmin) return null;
    const active = scopedAdmins.filter((a) => Number(a.is_active) === 1);
    return {
      total: scopedAdmins.length,
      active: active.length,
      inactive: scopedAdmins.length - active.length,
      country: active.filter((a) => a.role === "country_super_admin").length,
      state: active.filter((a) => a.role === "state_super_admin").length,
      pending: pendingAdminRequests.length,
    };
  }, [isGlobalAdmin, scopedAdmins, pendingAdminRequests]);
  const fallbackUnits = SERVICE_UNITS.map((u, idx) => ({
    id: u.id,
    name: u.name,
    sort_order: idx,
    sub_units: (u.subs || []).map((name, i) => ({ id: `${u.id}-${i}`, name, unit_id: u.id })),
  }));
  const unitList = (units?.data?.length ? units.data : fallbackUnits)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name)));

  const allAdmins = data?.data ?? [];

  async function refreshAdminsList(row) {
    if (row?.id) upsertAdminInList?.(row);
    if (reload) await reload();
  }

  async function save(form) {
    const takenCountries = occupiedCountryCodes(allAdmins, pendingAdminRequests, form.id);
    const takenStates = occupiedStateCodes(
      allAdmins,
      pendingAdminRequests,
      form.branch_country,
      form.id,
    );
    const inviteCreate = usesPlatformInviteCreate(me?.role, !!form.id);
    const validationMsg = validateAdminForm(form, {
      takenCountries,
      takenStates,
      isEdit: !!form.id,
      inviteCreate,
    });
    if (validationMsg) {
      toast(validationMsg, "error");
      return;
    }
    setSaving(true);
    try {
      const actorNeedsApproval = mustUseRequestFlowForCreate(me?.role, form.role) && !form.id;
      if (actorNeedsApproval) {
        const { id: _id, is_active: _active, viewer: _viewer, ...admin } = form;
        await api.createRequest({
          request_type: "admin_account",
          message: `New ${roleDisplayLabel(form.role)}: ${form.full_name} (${form.username})`,
          payload: { admin },
        });
        toast("Request submitted for upline approval. The account will be active once approved.", "success");
        loadPendingAdminRequests();
        if (reload) await reload();
      } else {
        const payload = { ...form, viewer: me };
        let savedRow = null;
        if (form.id) {
          const res = await api.updateAdmin(form.id, payload);
          savedRow = res?.data ? { ...form, ...res.data, id: form.id } : { ...form, id: form.id };
          toast("Admin updated.", "success");
        } else {
          const res = await api.createAdmin(payload);
          savedRow = res?.data ?? null;
          if (inviteCreate) {
            toastAfterAdminCreate(toast, { res, email: form.email, isEdit: false });
          } else {
            toast("Admin created.", "success");
          }
        }
        setModal(null);
        setStateBranchModal(null);
        setSatelliteModal(null);
        setReassignModal(null);
        await refreshAdminsList(savedRow);
      }
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function resendInvite(row) {
    closeActionMenu();
    try {
      await api.resendAdminInvite(row.id);
      toast(`Invitation email sent to ${row.email}.`, "success");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function toggleActive(admin) {
    const activating = !isAdminActive(admin);
    try {
      const nextActive = nextAdminActiveValue(admin);
      const res = await api.updateAdmin(admin.id, { is_active: nextActive, viewer: me });
      await refreshAdminsList(
        res?.data ? { ...admin, ...res.data, is_active: nextActive } : { ...admin, is_active: nextActive },
      );
      toast(activating ? "Admin activated." : "Admin deactivated.", "success");
    } catch (e) { toast(e.message, "error"); }
  }

  function handleExportAdmins() {
    if (!admins.length) { toast("No records to export.", "error"); return; }
    exportCsv(admins, {
      filename: `admin-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { key: "full_name", label: "Full Name" },
        { key: "username", label: "Username" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role", format: (v) => roleDisplayLabel(v) },
        { key: "id", label: "Scope/Service Unit", format: (_, row) => formatAdminScope(row) },
        { key: "is_active", label: "Status", format: (v) => Number(v) === 1 ? "Active" : "Inactive" },
        { key: "last_login", label: "Last Login", format: (v) => v ? new Date(v).toLocaleDateString() : "Never" },
      ],
    });
    toast(`Exported ${admins.length} admin${admins.length !== 1 ? "s" : ""}.`, "success");
  }

  function openCreateModal() {
    setModal({
      role: isCountryAdmin
        ? "state_super_admin"
        : isStateAdmin
          ? "satellite_church_admin"
          : isServiceLeader
            ? "sub_unit_leader"
            : isSatellitePastor
              ? "service_unit_leader"
              : "general_admin",
      service_unit_id: isServiceLeader ? me.service_unit_id : "",
      branch_country: isCountryAdmin || isStateAdmin || isSatellitePastor ? me.branch_country : "",
      branch_state: isStateAdmin || isSatellitePastor ? me.branch_state : "",
      satellite_site: isSatellitePastor ? me.satellite_site : "",
    });
  }

  async function removeAdmin(admin) {
    if (Number(admin.id) === Number(me?.id)) {
      toast("You cannot delete your own account.", "error");
      return;
    }
    const ok = window.confirm(`Delete ${admin.full_name} (${admin.username}) permanently?`);
    if (!ok) return;
    try {
      await api.deleteAdmin(admin.id, { viewer: me });
      removeAdminFromList?.(admin.id);
      if (reload) await reload();
      toast("Admin deleted.", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const actionTarget = useMemo(
    () => admins.find((a) => Number(a.id) === Number(actionMenu.id)),
    [admins, actionMenu.id],
  );

  function closeActionMenu() {
    setActionMenu({ id: null, anchor: null });
  }

  function openActions(e, row) {
    e.stopPropagation();
    if (actionMenu.id === row.id) {
      closeActionMenu();
      return;
    }
    setActionMenu({ id: row.id, anchor: e.currentTarget });
  }

  function openGlobalAdminEdit(row) {
    closeActionMenu();
    setReassignModal(null);
    setModal(null);
    if (row.role === "state_super_admin") {
      setStateBranchModal(row);
      setSatelliteModal(null);
      return;
    }
    if (row.role === "satellite_church_admin") {
      setSatelliteModal(row);
      setStateBranchModal(null);
      return;
    }
    setStateBranchModal(null);
    setSatelliteModal(null);
    setModal(row);
  }

  function openGlobalAdminReassign(row) {
    closeActionMenu();
    setReassignModal(row);
    setStateBranchModal(null);
    setSatelliteModal(null);
    setModal(null);
  }

  async function saveReassign(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form?.id) return;
    setSaving(true);
    try {
      const res = await api.updateAdmin(form.id, { ...form, viewer: me });
      toast(
        `Reassigned to ${roleDisplayLabel(form.role)}. Login unchanged; previous location data remains in the system.`,
        "success",
      );
      setReassignModal(null);
      await refreshAdminsList(res?.data ? { ...form, ...res.data, id: form.id } : form);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const globalActionMenuItems = useMemo(() => {
    if (!actionTarget || !isGlobalAdmin) return [];
    const isSelf = Number(actionTarget.id) === Number(me?.id);
    const canManageSuper = canManageSuperAdminAccount(me?.role);
    const canEdit = isSelf || actionTarget.role !== "super_admin" || canManageSuper;
    const canModifyOthers = !isSelf && (actionTarget.role !== "super_admin" || canManageSuper);

    const canResendInvite =
      ADMIN_EMAIL_INVITES_ENABLED &&
      canModifyOthers &&
      isGlobalAdmin &&
      !["super_admin", "general_admin"].includes(actionTarget.role) &&
      String(actionTarget.email || "").trim();

    const items = buildAdminRowMenuItems({
      row: actionTarget,
      includeReassign: canModifyOthers && isGlobalAdmin && !isLeaderAdminRole(actionTarget.role),
      onEdit: canEdit ? () => openGlobalAdminEdit(actionTarget) : undefined,
      onReassign:
        canModifyOthers && !isLeaderAdminRole(actionTarget.role)
          ? () => openGlobalAdminReassign(actionTarget)
          : undefined,
      onToggleActive: canModifyOthers
        ? () => {
            closeActionMenu();
            toggleActive(actionTarget);
          }
        : undefined,
      onDelete: canModifyOthers
        ? () => {
            closeActionMenu();
            removeAdmin(actionTarget);
          }
        : undefined,
    });

    if (canResendInvite) {
      items.splice(1, 0, {
        id: "resend-invite",
        label: "Resend invitation email",
        onClick: () => resendInvite(actionTarget),
      });
    }
    return items;
  }, [actionTarget, actionTarget?.is_active, isGlobalAdmin, isRootSuper, me?.id]);

  const createBtnLabel = isCountryAdmin
    ? "+ New State Branch Admin"
    : isStateAdmin
      ? "+ Request Satellite Pastor Admin"
      : isServiceLeader
        ? "+ New sub-unit admin"
        : isSatellitePastor
          ? "+ Request team leader"
          : "+ New Admin";

  async function saveStateBranchFromModal(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    await save(form);
    setStateBranchModal(null);
  }

  async function saveSatelliteFromModal(form, validationError) {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (!form) return;
    await save(form);
    setSatelliteModal(null);
  }

  const tableProps = {
    admins,
    me,
    isStateAdmin,
    isRootSuper,
    isCountryAdmin,
    isGlobalAdmin,
    isSatellitePastor,
    isServiceLeader,
    setModal,
    toggleActive,
    removeAdmin,
    useActionMenu: isGlobalAdmin,
    openActions,
    emptyText:
      isGlobalAdmin && (search.trim() || roleFilter !== "all")
        ? "No administrators match your filters."
        : "No admins yet.",
  };

  return (
    <>
      {isGlobalAdmin ? (
        <div className="sa-admins-page">
          <header className="sa-admins-hero">
            <div>
              <h1 className="sa-admins-title">Admin accounts</h1>
              <p className="sa-admins-subtitle">
                Reassign moves an administrator to a new role and dashboard (login stays the same). Location data
                they leave behind is not deleted.
              </p>
            </div>
            <div className="sa-admins-hero-actions">
              <button type="button" className="sa-btn sa-btn-outline" onClick={handleExportAdmins} disabled={!admins.length}>
                Export CSV
              </button>
              <button type="button" className="sa-btn sa-btn-primary" onClick={openCreateModal}>
                {createBtnLabel}
              </button>
            </div>
          </header>

          {adminStats && (
            <div className="sa-admins-stats" aria-label="Administrator summary">
              <div className="sa-admins-stat">
                <div className="sa-admins-stat-value">{adminStats.active}</div>
                <div className="sa-admins-stat-label">Active</div>
              </div>
              <div className="sa-admins-stat">
                <div className="sa-admins-stat-value">{adminStats.inactive}</div>
                <div className="sa-admins-stat-label">Inactive</div>
              </div>
              <div className="sa-admins-stat">
                <div className="sa-admins-stat-value">{adminStats.country}</div>
                <div className="sa-admins-stat-label">Country admins</div>
              </div>
              <div className="sa-admins-stat">
                <div className="sa-admins-stat-value">{adminStats.state}</div>
                <div className="sa-admins-stat-label">State branch admins</div>
              </div>
              {adminStats.pending > 0 ? (
                <div className="sa-admins-stat is-highlight">
                  <div className="sa-admins-stat-value">{adminStats.pending}</div>
                  <div className="sa-admins-stat-label">Pending approval</div>
                </div>
              ) : null}
            </div>
          )}

          {pendingAdminRequests.length > 0 && (
            <div className="sa-admins-pending" role="status">
              <span className="sa-admins-pending-icon" aria-hidden>
                ⏳
              </span>
              <div className="sa-admins-pending-body">
                <p className="sa-admins-pending-title">
                  {pendingAdminRequests.length} admin request{pendingAdminRequests.length !== 1 ? "s" : ""} awaiting
                  approval
                </p>
                <ul className="sa-admins-pending-list">
                  {pendingAdminRequests.map((r) => {
                    const a = adminFromRequestPayload(r);
                    return (
                      <li key={r.id}>
                        <span className="sa-fw-600">{a.full_name || "—"}</span>
                        <span className="sa-text-muted">· {roleDisplayLabel(a.role)}</span>
                        <span className="sa-badge in_review">In review</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          <div className="sa-card sa-admins-card">
            <div className="sa-card-head sa-admins-card-head">
              <div className="sa-admins-card-head-main">
                <div className="sa-card-title">All administrators</div>
                <p className="sa-admins-card-meta">
                  {admins.length} shown · {adminStats?.total ?? scopedAdmins.length} total in directory
                </p>
              </div>
            </div>
            <div className="sa-admins-filters" role="toolbar" aria-label="Filter administrators">
              <div className="sa-search">
                <span className="sa-search-icon" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="search"
                  placeholder="Search name, email, role, scope…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search administrators"
                />
              </div>
              <select
                className="sa-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                className="sa-select"
                value={countryFilter}
                onChange={(e) => {
                  setCountryFilter(e.target.value);
                  setStateFilter("all");
                  setSatelliteFilter("all");
                }}
                aria-label="Filter by country"
              >
                <option value="all">All countries</option>
                {countryFilterOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                className="sa-select"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setSatelliteFilter("all");
                }}
                aria-label="Filter by state"
              >
                <option value="all">All states</option>
                {stateFilterOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                className="sa-select"
                value={satelliteFilter}
                onChange={(e) => setSatelliteFilter(e.target.value)}
                aria-label="Filter by satellite"
              >
                <option value="all">All satellites</option>
                {satelliteFilterOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="sa-field-toggle">
                <span className="sa-field-toggle-label">Show inactive</span>
                <span className="sa-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                  <span className="sa-switch-ui" aria-hidden />
                </span>
              </label>
              <span className="sa-admins-filter-count">
                {admins.length} result{admins.length !== 1 ? "s" : ""}
              </span>
            </div>
            <AdminAccountsTable {...tableProps} className="sa-admins-table" />
          </div>

          <AdminRowActionsMenu
            open={!!actionMenu.id}
            anchorEl={actionMenu.anchor}
            onClose={closeActionMenu}
            items={globalActionMenuItems}
          />

          <StateBranchAdminModal
            open={!!stateBranchModal}
            countryCode={stateBranchModal?.branch_country}
            existingAdmins={allAdmins}
            pendingRequests={pendingAdminRequests}
            editData={stateBranchModal?.id ? stateBranchModal : null}
            saving={saving}
            onClose={() => setStateBranchModal(null)}
            onSave={saveStateBranchFromModal}
          />

          <SatellitePastorAdminModal
            open={!!satelliteModal}
            countryCode={satelliteModal?.branch_country}
            stateCode={satelliteModal?.branch_state}
            churches={churchesCatalog}
            existingAdmins={allAdmins}
            pendingRequests={pendingAdminRequests}
            editData={satelliteModal?.id ? satelliteModal : null}
            saving={saving}
            onClose={() => setSatelliteModal(null)}
            onSave={saveSatelliteFromModal}
          />

          <AdminReassignModal
            open={!!reassignModal}
            admin={reassignModal}
            existingAdmins={allAdmins}
            pendingRequests={pendingAdminRequests}
            unitList={unitList}
            isRootSuper={isRootSuper}
            saving={saving}
            onClose={() => setReassignModal(null)}
            onSave={saveReassign}
          />

          <AdminModal
            open={!!modal}
            data={modal}
            unitList={unitList}
            existingAdmins={allAdmins}
            pendingAdminRequests={pendingAdminRequests}
            onClose={() => setModal(null)}
            onSave={save}
            saving={saving}
            me={me}
            viewMode={viewMode}
          />
        </div>
      ) : (
        <>
          <div className="sa-admins-header-legacy">
            <div>
              <h2>{isSatellitePastor ? "Team leaders" : isCountryAdmin ? "State Branch Admins" : isStateAdmin ? "State admin accounts" : "Admin Accounts"}</h2>
              <p className="sa-text-muted sa-text-sm">
                {isCountryAdmin
                  ? `${admins.length} State Branch Admin${admins.length !== 1 ? "s" : ""} in ${branchCountryLabel(me?.branch_country) || "your country"}. One active account per state — assign from states in your country dataset. Satellite pastors are created by State Branch Admins.`
                  : isStateAdmin
                    ? `${admins.length} administrator${admins.length !== 1 ? "s" : ""} in ${branchStateLabel(me?.branch_country, me?.branch_state) || "your state"}. You can request Satellite Pastor Admin accounts.`
                    : isSatellitePastor
                      ? `${admins.length} leader account${admins.length !== 1 ? "s" : ""} under your satellite.`
                      : `${admins.length} visible / ${scopedAdmins.length} total administrator${scopedAdmins.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="sa-admins-hero-actions">
              {admins.length > 0 && (
                <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={handleExportAdmins}>
                  Export CSV
                </button>
              )}
              {(isServiceLeader || isCountryAdmin || isStateAdmin || isSatellitePastor) && (
                <label className="sa-field-toggle">
                  <span className="sa-field-toggle-label">Show inactive</span>
                  <span className="sa-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                    />
                    <span className="sa-switch-ui" aria-hidden />
                  </span>
                </label>
              )}
              {(isServiceLeader || isCountryAdmin || isStateAdmin || isSatellitePastor) && (
                <button type="button" className="sa-btn sa-btn-primary" onClick={openCreateModal}>
                  {createBtnLabel}
                </button>
              )}
            </div>
          </div>

          <div className="sa-card">
            <AdminAccountsTable {...tableProps} />
          </div>
        </>
      )}

      {(isCountryAdmin || isStateAdmin || isSatellitePastor) && pendingAdminRequests.length > 0 && (
        <div className="sa-card" style={{ marginBottom: 16 }}>
          <div className="sa-card-body">
            <h3 className="sa-fw-600" style={{ fontSize: 14, marginBottom: 8 }}>
              Pending approval ({pendingAdminRequests.length})
            </h3>
            <p className="sa-text-muted sa-text-sm" style={{ marginBottom: 12 }}>
              These accounts are awaiting upline approval and cannot sign in until approved.
            </p>
            <ul className="sa-text-sm" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              {pendingAdminRequests.map((r) => {
                const a = adminFromRequestPayload(r);
                return (
                  <li key={r.id}>
                    {a.full_name || "—"} · {roleDisplayLabel(a.role)} ·{" "}
                    <span className="sa-badge in_review">In review</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {isCountryAdmin ? (
        <StateBranchAdminModal
          open={!!modal}
          countryCode={me?.branch_country}
          existingAdmins={allAdmins.filter(
            (a) => String(a.branch_country || "").toUpperCase() === String(me?.branch_country || "").toUpperCase(),
          )}
          pendingRequests={pendingAdminRequests}
          initialStateCode={modal?.initialState || ""}
          editData={modal?.id ? modal : null}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={(form, validationError) => {
            if (validationError) {
              toast(validationError, "error");
              return;
            }
            if (!form) return;
            save(form);
          }}
        />
      ) : (
        <AdminModal
          open={!!modal}
          data={modal}
          unitList={unitList}
          existingAdmins={allAdmins}
          pendingAdminRequests={pendingAdminRequests}
          onClose={() => setModal(null)}
          onSave={save}
          saving={saving}
          me={me}
          viewMode={viewMode}
        />
      )}
    </>
  );
}

function AdminAccountsTable({
  admins,
  me,
  isStateAdmin,
  isRootSuper,
  isCountryAdmin,
  isGlobalAdmin,
  isSatellitePastor,
  isServiceLeader,
  setModal,
  toggleActive,
  removeAdmin,
  useActionMenu = false,
  openActions,
  emptyText = "No admins yet.",
  className = "",
}) {
  return (
    <div className={`sa-table-wrap${className ? ` ${className}` : ""}`}>
      {admins.length === 0 ? (
        <div className="sa-empty">
          <div className="sa-empty-icon">👤</div>
          <div className="sa-empty-text">{emptyText}</div>
        </div>
      ) : (
        <table className="sa-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Scope/Service Unit</th>
              <th>Status</th>
              <th>Last login</th>
              <th>{useActionMenu ? "Action" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="sa-admins-name-cell">
                    <div className="sa-avatar">{adminInitials(a.full_name)}</div>
                    <div className="sa-admins-name-text">
                      <div className="sa-fw-600">{a.full_name}</div>
                      {a.id === +me.id ? <span className="sa-badge viewer">You</span> : null}
                    </div>
                  </div>
                </td>
                <td className="sa-text-muted sa-text-sm">{a.username}</td>
                <td className="sa-truncate sa-text-sm">{a.email}</td>
                <td>
                  <span className={`sa-badge ${a.role}`}>{roleDisplayLabel(a.role)}</span>
                </td>
                <td className="sa-text-muted sa-text-sm sa-admins-scope-cell">{formatAdminScope(a)}</td>
                <td>
                  <span className={`sa-badge ${a.is_active ? "active" : "inactive"}`}>
                    {a.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="sa-text-muted sa-text-sm">{fmtDate(a.last_login)}</td>
                <td>
                  {useActionMenu ? (
                    canShowGlobalAdminActionMenu(a, me) ? (
                      <AdminRowActionsTrigger onOpen={(e) => openActions?.(e, a)} label="Action" />
                    ) : (
                      <span className="sa-text-muted sa-text-sm">—</span>
                    )
                  ) : (
                    <div className="sa-table-actions">
                      {!(a.role === "super_admin" && !canManageSuperAdminAccount(me?.role)) &&
                        (!isCountryAdmin || canCountryAdminManageRole(a.role)) &&
                        (!isStateAdmin || canStateAdminManageRole(a.role)) && (
                          <button type="button" className="sa-btn sa-btn-outline sa-btn-sm" onClick={() => setModal(a)}>
                            Edit
                          </button>
                        )}
                      {a.id !== +me.id &&
                        !(a.role === "super_admin" && !canManageSuperAdminAccount(me?.role)) &&
                        (!isCountryAdmin || canCountryAdminManageRole(a.role)) &&
                        (!isStateAdmin || canStateAdminManageRole(a.role)) && (
                          <button type="button" className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => toggleActive(a)}>
                            {a.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      {((isGlobalAdmin &&
                          a.id !== +me.id &&
                          (canManageSuperAdminAccount(me?.role) || a.role !== "super_admin")) ||
                          (isSatellitePastor && a.id !== +me.id) ||
                          (isServiceLeader && a.id !== +me.id && a.role === "sub_unit_leader") ||
                          (isCountryAdmin && a.id !== +me.id && canCountryAdminManageRole(a.role)) ||
                          (isStateAdmin && a.id !== +me.id && canStateAdminManageRole(a.role))) && (
                          <button type="button" className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => removeAdmin(a)}>
                            Delete
                          </button>
                        )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AdminModal({
  open,
  data,
  unitList,
  existingAdmins,
  pendingAdminRequests = [],
  onClose,
  onSave,
  saving,
  me,
  viewMode,
}) {
  const actingAsState = isActingAsStateAdmin(me, viewMode);
  const isRootSuper = isRootSuperAdmin(me?.role);
  const isGlobalAdmin = isGlobalAdminRole(me?.role);
  const isCountryAdmin = isCountrySuperAdmin(me?.role) && !actingAsState;
  const isStateAdmin = isStateSuperAdmin(me?.role) || actingAsState;
  const isSatellitePastor = me?.role === "satellite_church_admin";
  const isServiceLeader = isServiceUnitLeader(me?.role);
  const isEdit = !!data?.id;
  const inviteCreate = usesPlatformInviteCreate(me?.role, isEdit);
  const emptyForm = useCallback(
    () => ({
      full_name: "",
      username: "",
      email: "",
      password: "",
      role: isCountryAdmin
        ? "satellite_church_admin"
        : isStateAdmin
          ? "satellite_church_admin"
          : isServiceLeader
            ? "sub_unit_leader"
            : isSatellitePastor
              ? "service_unit_leader"
              : isGlobalAdmin
                ? "general_admin"
                : "service_unit_leader",
      service_unit_id: isServiceLeader ? me?.service_unit_id : "",
      sub_unit_name: "",
      branch_country: isCountryAdmin || isStateAdmin || isSatellitePastor ? me?.branch_country || "" : "",
      branch_state: isStateAdmin || isSatellitePastor ? coerceStateForCountry(me?.branch_country || "", me?.branch_state || "") : "",
      satellite_site: isSatellitePastor ? me?.satellite_site || "" : "",
      is_active: 1,
    }),
    [
      isServiceLeader,
      isGlobalAdmin,
      isCountryAdmin,
      isStateAdmin,
      isSatellitePastor,
      me?.service_unit_id,
      me?.branch_country,
      me?.branch_state,
      me?.satellite_site,
    ]
  );
  const [form, setForm] = useState(() => emptyForm());
  const [churches, setChurches] = useState([]);

  useEffect(() => {
    if (!open) {
      setChurches([]);
      return;
    }
    fetchChurchesCatalog()
      .then(setChurches)
      .catch(() => setChurches([]));
  }, [open]);

  const satelliteOptions = useMemo(
    () => satelliteSitesForBranch(churches, form.branch_country, form.branch_state),
    [churches, form.branch_country, form.branch_state],
  );

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (!data) {
      setForm(emptyForm());
      return;
    }
    if (data.id) {
      const country = data.branch_country || "";
      setForm({
        id: data.id,
        full_name: data.full_name || "",
        username: data.username || "",
        email: data.email || "",
        password: "",
        role:
          data.role ||
          (isServiceLeader ? "sub_unit_leader" : isGlobalAdmin ? "general_admin" : "service_unit_leader"),
        service_unit_id: data.service_unit_id || (isServiceLeader ? me?.service_unit_id : ""),
        sub_unit_name: data.sub_unit_name || "",
        branch_country: country,
        branch_state: coerceStateForCountry(country, data.branch_state || ""),
        satellite_site: data.satellite_site || "",
        is_active: data.is_active ?? 1,
      });
    } else {
      const country = data.branch_country || "";
      setForm({
        ...emptyForm(),
        role: data.role ?? emptyForm().role,
        service_unit_id: data.service_unit_id ?? emptyForm().service_unit_id,
        sub_unit_name: data.sub_unit_name ?? "",
        branch_country: country,
        branch_state: coerceStateForCountry(country, data.branch_state || ""),
        satellite_site: data.satellite_site ?? "",
      });
    }
  }, [open, data, emptyForm, isServiceLeader, isGlobalAdmin, me?.service_unit_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const selectedUnit = unitList.find((u) => Number(u.id) === Number(form.service_unit_id));

  const takenCountries = occupiedCountryCodes(existingAdmins, pendingAdminRequests, isEdit ? form.id : null);
  const countryOptions = BRANCH_COUNTRIES.filter((c) => {
    if (form.role !== "country_super_admin" || isEdit) return true;
    return !takenCountries.has(String(c.code).toUpperCase());
  });
  const takenStates = occupiedStateCodes(
    existingAdmins,
    pendingAdminRequests,
    form.branch_country,
    isEdit ? form.id : null,
  );
  const stateOptions = branchStatesForCountry(form.branch_country).filter((s) => {
    if (form.role !== "state_super_admin" || isEdit) return true;
    return !takenStates.has(String(s.code).toUpperCase());
  });

  const locationScopedRole = ROLES_WITH_COUNTRY.includes(form.role);
  const createBlocked =
    !isEdit &&
    ((form.role === "country_super_admin" && countryOptions.length === 0) ||
      (form.role === "state_super_admin" &&
        form.branch_country &&
        stateOptions.length === 0));

  return (
    <Modal
      open={open} onClose={onClose}
      title={
        isEdit
          ? isServiceLeader
            ? "Edit sub-unit admin"
            : "Edit Admin Account"
          : mustUseRequestFlowForCreate(me?.role, form?.role)
            ? "Request new admin account"
            : isServiceLeader
              ? "Create sub-unit admin"
              : "Create Admin Account"
      }
      size="md"
      footer={<>
        <button className="sa-btn sa-btn-outline" onClick={onClose}>Cancel</button>
        <button className="sa-btn sa-btn-primary" onClick={() => onSave(form)} disabled={saving || createBlocked}>
          {mustUseRequestFlowForCreate(me?.role, form.role) && !isEdit
            ? saving
              ? "Submitting…"
              : "Submit request"
            : adminCreateButtonLabel({ saving, isEdit })}
        </button>
      </>}
    >
      {inviteCreate ? <AdminInviteBanner /> : null}
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Full Name <span className="sa-required">*</span></label>
          <input className="sa-input" value={form.full_name} onChange={set("full_name")} placeholder="John Doe" />
        </div>
        {!inviteCreate ? (
          <div className="sa-field">
            <label className="sa-label">Username <span className="sa-required">*</span></label>
            <input
              className="sa-input"
              value={form.username}
              onChange={set("username")}
              placeholder={form.role === "country_super_admin" ? "gb.country.admin" : "johndoe"}
              disabled={isEdit}
            />
          </div>
        ) : null}
      </div>
      <div className="sa-field">
        <label className="sa-label">Email <span className="sa-required">*</span></label>
        <input className="sa-input" type="email" value={form.email} onChange={set("email")} placeholder="admin@church.org" />
      </div>
      {!inviteCreate ? (
        <div className="sa-field">
          <label className="sa-label">
            {isEdit ? "New Password (leave blank to keep current)" : "Password"}{" "}
            {!isEdit && <span className="sa-required">*</span>}
          </label>
          <input className="sa-input" type="password" value={form.password} onChange={set("password")} placeholder="Min 8 characters" />
        </div>
      ) : null}
      <div className="sa-form-row">
        <div className="sa-field">
          <label className="sa-label">Role</label>
          <select
            className="sa-field-select"
            value={form.role}
            disabled={isServiceLeader}
            onChange={(e) => {
              const role = e.target.value;
              const geoRoles = ROLES_WITH_COUNTRY;
              setForm((f) => {
                let branch_country = geoRoles.includes(role)
                  ? f.branch_country
                  : isCountryAdmin
                    ? me?.branch_country || ""
                    : "";
                let branch_state = ROLES_WITH_STATE.includes(role) ? f.branch_state : "";
                if (!isEdit && role === "country_super_admin") {
                  const cc = String(branch_country || "").toUpperCase();
                  if (cc && takenCountries.has(cc)) {
                    branch_country = "";
                    branch_state = "";
                  }
                }
                if (!isEdit && role === "state_super_admin") {
                  const cc = String(branch_country || "").toUpperCase();
                  const st = String(branch_state || "").toUpperCase();
                  if (st && takenStates.has(st)) branch_state = "";
                  if (cc && !branch_state && branchStatesForCountry(cc).every((s) => takenStates.has(String(s.code).toUpperCase()))) {
                    branch_country = "";
                  }
                }
                const next = {
                  ...f,
                  role,
                  service_unit_id: ["service_unit_leader", "sub_unit_leader"].includes(role) ? f.service_unit_id : "",
                  sub_unit_name: role === "sub_unit_leader" ? f.sub_unit_name : "",
                  branch_country,
                  branch_state,
                  satellite_site: role === "satellite_church_admin" ? f.satellite_site : "",
                };
                if (
                  role === "country_super_admin" &&
                  shouldAutoFillCountryAdminUsername(f.username)
                ) {
                  next.username = suggestedCountryAdminUsername(next.branch_country);
                }
                return next;
              });
            }}
          >
            {(isGlobalAdmin
              ? ROLES.filter((r) => {
                  if (r.value === "super_admin") {
                    if (!isEdit) return false;
                    return isRootSuper;
                  }
                  return true;
                })
              : isCountryAdmin
                ? ROLES.filter((r) => r.value === "state_super_admin")
                : isStateAdmin
                  ? ROLES.filter((r) => ["satellite_church_admin"].includes(r.value))
                  : isSatellitePastor
                    ? ROLES.filter((r) => ["service_unit_leader", "sub_unit_leader"].includes(r.value))
                    : ROLES.filter((r) => r.value === "sub_unit_leader")
            ).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {!(mustUseRequestFlowForCreate(me?.role, form.role) && !isEdit) ? (
          <div className="sa-field">
            <label className="sa-label">Status</label>
            <select className="sa-field-select" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: +e.target.value }))}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
        ) : (
          <div className="sa-field">
            <label className="sa-label">Status</label>
            <div className="sa-field-hint" style={{ marginTop: 6 }}>
              Submitted as <span className="sa-badge in_review">In review</span> until Super Admin approves.
            </div>
          </div>
        )}
      </div>

      {locationScopedRole && (
        <>
          <p className="sa-text-sm sa-fw-600" style={{ margin: "4px 0 8px" }}>
            Scope / location <span className="sa-required">*</span>
          </p>
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Country <span className="sa-required">*</span></label>
            <select
              className="sa-field-select"
              value={form.branch_country}
              onChange={(e) => {
                const branch_country = e.target.value;
                setForm((f) => {
                  const hqDefault =
                    f.role === "country_super_admin" && !isEdit
                      ? defaultHeadquartersStateForCountry(branch_country)
                      : "";
                  const next = {
                    ...f,
                    branch_country,
                    branch_state: hqDefault,
                    satellite_site: f.role === "satellite_church_admin" ? "" : f.satellite_site,
                  };
                  if (
                    f.role === "country_super_admin" &&
                    shouldAutoFillCountryAdminUsername(f.username)
                  ) {
                    next.username = suggestedCountryAdminUsername(branch_country);
                  }
                  return next;
                });
              }}
              disabled={isCountryAdmin || isStateAdmin || isSatellitePastor || (form.role === "country_super_admin" && isEdit)}
            >
              <option value="">Select country</option>
              {(form.role === "country_super_admin" && !isEdit ? countryOptions : BRANCH_COUNTRIES).map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {form.role === "country_super_admin" && !isEdit && countryOptions.length === 0 && (
              <div className="sa-field-hint">Every country already has a Country Admin (or one pending approval).</div>
            )}
          </div>
          {ROLES_WITH_STATE.includes(form.role) && (
            <div className="sa-field">
              <label className="sa-label">
                {form.role === "country_super_admin" ? "Headquarters state" : "State / region"}{" "}
                <span className="sa-required">*</span>
              </label>
              <select
                className="sa-field-select"
                value={form.branch_state}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    branch_state: e.target.value,
                    satellite_site: f.role === "satellite_church_admin" ? "" : f.satellite_site,
                  }))
                }
                disabled={
                  !form.branch_country ||
                  isStateAdmin ||
                  isSatellitePastor ||
                  (form.role === "state_super_admin" && isEdit)
                }
              >
                <option value="">{form.branch_country ? "Select state" : "Select country first"}</option>
                {(form.role === "state_super_admin" && !isEdit
                  ? stateOptions
                  : branchStatesForCountry(form.branch_country)
                ).map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              {form.role === "country_super_admin" && !isEdit && (
                <div className="sa-field-hint">
                  The Country Admin oversees the nation from this state and can switch to State Branch Admin tools for it.
                </div>
              )}
              {form.role === "state_super_admin" && !isEdit && form.branch_country && stateOptions.length === 0 && (
                <div className="sa-field-hint">Every state in this country already has a State Branch Admin (or one pending approval).</div>
              )}
            </div>
          )}
        </div>
        </>
      )}

      {form.role === "satellite_church_admin" && (
        <div className="sa-field">
          <label className="sa-label">Satellite church <span className="sa-required">*</span></label>
          <SearchableSelect
            value={form.satellite_site}
            onChange={(e) => setForm((f) => ({ ...f, satellite_site: e.target.value }))}
            options={satelliteOptions}
            disabled={!form.branch_country || !form.branch_state}
            placeholder={
              !form.branch_country
                ? "Select country first"
                : !form.branch_state
                  ? "Select state first"
                  : "Select satellite church"
            }
            searchPlaceholder="Search satellite churches…"
            emptyMessage="No satellite churches in this state"
            searchAriaLabel="Filter satellite churches"
          />
          <div className="sa-field-hint">
            {form.branch_country && form.branch_state && satelliteOptions.length === 0
              ? "No churches listed for this state yet. Add branches via Data Entry or approve a location request first."
              : "Pastor admin is scoped to this satellite within the selected state."}
          </div>
        </div>
      )}

      {["service_unit_leader", "sub_unit_leader"].includes(form.role) && (
        <div className="sa-form-row">
          <div className="sa-field">
            <label className="sa-label">Service Unit <span className="sa-required">*</span></label>
            <select
              className="sa-field-select"
              value={form.service_unit_id}
              onChange={(e) => setForm((f) => ({ ...f, service_unit_id: e.target.value, sub_unit_name: "" }))}
              disabled={isServiceLeader}
            >
              <option value="">Select unit</option>
              {(isServiceLeader ? unitList.filter((u) => Number(u.id) === Number(me.service_unit_id)) : unitList).map(
                (u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ),
              )}
            </select>
            {isSatellitePastor && (
              <div className="sa-field-hint">Choose the ministry unit this person leads (must already exist, or request a new unit first).</div>
            )}
          </div>
          {form.role === "sub_unit_leader" && (
            <div className="sa-field">
              <label className="sa-label">Sub-unit <span className="sa-required">*</span></label>
              <select className="sa-field-select" value={form.sub_unit_name} onChange={(e) => setForm((f) => ({ ...f, sub_unit_name: e.target.value }))}>
                <option value="">Select sub-unit</option>
                {(selectedUnit?.sub_units || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

