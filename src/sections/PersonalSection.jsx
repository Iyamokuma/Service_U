import { Field } from "../components/Field.jsx";
import { TextInput, Select } from "../components/Inputs.jsx";
import { RadioGroup } from "../components/RadioGroup.jsx";
import { DateSplit } from "../components/DateSplit.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { NATIONALITIES, YEARS_FULL } from "../data.js";

export function PersonalSection({ form, set, errors }) {
  return (
    <section className="section">
      <SectionHead
        num="01"
        title="Personal details"
        desc="Your legal names as they appear on official documents."
      />
      <div className="grid">
        <Field label="Surname" required error={errors.surname}>
          <TextInput
            value={form.surname}
            onChange={(v) => set("surname", v)}
            placeholder="e.g. Okafor"
            autoComplete="family-name"
            state={
              errors.surname ? "error" : form.surname ? "valid" : undefined
            }
          />
        </Field>
        <Field label="First name" required error={errors.firstName}>
          <TextInput
            value={form.firstName}
            onChange={(v) => set("firstName", v)}
            placeholder="e.g. Chinwe"
            autoComplete="given-name"
            state={
              errors.firstName ? "error" : form.firstName ? "valid" : undefined
            }
          />
        </Field>
        <Field label="Other names" optional span="2">
          <TextInput
            value={form.otherNames}
            onChange={(v) => set("otherNames", v)}
            placeholder="Middle names or names you also go by"
          />
        </Field>

        <Field
          label="Date of birth"
          required
          error={errors.dob}
          span="2"
          embedded
          hint="Year is optional — we use month and day for birthday greetings."
        >
          <DateSplit
            value={form.dob}
            onChange={(v) => set("dob", v)}
            includeDay
            includeYear
            yearRequired={false}
            yearRange={YEARS_FULL}
            error={errors.dob}
          />
        </Field>

        <Field label="Sex" required error={errors.sex}>
          <RadioGroup
            name="sex"
            value={form.sex}
            onChange={(v) => set("sex", v)}
            options={["Female", "Male"]}
          />
        </Field>
        <Field label="Marital status" required error={errors.maritalStatus}>
          <Select
            value={form.maritalStatus}
            onChange={(v) => set("maritalStatus", v)}
            options={["Single", "Married", "Widowed", "Divorced", "Separated"]}
            placeholder="Select status"
            state={
              errors.maritalStatus
                ? "error"
                : form.maritalStatus
                ? "valid"
                : undefined
            }
          />
        </Field>

        <Field
          label="Nationality"
          required
          error={errors.nationality}
          span="2"
        >
          <Select
            value={form.nationality}
            onChange={(v) => set("nationality", v)}
            options={NATIONALITIES}
            placeholder="Select country"
            state={
              errors.nationality
                ? "error"
                : form.nationality
                ? "valid"
                : undefined
            }
          />
        </Field>
      </div>
    </section>
  );
}
