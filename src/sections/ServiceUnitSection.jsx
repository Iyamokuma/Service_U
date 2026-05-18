import { Fragment } from "react";
import { Collapse } from "../components/Collapse.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { SERVICE_UNITS } from "../data.js";

export function ServiceUnitSection({ form, set, errors, units = SERVICE_UNITS }) {
  const selected = units.find((u) => Number(u.id) === Number(form.unitId));
  const hasSubs = !!selected?.subs?.length;

  const rows = [];
  for (let i = 0; i < units.length; i += 2) {
    rows.push(units.slice(i, i + 2));
  }

  const renderUnit = (u) => (
    <button
      key={u.id}
      type="button"
      className="unit"
      aria-pressed={form.unitId === u.id}
      onClick={() => {
        set("unitId", u.id);
        if (!u.subs) set("subUnit", "");
      }}
    >
      <span className="unit-num">{String(u.id).padStart(2, "0")}</span>
      <span className="unit-name">{u.name}</span>
      {u.subs && <span className="unit-meta">{u.subs.length} sub-units</span>}
      <span className="unit-check">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5.2L4.1 7.3L8 3.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );

  return (
    <section className="section">
      <SectionHead
        num="07"
        title="Service unit"
        desc="Select one unit to serve in. If it lists sub-units, choose exactly one — you can only serve in one sub-unit."
      />

      <div className="unit-list">
        {rows.map((row, rIdx) => {
          const rowContainsSelectedWithSubs =
            hasSubs && row.some((u) => Number(u.id) === Number(selected.id));
          return (
            <Fragment key={rIdx}>
              {row.map(renderUnit)}
              {rowContainsSelectedWithSubs && (
                <div className="unit-sub-inline">
                  <Collapse open={true}>
                    <div className="sub-unit-wrap">
                      <div className="sub-unit-label">
                        {selected.name} — choose a sub-unit
                      </div>
                      <div className="sub-unit-chips">
                        {selected.subs.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="chip"
                            aria-pressed={form.subUnit === s}
                            onClick={() => set("subUnit", s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      {errors.subUnit && (
                        <div className="error-msg" style={{ marginTop: 10 }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle
                              cx="6"
                              cy="6"
                              r="5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                            />
                            <path
                              d="M6 3.5V6.5M6 8.3V8.5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                          {errors.subUnit}
                        </div>
                      )}
                    </div>
                  </Collapse>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {errors.unitId && (
        <div className="error-msg" style={{ marginTop: 10 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M6 3.5V6.5M6 8.3V8.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          {errors.unitId}
        </div>
      )}
    </section>
  );
}
