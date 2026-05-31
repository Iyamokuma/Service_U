# Admin roles and capabilities

> **Full dashboard walkthrough (tab-by-tab, with PDF):** see [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) and download [ADMIN_DASHBOARD_GUIDE.pdf](./ADMIN_DASHBOARD_GUIDE.pdf).

This document describes each administrator role in the Salvation Ministries registration admin platform (`/admin`), what they can access in the UI, and how permissions are enforced on the API.

There are **eight** roles. Access is scoped by **role**, and for branch roles by **country**, **state/region**, and/or **satellite church**. Service leaders are scoped by **service unit** and optionally **sub-unit**.

---

## Quick reference

| Role | Display name | Scope | Account limit |
|------|----------------|-------|----------------|
| `super_admin` | Super Admin | Global | One active Super Admin |
| `general_admin` | General Admin | Global | One active General Admin |
| `data_entry_admin` | Data Entry Admin | Global (data) | No special limit |
| `country_super_admin` | Country Admin | One country | One active per country |
| `state_super_admin` | State Branch Admin | One state/region | One active per state |
| `satellite_church_admin` | Satellite Pastor Admin | One satellite site | No special limit |
| `service_unit_leader` | Service Unit Leader | Assigned service unit | No special limit |
| `sub_unit_leader` | Sub-Unit Leader | Assigned sub-unit | No special limit |

**Username and email** are unique across the entire platform (not per country).

---

## Hierarchy and approval flow

```text
Super Admin / General Admin
        │
        ├── Data Entry Admin (locations via request)
        ├── Country Admin (one per country)
        │       ├── State Branch Admin (one per state)
        │       ├── Satellite Pastor Admin
        │       ├── Service Unit Leader
        │       └── Sub-Unit Leader
        └── Service units & sub-units (structure: Super / General only)
```

### Request-based admin creation

These roles **cannot create downline admins directly**. New accounts are submitted as **admin account requests** and must be approved:

- Country Admin, State Branch Admin, Satellite Pastor Admin

| Requester | Can request roles | Typical approver |
|-----------|-------------------|------------------|
| Country Admin | State Branch Admin, Satellite Pastor Admin, Service Unit Leader, Sub-Unit Leader | Super Admin or General Admin |
| State Branch Admin | Satellite Pastor Admin only | Country Admin (in-country) or Super / General Admin |
| Satellite Pastor Admin | Service Unit Leader, Sub-Unit Leader | Upline (via request workflow) |

Super Admin, General Admin, and Service Unit Leaders **create admins directly** (no request) within their allowed roles.

---

## 1. Super Admin

**Purpose:** Platform owner with full control.

### Scope

- Global — all countries, states, registrations, and settings.

### Navigation (sidebar)

- Overview, Application Queue, Service Units, Unit Members  
- Locations, Branch directory  
- Admin Accounts, Announcements, Requests, Activity Log, **Settings**

### Capabilities

1. **Registrations**
   - View and process all applications globally.
   - Update status on any registration.
   - **Delete** registrations (only Super Admin and General Admin).

2. **Service units**
   - Create, update, and delete service units and sub-units.

3. **Admin accounts**
   - Create, edit, activate/deactivate, and delete any admin role.
   - **Only role that can create or assign another Super Admin** (and only one active Super Admin may exist).
   - Manage General Admin, Country Admin, State Branch Admin, and all downline roles.

4. **Branch directory / locations**
   - Full catalog edit: countries, states, churches, satellite sites.
   - Approve **location catalog** and **admin account** requests.

5. **Requests**
   - See all requests; approve, reject, or resolve.
   - Approve **service unit proposals**.

6. **Platform settings**
   - Overdue thresholds, templates, permissions (`Settings` page).

7. **Announcements**
   - Post to any audience scope; see all announcements.

8. **Activity log**
   - Full platform activity.

### Restrictions

- Cannot delete own account.
- System enforces **at most one active** Super Admin.

---

## 2. General Admin

**Purpose:** Day-to-day global operations without Super Admin account management.

### Scope

- Global — same data visibility as Super Admin for registrations and operations.

### Navigation

Same as Super Admin (full **Operations**, **Manage**, and **System** sections).

### Capabilities

Same as Super Admin **except**:

1. **Cannot create or edit Super Admin accounts** (UI hides `super_admin` on create; only root Super Admin can manage Super Admin rows).
2. Shares with Super Admin: delete registrations, service unit structure, settings, global requests, catalog (including new countries), announcements, admin management for all non–Super Admin roles.

### Restrictions

- **At most one active** General Admin account.
- Cannot assign `super_admin` role.

---

## 3. Data Entry Admin

**Purpose:** Add new church locations and support branch data globally, without platform configuration.

### Scope

- **All branches** for registration visibility and branch updates.
- No geographic lock on country/state (global data entry).

### Navigation

- Home (data entry dashboard)  
- Propose new location  
- Locations  
- Activity Log  
- Profile / Settings (not platform Settings)

### Capabilities

1. **Location proposals**
   - Submit **location catalog** requests (continent → country → state → LGA → satellite church names).
   - Proposals require **Super Admin or General Admin** approval before sites go live on the public form.

2. **Branch catalog**
   - View and edit branch directory (with Super / General / Country Admin catalog editors).
   - Use **Locations** and related catalog tools per `canEditBranchCatalog`.

3. **Registrations**
   - Global read access to the registration queue (same scope as Super / General for viewing).
   - **Update registration branch** (country/state) where allowed.

4. **Announcements**
   - Create announcements (audience clamped to permitted scope on the server).

5. **Activity log**
   - View activity (not country-filtered like Country Admin).

### Restrictions

- **No platform Settings** (overdue rules, templates, etc.).
- **No admin account management**.
- **No** service unit create/delete.
- **No** registration delete.
- Does not approve requests (submits only).

---

## 4. Country Admin (`country_super_admin`)

**Purpose:** Lead administrator for a single country.

### Scope

- **One country** (`branch_country` required).
- **One active account per country** (duplicate country blocked, including pending requests).

### Navigation

- Country analytics (overview)  
- Application queue (oversight with filters)  
- Unit members  
- Admin accounts  
- Locations  
- Requests & approvals  
- Activity log  
- Announcements  
- Profile / Settings

### Capabilities

1. **Registrations & members**
   - View and act on applications **in their country** only.
   - Country-level analytics and filtered oversight queue.
   - Update registration branch within country scope.

2. **Admin accounts** (within country)
   - Create, edit, activate/deactivate, and delete:
     - State Branch Admin  
     - Satellite Pastor Admin  
     - Service Unit Leader  
     - Sub-Unit Leader  
   - New downline accounts use **request flow** when created by Country Admin (submitted for Super / General approval for some roles; Country Admin can **approve** requests from State and Satellite admins in-country).

3. **Requests**
   - **Approve** admin account requests from **State Branch Admin** and **Satellite Pastor Admin** in the same country.
   - **Approve service unit proposals** in their country.
   - See requests from self and downline state/satellite admins.

4. **Branch catalog**
   - Edit locations **within their country** (cannot add new countries).

5. **Announcements**
   - Post with audience limited to **country** scope (UI and API clamp scope).

6. **Activity log**
   - Filtered to country admins and registrations in that country.

### Restrictions

- Cannot manage Super Admin, General Admin, or another Country Admin.
- Cannot add new **countries** to the directory.
- Cannot access platform **Settings**.
- Cannot delete registrations globally (Super / General only).
- Cannot create service units or sub-units (Super / General only).

---

## 5. State Branch Admin (`state_super_admin`)

**Purpose:** Supervisory intake and coordination for one state or region.

### Scope

- **Country + state/region** required.
- **One active account per state** (within a country).

### Navigation

- State analytics  
- Application queue (oversight)  
- Unit members  
- Admin accounts  
- My requests  
- Activity log  
- Announcements  
- Profile / Settings

### Capabilities

1. **Registrations & members**
   - View and process applications in **their state** only.
   - State-level filters on oversight and members lists.
   - Update registration branch within state scope.

2. **Admin accounts**
   - Manage **Satellite Pastor Admin** only (within same country and state).
   - **Request** new Satellite Pastor accounts (approval required); cannot create admins directly.

3. **Requests**
   - Submit and track **My requests** (e.g. new satellite pastor).
   - Cannot approve others’ requests (approvers: Super, General, or Country Admin per type).

4. **Announcements**
   - Post with scope up to **state** and below (state, satellite, unit, sub-unit per UI rules).

5. **Activity log**
   - Filtered to state scope.

### Restrictions

- No Locations page in sidebar (no branch catalog section).
- No platform Settings.
- Cannot manage Country Admin, State peers, service unit structure, or roles above satellite.
- Must use request flow for new satellite pastor admins.

---

## 6. Satellite Pastor Admin (`satellite_church_admin`)

**Purpose:** Pastoral oversight for one satellite church: team leaders, intake, and local announcements.

### Scope

- **Country + state + satellite site** (`satellite_site` required).

### Navigation

- Dashboard (stats and quick actions)  
- Application queue  
- Admin accounts (team leaders)  
- My requests  
- Announcements  
- Profile / Settings

### Capabilities

1. **Registrations**
   - View and process applications for their **satellite** (branch country, state, and satellite site).

2. **Admin accounts**
   - See **Service Unit Leader** and **Sub-Unit Leader** accounts at their satellite.
   - **Request** new service unit or sub-unit leader accounts (not direct create).

3. **Dashboard**
   - Registration totals, pending, approved, overdue, and active team leader count.

4. **Announcements**
   - Post to **satellite**, unit, and sub-unit audiences (scoped automatically).

5. **Requests**
   - Track submitted workforce (leader) account requests.

### Restrictions

- No unit members page as separate nav (uses oversight queue).
- No branch catalog or platform Settings.
- No service unit / sub-unit **structure** changes.
- Cannot manage Country or State admins.

---

## 7. Service Unit Leader (`service_unit_leader`)

**Purpose:** Operate the intake queue and sub-unit leaders for one service unit.

### Scope

- **Assigned service unit** (`service_unit_id` required).
- Typically also **country**, **state**, and optionally **satellite** on the account for branch-aware filtering.

### Navigation

- Dashboard  
- Intake queue  
- Members list  
- Announcements  
- Sub-unit admins  
- Activity log  
- Profile / Settings

### Capabilities

1. **Registrations**
   - Queue and members limited to their **service unit** (and branch fields when set).
   - Update application status with leader transition rules (e.g. accept requires call + physical meeting verification).
   - Overdue tracking and escalations apply to leader roles.

2. **Sub-unit admins**
   - **Create, edit, activate/deactivate, and delete** `sub_unit_leader` accounts for their unit **directly** (no request).
   - Sub-unit must already exist under the unit (structure created by Super / General Admin).

3. **Announcements**
   - Post to **unit** and **sub-unit** scope.

4. **Service units (read)**
   - See only their assigned unit and its sub-units.

### Restrictions

- Cannot create service units or sub-units.
- Cannot manage other service units or satellite/country/state admins.
- Cannot access platform Settings or global admin list.

---

## 8. Sub-Unit Leader (`sub_unit_leader`)

**Purpose:** Manage intake for a single sub-unit within a service unit.

### Scope

- **Service unit + sub-unit name** required.
- Optional country/state for branch filtering.

### Navigation

- Dashboard  
- Intake queue  
- Members list  
- Announcements  
- Profile / Settings (no sub-unit admin management)

### Capabilities

1. **Registrations**
   - Queue and members filtered to **unit + sub-unit**.
   - Same status transition rules as Service Unit Leader.

2. **Announcements**
   - Post with audience limited to **sub-unit** scope.

### Restrictions

- **Cannot** create or manage other admin accounts.
- **Cannot** change service unit structure.
- Narrowest operational role in the hierarchy.

---

## Shared capabilities (by feature)

### Application status workflow (leaders)

Service Unit Leaders and Sub-Unit Leaders (and other roles with queue access) move registrations through statuses such as `new` → `in_progress` → `accepted` / `rejected` → `archived`, with server-side validation. Accepting from `in_progress` requires confirming **candidate was called** and **physical meeting** was arranged.

### Announcements

All eight roles may create announcements (`canPostAnnouncements`). The API **clamps** geographic and unit fields to the poster’s jurisdiction. Announcement audience tiers depend on role (see `SCOPE_VISIBILITY` in the announcements UI).

### Registration data scope (API)

Enforced in `registration_scope.ts`:

| Role | Registration visibility |
|------|-------------------------|
| Super, General, Data Entry | All |
| Country Admin | `branch_country` |
| State Branch Admin | `branch_country` + `branch_state` |
| Satellite Pastor Admin | Country + state + `satellite_site` |
| Service Unit Leader | `unit_id` (+ branch if configured) |
| Sub-Unit Leader | `unit_id` + `sub_unit` (+ branch if configured) |

### Who can approve which requests

| Request type | Approvers |
|--------------|-----------|
| `admin_account` (from Country / State / Satellite) | Super Admin, General Admin; Country Admin for in-country State / Satellite requests |
| `location_catalog` | Super Admin, General Admin |
| `service_unit_proposal` | Super Admin, General Admin, Country Admin (in-country) |

### Branch catalog editors

Super Admin, General Admin, Data Entry Admin, and Country Admin (country-scoped). Country Admin cannot add new **countries**.

### Platform settings

Super Admin and General Admin only.

---

## Required fields by role

| Role | Country | State | Service unit | Sub-unit | Satellite site |
|------|---------|-------|--------------|----------|----------------|
| Super / General / Data Entry | — | — | — | — | — |
| Country Admin | Yes | — | — | — | — |
| State Branch Admin | Yes | Yes | — | — | — |
| Satellite Pastor Admin | Yes | Yes | — | — | Yes |
| Service Unit Leader | Yes* | Yes* | Yes | — | Optional* |
| Sub-Unit Leader | Yes* | Yes* | Yes | Yes | Optional* |

\*Required by validation when role is branch-scoped; leaders may also be configured with unit/sub-unit only depending on deployment.

---

