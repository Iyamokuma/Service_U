#!/usr/bin/env python3
"""Generate SQL migration from master_churches_cleaned.csv."""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "supabase/seeds/master_churches_cleaned.csv"
OUT_PATH = ROOT / "supabase/migrations/202606210001_reload_location_catalog_from_master_csv.sql"

COUNTRY_NAMES: dict[str, tuple[str, str]] = {
    "Nigeria": ("NG", "Nigeria"),
    "Ghana": ("GH", "Ghana"),
    "Benin": ("BJ", "Benin Republic"),
    "Cameroon": ("CM", "Cameroon"),
    "Gambia": ("GM", "Gambia"),
    "Switzerland": ("CH", "Switzerland"),
    "United Arab Emirates": ("AE", "United Arab Emirates"),
    "United Kingdom": ("GB", "United Kingdom"),
    "United States": ("US", "United States"),
    "United States / Canada": ("US", "United States"),
    "Canada": ("CA", "Canada"),
    "CANADA": ("CA", "Canada"),
    "CYPRUS": ("CY", "Cyprus"),
    "China": ("CN", "China"),
}

NIGERIA_STATE_CODES: dict[str, str] = {
    "Abia": "ABI",
    "Adamawa": "ADM",
    "Akwa Ibom": "AKB",
    "Anambra": "ANA",
    "Bauchi": "BAU",
    "Bayelsa": "BAY",
    "Benue": "BEN",
    "Borno": "BOR",
    "Cross River": "CRV",
    "Delta": "DE",
    "Ebonyi": "EBY",
    "Edo": "EDO",
    "Ekiti": "EKI",
    "Enugu": "ENU",
    "Federal Capital Territory": "FCT",
    "Gombe": "GOM",
    "Imo": "IMO",
    "Jigawa": "JIG",
    "Kaduna": "KAD",
    "Kano": "KAN",
    "Katsina": "KAT",
    "Kebbi": "KEB",
    "Kogi": "KOG",
    "Kwara": "KWA",
    "Lagos": "LA",
    "Nasarawa": "NAS",
    "Niger": "NIE",
    "Ogun": "OGU",
    "Ondo": "OND",
    "Osun": "OSU",
    "Oyo": "OYO",
    "Plateau": "PLA",
    "Rivers": "RI",
    "Sokoto": "SOK",
    "Taraba": "TAR",
    "Yobe": "YOB",
    "Zamfara": "ZAM",
}

US_STATE_CODES: dict[str, str] = {
    "Alabama": "AL",
    "Maryland": "MD",
    "Pennsylvania": "PA",
    "Texas": "TX",
}

EXPLICIT_STATE_CODES: dict[tuple[str, str], str] = {
    ("GH", "Ashanti Region"): "AS",
    ("GH", "Central Region"): "CR",
    ("GH", "Greater Accra"): "GA",
    ("GH", "Western Region"): "WR",
    ("BJ", "Littoral Department (Cotonou area)"): "COTONOU",
    ("BJ", "Littoral / Ouémé Department (Porto-Novo area)"): "PORTONOVO",
    ("CM", "Littoral Region (Douala area)"): "DOUALA",
    ("CM", "South West Region"): "SW",
    ("GM", "Kanifing Municipal Council"): "KANIFING",
    ("CH", "Geneva"): "GE",
    ("AE", "Dubai"): "DU",
    ("GB", "England (Greater London area)"): "LONDON",
    ("GB", "Scotland"): "SCOT",
    ("CA", "ONTARIO"): "ON",
    ("CA", "Ontario"): "ON",
    ("CY", "CYPRUS"): "CY",
    ("CN", "Guangzhou"): "GZ",
}


def slug_code(text: str, max_len: int = 12) -> str:
    return re.sub(r"[^A-Z0-9]", "", text.upper())[:max_len] or "REG"


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def state_code_for(country_code: str, state_name: str, used: set[str]) -> str:
    name = state_name.strip()
    if country_code == "NG":
        code = NIGERIA_STATE_CODES.get(name)
        if not code:
            raise ValueError(f"Unknown Nigeria state: {name!r}")
        return code
    if country_code == "US":
        code = US_STATE_CODES.get(name)
        if code:
            return code
    explicit = EXPLICIT_STATE_CODES.get((country_code, name))
    if explicit:
        code = explicit
    else:
        code = slug_code(name)
    base = code
    n = 2
    while code in used:
        suffix = str(n)
        code = (base[: max(1, 12 - len(suffix))] + suffix)[:12]
        n += 1
    used.add(code)
    return code


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(newline="", encoding="utf-8-sig")))
    if not rows:
        raise SystemExit("CSV is empty")

    countries: dict[str, tuple[str, str]] = {}
    states: dict[tuple[str, str], tuple[str, str]] = {}
    state_used_codes: dict[str, set[str]] = defaultdict(set)

    churches: list[dict[str, str]] = []
    unknown_countries: set[str] = set()

    for row in rows:
        country_raw = row["COUNTRY"].strip()
        if country_raw not in COUNTRY_NAMES:
            unknown_countries.add(country_raw)
            continue
        cc, cname = COUNTRY_NAMES[country_raw]
        countries[cc] = (cc, cname)
        st_name = row["STATE"].strip()
        st_key = (cc, st_name)
        if st_key not in states:
            sc = state_code_for(cc, st_name, state_used_codes[cc])
            states[st_key] = (sc, st_name)
        sc, _ = states[st_key]
        churches.append(
            {
                "country_code": cc,
                "state_code": sc,
                "name": row["SATELLITE_CHURCH_NAME"].strip(),
                "address": row["FULL_ADDRESS"].strip(),
                "continent": row["CONTINENT"].strip(),
            }
        )

    if unknown_countries:
        raise SystemExit(f"Unknown countries: {sorted(unknown_countries)}")

    country_order = sorted(countries.keys(), key=lambda c: countries[c][1])
    country_id: dict[str, int] = {cc: i + 1 for i, cc in enumerate(country_order)}

    state_order = sorted(states.keys(), key=lambda k: (country_id[k[0]], k[1]))
    state_id: dict[tuple[str, str], int] = {k: i + 1 for i, k in enumerate(state_order)}

    lines: list[str] = [
        "-- Replace all location catalog data from master_churches_cleaned.csv (897 churches).",
        "-- Source: supabase/seeds/master_churches_cleaned.csv",
        "",
        "delete from public.churches;",
        "delete from public.satellite_church_sites;",
        "delete from public.directory_branches;",
        "delete from public.directory_states;",
        "delete from public.directory_countries;",
        "",
        "alter sequence if exists public.churches_id_seq restart with 1;",
        "alter sequence if exists public.satellite_church_sites_id_seq restart with 1;",
        "",
        "insert into public.directory_countries (id, name, branch_country_code) values",
    ]

    country_values = [
        f"  ({country_id[cc]}, {sql_str(countries[cc][1])}, {sql_str(cc)})" for cc in country_order
    ]
    lines.append(",\n".join(country_values) + ";")
    lines.append("")
    lines.append("insert into public.directory_states (id, country_id, name, branch_state_code) values")
    state_values = [
        f"  ({state_id[k]}, {country_id[k[0]]}, {sql_str(states[k][1])}, {sql_str(states[k][0])})"
        for k in state_order
    ]
    lines.append(",\n".join(state_values) + ";")
    lines.append("")

    branch_id = 0
    branch_values: list[str] = []
    church_values: list[str] = []
    satellite_values: list[str] = []

    for i, ch in enumerate(churches, start=1):
        branch_id += 1
        st_key = next(k for k in state_order if k[0] == ch["country_code"] and states[k][0] == ch["state_code"])
        sid = state_id[st_key]
        branch_values.append(
            f"  ({branch_id}, {sid}, {sql_str(ch['name'])}, {sql_str(ch['address'])})"
        )
        church_values.append(
            f"  ({sql_str(ch['country_code'])}, {sql_str(ch['state_code'])}, {sql_str(ch['name'])}, {sql_str(ch['address'])}, {branch_id}, 1)"
        )
        satellite_values.append(
            f"  ({sql_str(ch['continent'])}, {sql_str(ch['country_code'])}, {sql_str(ch['state_code'])}, '', {sql_str(ch['name'])}, 1)"
        )

    lines.append("insert into public.directory_branches (id, state_id, name, address) values")
    lines.append(",\n".join(branch_values) + ";")
    lines.append("")
    lines.append(
        "insert into public.churches (branch_country, branch_state, name, address, directory_branch_id, is_active) values"
    )
    lines.append(",\n".join(church_values) + ";")
    lines.append("")
    lines.append(
        "insert into public.satellite_church_sites (continent, branch_country, branch_state, lga, site_name, is_active) values"
    )
    lines.append(",\n".join(satellite_values) + ";")
    lines.append("")

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")
    print(f"Countries: {len(country_order)}, States: {len(state_order)}, Churches: {len(churches)}")


if __name__ == "__main__":
    main()
