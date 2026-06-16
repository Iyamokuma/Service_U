import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Inputs.jsx";
import { DateSplit } from "../components/DateSplit.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { YEARS_SINCE_1997 } from "../data.js";

export function ChurchMembershipSection({ form, set, errors }) {
  return (
    <section className="section">
      <SectionHead
        num="06"
        title="Church membership"
        desc="When you joined and how we identify you in church records."
      />
      <div className="grid">
        <Field
          label="When did you join the church?"
          required
          error={errors.joinedChurch}
          span="2"
          embedded
          hint="Month and year of your first fellowship as a member."
        >
          <DateSplit
            value={form.joinedChurch}
            onChange={(v) => set("joinedChurch", v)}
            includeDay={false}
            includeYear
            yearRange={YEARS_SINCE_1997}
            error={errors.joinedChurch}
          />
        </Field>
        <Field label="Tithe card number" optional>
          <TextInput
            value={form.titheCard}
            onChange={(v) => set("titheCard", v)}
            filter="numeric"
            placeholder="e.g. 04821"
            maxLength={20}
          />
        </Field>
        <Field label="Homecell name" optional>
          <TextInput
            value={form.homecell}
            onChange={(v) => set("homecell", v)}
            filter="alphanumeric"
            placeholder="Homecell you attend"
          />
        </Field>
      </div>
    </section>
  );
}
