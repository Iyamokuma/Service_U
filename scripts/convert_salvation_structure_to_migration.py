#!/usr/bin/env python3
"""
Reads salvation_ministries_structure.sql (countries/states/branches)
and emits Postgres SQL: directory_* tables + public.churches rows
mapped to branch_country / branch_state codes used by src/admin/branchRegions.js
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# --- Must match src/admin/branchRegions.js (Nigeria + GH + US minimal) ---
NIGERIA = [
    ("ABI", "Abia"),
    ("ADM", "Adamawa"),
    ("AKB", "Akwa Ibom"),
    ("ANA", "Anambra"),
    ("BAU", "Bauchi"),
    ("BAY", "Bayelsa"),
    ("BEN", "Benue"),
    ("BOR", "Borno"),
    ("CRV", "Cross River"),
    ("DE", "Delta"),
    ("EBY", "Ebonyi"),
    ("EDO", "Edo"),
    ("EKI", "Ekiti"),
    ("ENU", "Enugu"),
    ("FCT", "Federal Capital Territory"),
    ("GOM", "Gombe"),
    ("IMO", "Imo"),
    ("JIG", "Jigawa"),
    ("KAD", "Kaduna"),
    ("KAN", "Kano"),
    ("KAT", "Katsina"),
    ("KEB", "Kebbi"),
    ("KOG", "Kogi"),
    ("KWA", "Kwara"),
    ("LA", "Lagos"),
    ("NAS", "Nasarawa"),
    ("NIE", "Niger"),
    ("OGU", "Ogun"),
    ("OND", "Ondo"),
    ("OSU", "Osun"),
    ("OYO", "Oyo"),
    ("PLA", "Plateau"),
    ("RI", "Rivers"),
    ("SOK", "Sokoto"),
    ("TAR", "Taraba"),
    ("YOB", "Yobe"),
    ("ZAM", "Zamfara"),
]

NG_NAME_TO_CODE: dict[str, str] = {}
for code, name in NIGERIA:
    key = re.sub(r"\s+", " ", name.lower().strip())
    NG_NAME_TO_CODE[key] = code
    NG_NAME_TO_CODE[key + " state"] = code
    # Excel uses "Akwa-Ibom"
    if "akwa" in key:
        NG_NAME_TO_CODE["akwa ibom"] = code
        NG_NAME_TO_CODE["akwa-ibom"] = code

# directory country id -> catalog branch_country code (extend branchRegions when adding)
COUNTRY_ID_TO_CODE = {
    1: "NG",
    2: "ASIA",  # not in catalog yet — still stored for future
    3: "BJ",
    4: "CM",
    5: "GM",
    6: "GH",
    7: "CH",
    8: "AE",
    9: "GB",
    10: "US",
}


def norm_state_name(raw: str) -> str:
    s = raw.replace("''", "'").strip()
    s = s.lower()
    s = s.replace(" state", "").strip()
    s = s.replace("-", " ")
    s = re.sub(r"\s+", " ", s)
    return s


def nigeria_state_code(state_name: str) -> str | None:
    n = norm_state_name(state_name)
    if "fct" in n or "abuja" in n:
        return "FCT"
    if n in NG_NAME_TO_CODE:
        return NG_NAME_TO_CODE[n]
    # substring match for "cross river" etc.
    for code, proper in NIGERIA:
        p = norm_state_name(proper)
        if p == n or n.startswith(p) or p in n:
            return code
    return None


def ghana_state_code(state_name: str, branch_name: str, address: str) -> str:
    blob = f"{branch_name} {address}".upper()
    if "KUMASI" in blob or "ASHANTI" in blob:
        return "AS"
    return "GA"


def us_state_code(state_name: str, branch_name: str, address: str) -> str:
    blob = f"{branch_name} {address} {state_name}".upper()
    if "CALIFORNIA" in blob or " CA " in blob or ", CA" in blob:
        return "CA"
    if "TEXAS" in blob or " TX " in blob or ", TX" in blob:
        return "TX"
    # default US catalog fallback
    return "TX"


def parse_inserts(text: str, table: str) -> list[tuple]:
    prefix = f"INSERT INTO {table}"
    out: list[tuple] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line.upper().startswith(prefix.upper()):
            continue
        m = re.search(r"VALUES\s*\((.*)\)\s*;\s*$", line, re.I | re.S)
        if not m:
            continue
        vals = _split_sql_values(m.group(1))
        out.append(tuple(_unquote_sql_literal(v) for v in vals))
    return out


def _unquote_sql_literal(v: str) -> str:
    v = v.strip()
    if len(v) >= 2 and v[0] == "'" and v[-1] == "'":
        return v[1:-1].replace("''", "'")
    return v


def _split_sql_values(s: str) -> list[str]:
    """Split top-level comma-separated SQL VALUES (handles quoted strings)."""
    parts: list[str] = []
    cur: list[str] = []
    i = 0
    depth = 0
    in_str = False
    while i < len(s):
        ch = s[i]
        if in_str:
            cur.append(ch)
            if ch == "'":
                if i + 1 < len(s) and s[i + 1] == "'":
                    cur.append(s[i + 1])
                    i += 2
                    continue
                in_str = False
            i += 1
            continue
        if ch == "'":
            in_str = True
            cur.append(ch)
            i += 1
            continue
        if ch == "(":
            depth += 1
            cur.append(ch)
            i += 1
            continue
        if ch == ")":
            depth -= 1
            cur.append(ch)
            i += 1
            continue
        if ch == "," and depth == 0:
            parts.append("".join(cur).strip())
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    if cur:
        parts.append("".join(cur).strip())
    return parts


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    default_seed = repo / "supabase" / "seeds" / "salvation_ministries_structure.sql"
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else default_seed
    out = repo / "supabase" / "migrations" / "202605190001_salvation_ministries_directory.sql"
    text = src.read_text(encoding="utf-8", errors="replace")

    countries = {}  # id -> name
    for row in parse_inserts(text, "countries"):
        countries[int(row[0])] = row[1].replace("''", "'")

    states: dict[int, tuple[int, str]] = {}
    for row in parse_inserts(text, "states"):
        sid, cid, name = int(row[0]), int(row[1]), row[2].replace("''", "'")
        states[sid] = (cid, name)

    branches = []
    for row in parse_inserts(text, "branches"):
        bid, sid = int(row[0]), int(row[1])
        name = row[2].replace("''", "'")
        addr = row[3].replace("''", "'") if len(row) > 3 else ""
        branches.append((bid, sid, name, addr))

    lines: list[str] = []
    lines.append("-- Merged from salvation_ministries_structure.sql (Excel export)")
    lines.append("-- Postgres: directory mirrors + public.churches for the registration form")
    lines.append("")
    lines.append("create table if not exists public.directory_countries (")
    lines.append("  id integer primary key,")
    lines.append("  name text not null")
    lines.append(");")
    lines.append("")
    lines.append("create table if not exists public.directory_states (")
    lines.append("  id integer primary key,")
    lines.append("  country_id integer not null references public.directory_countries(id) on delete cascade,")
    lines.append("  name text not null")
    lines.append(");")
    lines.append("")
    lines.append("create table if not exists public.directory_branches (")
    lines.append("  id integer primary key,")
    lines.append("  state_id integer not null references public.directory_states(id) on delete cascade,")
    lines.append("  name text not null,")
    lines.append("  address text not null default ''")
    lines.append(");")
    lines.append("")
    lines.append("create index if not exists idx_directory_states_country on public.directory_states(country_id);")
    lines.append("create index if not exists idx_directory_branches_state on public.directory_branches(state_id);")
    lines.append("")
    lines.append("alter table public.directory_countries enable row level security;")
    lines.append("alter table public.directory_states enable row level security;")
    lines.append("alter table public.directory_branches enable row level security;")
    lines.append("drop policy if exists \"anon_read_directory_countries\" on public.directory_countries;")
    lines.append("create policy \"anon_read_directory_countries\" on public.directory_countries for select using (true);")
    lines.append("drop policy if exists \"anon_read_directory_states\" on public.directory_states;")
    lines.append("create policy \"anon_read_directory_states\" on public.directory_states for select using (true);")
    lines.append("drop policy if exists \"anon_read_directory_branches\" on public.directory_branches;")
    lines.append("create policy \"anon_read_directory_branches\" on public.directory_branches for select using (true);")
    lines.append("grant select on public.directory_countries to anon, authenticated;")
    lines.append("grant select on public.directory_states to anon, authenticated;")
    lines.append("grant select on public.directory_branches to anon, authenticated;")
    lines.append("")

    def esc(s: str) -> str:
        return s.replace("'", "''")

    lines.append("insert into public.directory_countries (id, name) values")
    lines.append(",\n".join(f"  ({k}, '{esc(v)}')" for k, v in sorted(countries.items())))
    lines.append("on conflict (id) do update set name = excluded.name;")
    lines.append("")
    lines.append("insert into public.directory_states (id, country_id, name) values")
    lines.append(",\n".join(f"  ({sid}, {cid}, '{esc(name)}')" for sid, (cid, name) in sorted(states.items())))
    lines.append("on conflict (id) do update set country_id = excluded.country_id, name = excluded.name;")
    lines.append("")
    lines.append("insert into public.directory_branches (id, state_id, name, address) values")
    chunk = ",\n".join(f"  ({bid}, {sid}, '{esc(nm)}', '{esc(ad)}')" for bid, sid, nm, ad in branches)
    lines.append(chunk)
    lines.append("on conflict (id) do update set state_id = excluded.state_id, name = excluded.name, address = excluded.address;")
    lines.append("")

    # public.churches — remote may have an unrelated table named churches (wrong columns).
    lines.append("do $salv_churches_legacy$")
    lines.append("begin")
    lines.append(
        "  if to_regclass('public.churches') is not null"
    )
    lines.append(
        "     and not exists ("
    )
    lines.append(
        "       select 1 from information_schema.columns"
    )
    lines.append(
        "       where table_schema = 'public' and table_name = 'churches' and column_name = 'branch_country'"
    )
    lines.append(
        "     ) then"
    )
    lines.append(
        "    execute format("
    )
    lines.append(
        "      'alter table public.churches rename to %I',"
    )
    lines.append(
        "      'churches_legacy_' || replace(gen_random_uuid()::text, '-', '_')"
    )
    lines.append(
        "    );"
    )
    lines.append(
        "  end if;"
    )
    lines.append(
        "end;"
    )
    lines.append(
        "$salv_churches_legacy$;"
    )
    lines.append("")
    lines.append("create table if not exists public.churches (")
    lines.append("  id bigserial primary key,")
    lines.append("  branch_country text not null,")
    lines.append("  branch_state text not null,")
    lines.append("  name text not null,")
    lines.append("  address text not null default '',")
    lines.append("  directory_branch_id integer references public.directory_branches(id) on delete set null,")
    lines.append("  is_active int not null default 1,")
    lines.append("  created_at timestamptz not null default now()")
    lines.append(");")
    lines.append("")
    lines.append("-- When churches already matched this shape but lacked newer columns, add them here.")
    lines.append("alter table public.churches add column if not exists address text not null default '';")
    lines.append("alter table public.churches add column if not exists directory_branch_id integer;")
    lines.append("alter table public.churches add column if not exists is_active int not null default 1;")
    lines.append("alter table public.churches add column if not exists created_at timestamptz not null default now();")
    lines.append("alter table public.churches drop constraint if exists churches_directory_branch_id_fkey;")
    lines.append("alter table public.churches add constraint churches_directory_branch_id_fkey")
    lines.append("  foreign key (directory_branch_id) references public.directory_branches(id) on delete set null;")
    lines.append(
        "create unique index if not exists churches_branch_country_state_name_uidx "
        "on public.churches (branch_country, branch_state, name);"
    )
    lines.append("")
    lines.append("alter table public.registrations add column if not exists satellite_site text not null default '';")
    lines.append("")
    lines.append("alter table public.churches enable row level security;")
    lines.append("drop policy if exists \"anon_read_churches\" on public.churches;")
    lines.append("create policy \"anon_read_churches\" on public.churches for select using (is_active = 1);")
    lines.append("grant select on public.churches to anon, authenticated;")
    lines.append("")

    catalog_ok: list[tuple[str, str, str, str, int]] = []
    skipped: list[str] = []

    for bid, sid, bname, addr in branches:
        if sid not in states:
            skipped.append(f"branch {bid} bad state_id {sid}")
            continue
        cid, sname = states[sid]
        if cid not in countries:
            skipped.append(f"branch {bid} bad country for state {sid}")
            continue
        bcountry = COUNTRY_ID_TO_CODE.get(cid)
        if not bcountry:
            skipped.append(f"branch {bid} unknown country_id {cid}")
            continue

        bstate: str | None = None
        if bcountry == "NG":
            bstate = nigeria_state_code(sname)
        elif bcountry == "GH":
            bstate = ghana_state_code(sname, bname, addr)
        elif bcountry == "US":
            bstate = us_state_code(sname, bname, addr)
        elif bcountry in ("BJ", "CM", "GM", "CH", "AE", "GB", "ASIA"):
            # single catalog state per country (see branchRegions.js)
            bstate = bcountry
        else:
            bstate = None

        if not bstate:
            skipped.append(f"branch {bid} could not map state '{sname}' country {bcountry}")
            continue

        catalog_ok.append((bcountry, bstate, bname, addr, bid))

    lines.append("-- Refresh churches from directory (idempotent)")
    lines.append("delete from public.churches where directory_branch_id is not null;")
    lines.append("")
    lines.append(
        "insert into public.churches (branch_country, branch_state, name, address, directory_branch_id, is_active) values"
    )
    lines.append(
        ",\n".join(
            f"  ('{esc(bc)}', '{esc(bs)}', '{esc(nm)}', '{esc(ad)}', {dbid}, 1)"
            for bc, bs, nm, ad, dbid in catalog_ok
        )
    )
    lines.append("on conflict (branch_country, branch_state, name) do update set")
    lines.append("  address = excluded.address,")
    lines.append("  directory_branch_id = excluded.directory_branch_id,")
    lines.append("  is_active = 1;")
    lines.append("")
    lines.append(f"-- skipped {len(skipped)} rows (see script log)")
    for s in skipped[:40]:
        lines.append(f"-- SKIP: {s}")
    if len(skipped) > 40:
        lines.append(f"-- ... and {len(skipped) - 40} more")

    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({len(catalog_ok)} churches, {len(skipped)} skipped)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
