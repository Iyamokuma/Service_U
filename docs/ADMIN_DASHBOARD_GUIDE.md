# Salvation Ministries Admin Portal — Complete Dashboard Guide

**Document version:** 1.0  
**Platform:** Service unit registration admin (`/admin`)  
**Audience:** Super Admins, General Admins, branch administrators, data entry staff, and service unit leaders

---

## Table of contents

1. [Introduction](#introduction)
2. [Signing in](#signing-in)
3. [Shared concepts](#shared-concepts)
4. [Feature reference — every tab explained](#feature-reference--every-tab-explained)
5. [Super Admin dashboard](#super-admin-dashboard)
6. [General Admin dashboard](#general-admin-dashboard)
7. [Data Entry Admin dashboard](#data-entry-admin-dashboard)
8. [Country Admin dashboard](#country-admin-dashboard)
9. [State Branch Admin dashboard](#state-branch-admin-dashboard)
10. [Satellite Pastor Admin dashboard](#satellite-pastor-admin-dashboard)
11. [Service Unit Leader dashboard](#service-unit-leader-dashboard)
12. [Sub-Unit Leader dashboard](#sub-unit-leader-dashboard)
13. [Approval workflows](#approval-workflows)
14. [Quick reference — who sees which tab](#quick-reference--who-sees-which-tab)

---

## Introduction

The **Salvation Ministries Admin Portal** is where staff review public registration applications, manage church locations, coordinate service units, and administer user accounts. Each person signs in with a **username or email** and **password**. What you see after login depends entirely on your **role** and **scope** (global, country, state, satellite church, service unit, or sub-unit).

This guide is organized in two ways:

- **Part 1 — Features:** Each sidebar tab is explained in plain language (what it is for, what you can do, and typical workflows).
- **Part 2 — Roles:** Each admin type gets a walkthrough of **their** menu items tab by tab.

For role permissions and limits (e.g. one Country Admin per country), see also `docs/ADMIN_ROLES.md`.

---

## Signing in

| Step | What to do |
|------|------------|
| 1 | Open the admin URL (e.g. `/admin` on your deployment). |
| 2 | Enter **username or email** and **password**. |
| 3 | Click **Sign in**. |

On success, the system loads your profile (name, role, branch, unit) and shows the sidebar for your role. Failed logins show an error message on the login card. Use **Sign out** at the bottom of the sidebar when finished.

**Note:** Usernames are **unique worldwide**. Country admins are often named like `gb.country.admin`, not a generic `country.admin`.

---

## Shared concepts

### Application (registration) statuses

Applications move through a pipeline. These are the main statuses:

| Status | Meaning |
|--------|---------|
| **New** | Just submitted; not yet reviewed. |
| **In progress** | A leader is working with the candidate (calls, meetings). |
| **Accepted** | Approved as a unit member. |
| **Rejected** | Not taken into the unit. |
| **Archived** | Closed record (e.g. after accept/reject). |

**Overdue** is not a separate status. Applications that stay **New** or **In progress** longer than the configured threshold also appear on the **Overdue** tab. Super / General Admins set the global overdue days under **Settings**; each service unit can override its own threshold.

### Accepting an application

When moving from **In progress** to **Accepted**, leaders must confirm:

- They **called the candidate**
- They invited them to a **physical meeting** in church  
- Optional checks: foundation class, water baptism (shown in verification modal)

These checks are stored on the record for audit purposes.

### Scope

**Scope** means which data you are allowed to see:

- **Global** — everything (Super Admin, General Admin, Data Entry for most data).
- **Country** — one `branch_country`.
- **State** — country + `branch_state`.
- **Satellite** — country + state + `satellite_site` (church branch name).
- **Service unit** — one ministry unit (e.g. Choir, Ushering).
- **Sub-unit** — one team inside that unit.

The top bar often shows your scope label under the page title.

### Theme and navigation

- **Light / Dark mode** — toggle in the top-right of the main area.
- **Sidebar badge** — the Application Queue tab can show a count of **new** applications in your scope.
- **Requests badge** — Super / General Admins see open request counts on the Requests tab.

### Notifications

The notification bell (when enabled) alerts you to items such as new admin requests. Overdue applications can trigger in-app and email alerts to sub-unit leaders, with escalation to service unit leaders and satellite pastors per platform settings.

---

## Feature reference — every tab explained

This section describes **each screen** regardless of role. Your role may hide some tabs entirely.

---

### Overview

**Also labeled:** Dashboard (service leaders), Country analytics, State analytics.

**Purpose:** High-level picture of registrations and activity in your scope.

**What you typically see:**

- **Stat cards** — Total registrations, pending review, approved, overdue, and sometimes active units or in-progress counts.
- **Filters** (Super / General Admin) — Country, state, satellite branch, service unit, sub-unit, status, gender, date submitted. Filters narrow all charts and totals on the page.
- **Registration pulse** — Trend chart over selectable days (e.g. 7, 28, 90, 365).
- **Registrations by unit** — Bar chart of volume per service unit.
- **Gender breakdown** — Counts by sex.
- **Status summary** — Chips for pending, approved, rejected, waitlisted.
- **Recent activity** — Latest audit events (logins, status changes, admin changes).

**Common actions:**

- Click **Overdue** or stat cards to jump to the Application Queue (where supported).
- Service Unit Leaders see extra analytics (trend + gender); Sub-Unit Leaders see a dedicated analytics block.

**Who has it:** Super Admin, General Admin, Service Unit Leader, Sub-Unit Leader. Country and State admins use **Country/State analytics** (same Overview page id) with supervisory copy. Data Entry and Satellite Pastor use other home screens instead.

---

### Application Queue / Intake Queue

**Purpose:** Work through incoming registration applications — search, filter, open details, and change status.

**Layout:**

1. **Status tabs** — All, New, In Progress, Accepted, Rejected, Archived, Overdue.
2. **Filters** — Search (name, email, phone), service unit, sub-unit, gender, date range, sort order.
3. **Table** — One row per applicant with key columns and expand/collapse for full details.
4. **Pagination** — Move through large lists (25 per page).

**Expanded row details include:**

Personal data, contact, branch (country, state, satellite), service unit and sub-unit, spiritual history (born again, foundation, baptism, WOLBI), photo, internal notes, and acceptance verification fields if already accepted.

**Actions:**

| Action | Who |
|--------|-----|
| Change status (modal or quick buttons) | Leaders; Country Admin on oversight screen |
| Accept with verification | Required for in progress → accepted |
| Delete registration | Super Admin and General Admin only |

**Leader-specific behavior:**

- Service Unit Leaders see per–sub-unit queue hints and can filter sub-units.
- Sub-Unit Leaders only see their own sub-unit’s applications.
- Overdue tab lists open items past the threshold, sorted by days overdue.

---

### Branch oversight — “Application queue” (Country & State)

**Purpose:** Supervisory view for **Country Admin** and **State Branch Admin** — one screen combining summary stats and a filterable application list (similar to the queue but framed for branch oversight).

**Summary cards (top):**

- Registrations in scope, pending, approved, units touched.

**Filters:**

Search, state (Country Admin only), service unit, sub-unit, status, gender, date range.

**Important difference:**

| Role | Can change application status? |
|------|-------------------------------|
| Country Admin | **Yes** — same accept/reject flow as leaders |
| State Branch Admin | **No** — view and filter only; status changes are done by unit leaders |

State admins use this screen to monitor progress across their state; country admins can intervene on status when needed.

---

### Unit Members

**Purpose:** List people whose applications are **Accepted** — your active member roster in scope.

**Features:**

- Search by name, email, phone.
- Filter by service unit, sub-unit, and (for country/state) branch state.
- Pagination and **Export CSV** for reporting.
- Read-only list (not the same as editing queue status).

**Scope:**

- Leaders see only their unit (and sub-unit for sub-unit leaders).
- Country / State admins see accepted members across their branch geography with extra filters.

---

### Service Units

**Purpose:** Manage the **catalog of ministry units** (e.g. Choir, Media) and their **sub-units** (teams inside each unit).

**Features:**

- Expand a unit to see sub-units.
- **Create unit** — Name, description, coordinator, sort order, active flag, optional overdue override per unit. Creating a unit can optionally create a **Service Unit Leader** account in the same flow.
- **Edit / delete unit** — Delete may be blocked if registrations or admins still reference the unit (confirmation with safety checks).
- **Create / edit / delete sub-units** under each unit.

**Who has it:** Super Admin and General Admin only. Other roles consume units in dropdowns but cannot change structure.

---

### Admin Accounts

**Purpose:** Create and maintain **login accounts** for other administrators and leaders.

**Features:**

- Table: name, username, email, role, scope, active/inactive, last login.
- **Create** / **Edit** / **Activate** / **Deactivate** / **Delete** (within your permission).
- **Export CSV** (global admins).
- Search and role filter (global admins).
- Pending admin requests banner when approvals are waiting.

**Create form fields:**

Full name, username, email, password, role, scope (country, state, satellite, unit, sub-unit), active status.

**Request flow:** Some roles submit a **request** instead of creating immediately; account becomes active after approval.

---

### Locations

**Purpose:** Manage the **geographic directory** that powers the public registration form — countries, states/regions, and satellite churches.

**Tabs inside the directory:**

| Tab | Contents |
|-----|----------|
| Satellite churches | Individual church sites (LGA, satellites) |
| All branches | Combined branch listing |
| States & regions | States within countries |
| Countries | Country directory entries |

**Actions:**

- Filter by continent, country, status, search.
- **New location** — Add country, state, or church (role-dependent).
- Open a row for **detail** — activate/deactivate churches, view member stats.
- Refresh directory data.

**Who can edit:** Super Admin, General Admin, Data Entry Admin, Country Admin (country-scoped; cannot add new countries as Country Admin).

---

### Branch directory

**Purpose:** Same underlying data as **Locations**, presented as a compact **browse/manage** view for global admins (sidebar label “Branch directory”).

Use it to explore the hierarchy and manage branches without the fuller Locations layout. Capabilities match Locations for editors.

---

### Requests

**Purpose:** Track **approval workflows** — things one admin submits for a higher admin to approve.

**Request types:**

| Type | Description |
|------|-------------|
| **Admin account** | New login for state, satellite, or leader roles |
| **Location catalog** | New country/state/satellite sites from data entry |
| **Service unit proposal** | New unit + sub-units proposed from the field |
| **General** | Other messages |

**Columns:** Date, submitter, role, type, details summary, status, actions.

**Statuses:** Open, in review, approved, rejected, resolved.

**Approvers:**

- Super / General Admin — most types, all locations.
- Country Admin — admin accounts from state/satellite in their country; service unit proposals in country.

Submitters without approve rights see **My requests** and can track status only.

---

### Announcements

**Purpose:** Send targeted messages to **members**, **leaders**, or **admins** by geography and unit.

**List view:**

- Title, audience summary, medium (email/SMS), schedule, workflow status.
- Edit/delete (creator or global admin).

**Create announcement:**

- Title and body.
- **Destination type** — Members, leaders, or admins.
- **Audience scope** — Country, state, satellite, service unit, sub-unit (options depend on your role; server clamps to your jurisdiction).
- **Medium** — Email and/or SMS (SMS requires provider configuration).
- Optional schedule time.

Lower roles cannot broadcast outside their scope.

---

### Activity Log

**Purpose:** **Audit trail** of important actions across the platform (or your country for Country Admin).

**Logged examples:**

- Admin login/logout, create/update/delete admin
- Unit create/update/delete
- Queue status changes, registration delete
- Settings updates, catalog changes, request approvals

**Filters:**

Search text, action type, admin user, entity type (registration, unit, admin), date range.

Use this for accountability and troubleshooting (“who changed this application?”).

---

### Settings

**Purpose:** **Platform configuration** — only Super Admin and General Admin.

**Sections:**

1. **Notification templates** — Text for approved, rejected, and waitlisted outcomes (used when notifying applicants).
2. **Overdue & alerts** — Global overdue threshold (1–30 days); explains escalation to unit leader and satellite pastor.
3. **User permissions** — Feature flags stored in app settings (enable/disable per permission key).

Click **Save Settings** after changes.

---

### Profile / Settings

**Purpose:** **Your own account** — not platform settings.

**Fields:**

- Full name  
- Email  
- New password (optional; leave blank to keep current)

Available to roles that do not see the global **Settings** page (leaders, country, state, satellite, data entry).

---

### Home — Data Entry dashboard

**Purpose:** Landing page for **Data Entry Admin**.

Explains that you add church locations via proposals. Button: **Propose new location** → opens the location proposal form.

---

### Propose new location

**Purpose:** Submit a **location catalog request** for Super / General Admin approval.

**Form flow:**

1. Select **continent** (loads countries).  
2. Select **country** (loads states).  
3. Select **state/region** (loads LGA/city list).  
4. Select **LGA/city**.  
5. Enter one or more **satellite church names** (add rows as needed).  
6. **Submit for approval**.

After approval, sites appear on the public registration form.

---

### Dashboard — Satellite Pastor

**Purpose:** Home for **Satellite Pastor Admin**.

**Stat cards:**

Total registrations, pending, approved, overdue, active team leader count.

**Quick actions:**

Application Queue, Admin Accounts, Announcements, My Requests.

---

## Super Admin dashboard

**Role summary:** Full platform owner. One active Super Admin per system. Only this role creates other Super Admin accounts.

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **Overview** | Global analytics with deep filters; trend charts; recent activity; jump to overdue queue. |
| **Application Queue** | All applications worldwide; full status control; delete registrations. |
| **Service Units** | Create/edit/delete units and sub-units; set per-unit overdue days. |
| **Unit Members** | All accepted members; export. |
| **Locations** | Full directory; add countries, states, churches. |
| **Branch directory** | Alternate directory browser. |
| **Admin Accounts** | Manage every role; export CSV; see pending requests. |
| **Announcements** | Broadcast to any audience. |
| **Requests** | Approve/reject all request types. |
| **Activity Log** | Full audit trail. |
| **Settings** | Templates, overdue, permissions. |

### Typical daily workflow

1. Check **Overview** for overdue and pending spikes.  
2. Work **Application Queue** or delegate to country/leaders.  
3. Process **Requests** (locations, new admins, units).  
4. Adjust **Service Units** or **Locations** as organization changes.  
5. Review **Activity Log** if issues are reported.

---

## General Admin dashboard

**Role summary:** Same operational power as Super Admin **except** managing Super Admin accounts. One active General Admin per system.

### Sidebar menu

Identical tabs to Super Admin.

### Differences from Super Admin

| Item | General Admin |
|------|----------------|
| Create Super Admin | No |
| Edit/delete Super Admin row | No (unless you are the Super Admin) |
| Everything else | Same as Super Admin |

Use **Admin Accounts** for General Admin, Country Admin, leaders, etc., but not for promoting someone to Super Admin.

---

## Data Entry Admin dashboard

**Role summary:** Add locations and support branch data globally. No platform settings or admin user management.

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **Home** | Read overview of data entry mission; link to propose location. |
| **Propose new location** | Submit location catalog requests. |
| **Locations** | View/edit directory within catalog rules. |
| **Activity Log** | See relevant audit events. |
| **Profile / Settings** | Update your name, email, password. |

### Typical workflow

1. Open **Propose new location**.  
2. Complete geography and satellite names.  
3. Submit and monitor approval (Super / General Admin **Requests** tab).  
4. Use **Locations** to verify or maintain existing entries if needed.

### What you do not have

Application Queue, Service Units, Admin Accounts, Announcements (as primary ops), Requests approval, Settings.

---

## Country Admin dashboard

**Role summary:** Lead administrator for **one country**. One active account per country code.

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **Country analytics** | Overview stats for your country only. |
| **Application queue** | Branch oversight: filter by state, unit, sub-unit; **update statuses**. |
| **Unit members** | Accepted members in your country. |
| **Admin accounts** | Manage state, satellite, and leader accounts in your country. |
| **Locations** | Directory edits **within your country** (not new countries). |
| **Requests & approvals** | Approve state/satellite admin requests and service unit proposals in country. |
| **Activity log** | Country-scoped audit events. |
| **Announcements** | Post to country-level audiences (and below per UI rules). |
| **Profile / Settings** | Your profile. |

### Admin accounts — what you manage

| Role | Direct create | Request required |
|------|---------------|------------------|
| State Branch Admin | Via request to Super/General | Yes |
| Satellite Pastor Admin | Create/request per process | Often request |
| Service Unit / Sub-Unit Leader | Yes, in country | Sub-units must already exist |

You **cannot** create another Country Admin, General Admin, or Super Admin.

### Typical workflow

1. Review **Country analytics** and **Application queue**.  
2. Approve **Requests** from state and satellite admins.  
3. Maintain **Admin accounts** for your branch structure.  
4. Post **Announcements** for national coordination.

---

## State Branch Admin dashboard

**Role summary:** Supervisory intake for **one state/region** within a country. One active account per state.

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **State analytics** | Stats for your state. |
| **Application queue** | View/filter applications; **cannot** change status (leaders action items). |
| **Unit members** | Accepted members in state. |
| **Admin accounts** | Request/manage **Satellite Pastor Admin** only. |
| **My requests** | Track submitted requests (e.g. new satellite pastor). |
| **Activity log** | State-scoped events. |
| **Announcements** | Post within state/satellite/unit scope. |
| **Profile / Settings** | Your profile. |

### Typical workflow

1. Monitor **State analytics** and **Application queue** for bottlenecks.  
2. Request new **Satellite Pastor Admin** via **Admin accounts** or **My requests**.  
3. Communicate via **Announcements** to satellites and leaders.

### What you do not have

Locations tab, Service Units, Settings, direct status changes on applications.

---

## Satellite Pastor Admin dashboard

**Role summary:** Pastoral oversight for **one satellite church** (country + state + site name).

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **Dashboard** | Registration stats, overdue, team leader count; quick links. |
| **Application Queue** | Applications for your satellite only; status updates. |
| **Admin Accounts** | View/request **Service Unit** and **Sub-Unit** leaders for your site. |
| **My Requests** | Track workforce account requests. |
| **Announcements** | Message your satellite, units, or sub-units. |
| **Profile / Settings** | Your profile. |

### Typical workflow

1. Start on **Dashboard** — check overdue and pending.  
2. Process **Application Queue**.  
3. Request team leaders under **Admin Accounts**.  
4. Send **Announcements** for meetings or deadlines.

### Team leaders

You see service unit and sub-unit leaders tied to your branch and satellite. New leader accounts go through **request** approval.

---

## Service Unit Leader dashboard

**Role summary:** Operate one **service unit** — intake queue, members, and sub-unit admins.

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **Dashboard** | Unit-scoped stats, trend chart, gender breakdown, in-progress across sub-units. |
| **Intake Queue** | All applications for your unit (filter sub-units if multiple). |
| **Members List** | Accepted members in your unit. |
| **Announcements** | Target your unit or specific sub-units. |
| **Sub-Unit Admins** | Create/edit/delete **Sub-Unit Leader** accounts directly. |
| **Activity Log** | Audit events. |
| **Profile / Settings** | Your profile. |

### Intake Queue — leader actions

- Tabs: All, New, In Progress, Accepted, Rejected, Archived, Overdue.  
- Quick status buttons for common transitions.  
- **Accept** opens verification modal (call + meeting).  
- Sub-unit leaders only see their sub-unit’s rows.

### Sub-Unit Admins tab

Create leaders with username, email, password, and **sub-unit name** (must already exist under your unit). You cannot invent new sub-unit names on the structure — Super / General Admin adds sub-units under **Service Units**.

---

## Sub-Unit Leader dashboard

**Role summary:** Narrowest leader role — one **sub-unit** team inside a service unit.

### Sidebar menu

| Tab | What you do here |
|-----|------------------|
| **Dashboard** | Sub-unit analytics (trend, status donut, gender). |
| **Intake Queue** | Only your sub-unit’s applications. |
| **Members List** | Accepted members in your sub-unit. |
| **Announcements** | Post to your sub-unit scope. |
| **Profile / Settings** | Your profile. |

### Typical workflow

1. Review **Dashboard** for pending/overdue.  
2. Work **Intake Queue** daily.  
3. Move candidates through New → In Progress → Accepted with verification.  
4. Announce reminders to your team via **Announcements**.

### What you do not have

Sub-Unit Admins tab (you cannot create other admins), Service Units, Admin Accounts, Requests, Locations, Settings.

---

## Approval workflows

### Admin account request

```
Country / State / Satellite admin fills form → Submit request → In review
    → Super/General (or Country for in-country state/satellite) approves
    → Account created and active
```

### Location catalog request

```
Data Entry submits Propose new location → Open request
    → Super/General approves → Sites published to registration form
```

### Service unit proposal

```
(Field proposal) → Country or Super/General approves → Unit + sub-units created in Service Units
```

---

## Quick reference — who sees which tab

| Tab | Super | General | Data entry | Country | State | Satellite | Unit leader | Sub-unit leader |
|-----|:-----:|:-------:|:----------:|:-------:|:-----:|:---------:|:-----------:|:---------------:|
| Overview / analytics | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ |
| Home (data entry) | — | — | ✓ | — | — | — | — | — |
| Satellite dashboard | — | — | — | — | — | ✓ | — | — |
| Application / intake queue | ✓ | ✓ | — | ✓* | ✓* | ✓ | ✓ | ✓ |
| Unit members | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ |
| Service units | ✓ | ✓ | — | — | — | — | — | — |
| Locations | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Branch directory | ✓ | ✓ | — | — | — | — | — | — |
| Admin accounts | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓** | — |
| Requests | ✓ | ✓ | — | ✓ | ✓*** | ✓*** | — | — |
| Announcements | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Activity log | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| Settings | ✓ | ✓ | — | — | — | — | — | — |
| Profile | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Propose location | — | — | ✓ | — | — | — | — | — |

\* Country oversight can action status; State oversight is view-only.  
\*\* Service Unit Leader tab is labeled **Sub-Unit Admins**.  
\*\*\* **My requests** for submitters; full **Requests & approvals** for Country Admin.

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | May 2026 | Initial full dashboard guide aligned with `src/admin` UI |

---

*Salvation Ministries — Service Unit Registration Admin Platform*
