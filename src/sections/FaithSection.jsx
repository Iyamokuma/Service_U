import { Field } from "../components/Field.jsx";
import { Select } from "../components/Inputs.jsx";
import { RadioGroup } from "../components/RadioGroup.jsx";
import { Collapse } from "../components/Collapse.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { YEARS_SINCE_1950, WOLBI_LEVELS } from "../data.js";

export function FaithSection({ form, set, errors }) {
  const bornAgain = form.bornAgain === "Yes";
  const wolbiYes = form.wolbi === "Yes";
  return (
    <section className="section">
      <SectionHead
        num="04"
        title="Spiritual background"
        desc="A few questions about your walk with Christ."
      />
      <div className="grid">
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
            <Collapse open={wolbiYes}>
              <div className="grid" style={{ gap: 20 }}>
                <Field
                  label="Year & level"
                  required
                  error={errors.wolbiDate}
                  span="2"
                  embedded
                >
                  <div className="date-split month-year-level">
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
