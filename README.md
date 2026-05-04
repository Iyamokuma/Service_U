# Service unit form — work log & reference

This README is a **plain-language record of what was built or changed** across recent work sessions (admin UI, API behavior, data, and deployment). Each block is labeled by **who it is for** (e.g. *Super Admin*) so you can tell scope apart quickly.

---

## Super Admin (global / `super_admin`)

**Admin accounts (`AdminUsers`)**

- **Create admin:** The first role in the list is labeled **General Admin**. The value sent to the API is still `super_admin` (unchanged).
- **Admin table:** That role is shown as **General Admin** in the list.
- **Edit admin:** The same role still appears as **Super Admin** in the role dropdown (only the *create* path uses the “General Admin” label for that option).
- **Inactive accounts:** The old “Show Inactive / Hide Inactive” text button was replaced with a **toggle** — label **“Show inactive”** — with a switch control. (Service unit leaders do not get this control; they only see active sub-unit leaders in their scope.)

**Service units (`ServiceUnits`)**

- **New unit:** A two-step flow: first **unit name + active/inactive**, then **service unit leader** (name, username, email, password). Unit details always come first; the leader is second and required for creation. Success copy explains that the leader is created under Admin Accounts and can sign in.
- **Edit unit:** The modal only asks for **unit name** and **status** (active vs inactive). Description, coordinator, and sort order were **removed from this screen** so super admins are not asked to maintain them there. On save, existing description/coordinator/sort data in storage is **kept** (not wiped) by still sending the full record from the form state.

**Other super-admin–only or global areas (from the same development period)**

- **Settings** and full **admin user** management (create/delete scope) remain super-admin–oriented as before.
- **Overview** and **queue** see the full feature set (tabs, branch editing where allowed, etc.).

---

## Service unit leaders & sub-unit leaders

- After login, **service unit and sub-unit names** show correctly in the **sidebar**, **top bar**, and **welcome** copy; refreshing the session keeps labels in sync if a unit was renamed in data.
- **Overview** is **role-aware**: e.g. sub-unit–focused metrics where it applies, gender card for service unit leaders, richer analytics/charts where the global super admin view applies.
- **Unit members** includes **sub-unit filtering** for service unit leaders.
- **Queue** behavior and filters respect **leader scope** (unit / sub-unit), with fixes so the page does not break when permissions or load order change.

---

## Country super admin & state super admin

- Dashboard and admin actions stay **scoped to country or state** (branch fields, visibility rules) as implemented in the API and admin UI (registrations, admins, etc.).

---

## Queue (all roles that use it)

- **Intake / status-style tabs** (including ways to work with **archived** and **overdue**-style views where implemented).
- **Archive** actions and **filter** behavior aligned to role.
- **Bugfix:** Queue **blank screen** resolved by defining **`canEditBranch`** correctly and aligning **data load dependencies** with the logged-in admin.

---

## API & stored data (`api.js`, browser `localStorage`)

- **Admin roster:** User-created admins are **merged** with seed data instead of being dropped when the app loads.
- **Queue:** Filters, stats/trends, and **branch country/state** updates on registrations where policy allows (e.g. super admin).
- **Cleanup:** Legacy **Media Graphics** sub-units removed from persisted demo data where applicable.
- **Units / subs:** Create and update flows for service units and sub-units; leader provisioning tied to **new unit** creation.

---

## Public form & curriculum data (`data.js`)

- **WOLBI levels** set to **Basic**, **Advance**, **Diploma** (replacing older labels where they existed).

---

## Netlify & GitHub

- **`netlify.toml`:** Build command `npm run build`, publish directory **`dist`**, **`NODE_VERSION=20`** for compatibility with the Vite toolchain, and **SPA redirects** so `/admin/*` and other client routes load `index.html` with status 200.
- **`public/_redirects`:** Same redirect rules for the built site.
- **`main`** has been **pushed to GitHub**; if the Netlify site is **connected to this repo**, each push can trigger a **new deploy**.

---

## Styling (`admin.css`)

- **Service unit** create flow: removed the old horizontal “slide” wizard track; steps are shown one at a time with simpler layout classes.
- **Toggle** styles for **“Show inactive”** on the admin list, including **focus** and **dark theme** for the switch track.

---

## Quick reference — run locally

| | |
| --- | --- |
| Public app | `http://localhost:5173/` |
| Admin portal | `http://localhost:5173/admin` |

```bash
npm install
npm run dev     # dev server
npm run build   # output in dist/ (same as Netlify)
```

**Demo logins (localStorage-backed demo DB)**

| Role | Username or email | Password |
| --- | --- | --- |
| Super Admin | `superadmin` or `superadmin@smhos.org` | `Admin@1234` |
| Service Unit Leader (e.g. Media & Service) | `chuks` or `chuks@smhos.org` | `Ibiyeomie@58` |
| Sub-Unit Leader (e.g. Audio) | `inatimi` or `inatimi@smhos.org` | `Ibiyeomie@58` |
| Country Super Admin (Nigeria) | `country.admin` or `country.admin@smhos.org` | `Ibiyeomie@58` |
| State Super Admin (Rivers) | `rivers.state` or `rivers.state@smhos.org` | `Ibiyeomie@58` |

**Storage note:** Admin demo data lives in browser **localStorage** (e.g. `sm_admin_demo_db_v1`). A **roster revision** key may reset or merge lists when the app version changes. If logins or data look wrong, clear site data for this origin and refresh.
