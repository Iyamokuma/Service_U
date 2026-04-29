import { Field } from "../components/Field.jsx";
import { Select } from "../components/Inputs.jsx";
import { RadioGroup } from "../components/RadioGroup.jsx";
import { Collapse } from "../components/Collapse.jsx";
import { DateSplit } from "../components/DateSplit.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { MONTHS, YEARS_SINCE_1950, WOLBI_LEVELS } from "../data.js";

export function FaithSection({ form, set, errors }) {
  const bornAgain = form.bornAgain === "Yes";
  return (
    <section className="section">
      <SectionHead
        num="05"
        title="Faith journey"
        desc="Tell us about your walk with Christ."
      />
      <div className="grid">
        <Field
          label="When did you join the church?"
          required
          error={errors.joinedChurch}
          span="2"
          hint="Month and year of your first fellowship as a member."
        >
          <DateSplit
            value={form.joinedChurch}
            onChange={(v) => set("joinedChurch", v)}
            includeDay={false}
            includeYear
            yearRange={YEARS_SINCE_1950}
            error={errors.joinedChurch}
          />
        </Field>

        <Field label="Are you born again?" required error={errors.bornAgain} span="2">
          <RadioGroup
            name="bornAgain"
            value={form.bornAgain}
            onChange={(v) => set("bornAgain", v)}
            options={["Yes", "No"]}
          />
        </Field>
      </div>

      <Collapse open={bornAgain}>
        <div className="sub-panel">
          <Field
            label="Year you became born again"
            required
            error={errors.bornAgainYear}
          >
            <Select
              value={form.bornAgainYear}
              onChange={(v) => set("bornAgainYear", v)}
              options={YEARS_SINCE_1950}
              placeholder="Select year"
              state={
                errors.bornAgainYear
                  ? "error"
                  : form.bornAgainYear
                  ? "valid"
                  : undefined
              }
            />
          </Field>

          <div className="grid">
            <Field
              label="Completed Foundation Class?"
              required
              error={errors.foundation}
              span="2"
            >
              <RadioGroup
                name="foundation"
                value={form.foundation}
                onChange={(v) => set("foundation", v)}
                options={["Yes", "No"]}
              />
            </Field>
            <Collapse open={form.foundation === "Yes"}>
              <Field label="When?" required error={errors.foundationDate} span="2">
                <DateSplit
                  value={form.foundationDate}
                  onChange={(v) => set("foundationDate", v)}
                  includeDay={false}
                  includeYear
                  yearRange={YEARS_SINCE_1950}
                  error={errors.foundationDate}
                />
              </Field>
            </Collapse>
          </div>

          <div className="grid">
            <Field
              label="Water baptised?"
              required
              error={errors.baptised}
              span="2"
            >
              <RadioGroup
                name="baptised"
                value={form.baptised}
                onChange={(v) => set("baptised", v)}
                options={["Yes", "No"]}
              />
            </Field>
            <Collapse open={form.baptised === "Yes"}>
              <Field label="When?" required error={errors.baptisedDate} span="2">
                <DateSplit
                  value={form.baptisedDate}
                  onChange={(v) => set("baptisedDate", v)}
                  includeDay={false}
                  includeYear
                  yearRange={YEARS_SINCE_1950}
                  error={errors.baptisedDate}
                />
              </Field>
            </Collapse>
          </div>

          <div className="grid">
            <Field
              label="Attended WOLBI?"
              required
              error={errors.wolbi}
              span="2"
              hint="Word of Life Bible Institute."
            >
              <RadioGroup
                name="wolbi"
                value={form.wolbi}
                onChange={(v) => set("wolbi", v)}
                options={["Yes", "No"]}
              />
            </Field>
            <Collapse open={form.wolbi === "Yes"}>
              <div className="grid" style={{ gap: 20 }}>
                <Field
                  label="When & level"
                  required
                  error={errors.wolbiDate}
                  span="2"
                >
                  <div className="date-split month-year-level">
                    <Select
                      value={form.wolbiDate?.month || ""}
                      onChange={(v) =>
                        set("wolbiDate", { ...form.wolbiDate, month: v })
                      }
                      options={MONTHS.map((m, i) => [String(i + 1), m])}
                      placeholder="Month"
                      state={errors.wolbiDate ? "error" : undefined}
                    />
                    <Select
                      value={form.wolbiDate?.year || ""}
                      onChange={(v) =>
                        set("wolbiDate", { ...form.wolbiDate, year: v })
                      }
                      options={YEARS_SINCE_1950}
                      placeholder="Year"
                      state={errors.wolbiDate ? "error" : undefined}
                    />
                    <Select
                      value={form.wolbiDate?.level || ""}
                      onChange={(v) =>
                        set("wolbiDate", { ...form.wolbiDate, level: v })
                      }
                      options={WOLBI_LEVELS}
                      placeholder="Level"
                      state={errors.wolbiDate ? "error" : undefined}
                    />
                  </div>
                </Field>
              </div>
            </Collapse>
          </div>
        </div>
      </Collapse>
    </section>
  );
}
