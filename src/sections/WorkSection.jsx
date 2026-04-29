import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Inputs.jsx";
import { SectionHead } from "./SectionHead.jsx";

export function WorkSection({ form, set }) {
  return (
    <section className="section">
      <SectionHead
        num="03"
        title="Work & church records"
        desc="All fields in this section are optional — share what you have."
      />
      <div className="grid">
        <Field label="Present place of work" optional span="2">
          <TextInput
            value={form.workplace}
            onChange={(v) => set("workplace", v)}
            placeholder="Company, school, or organization"
          />
        </Field>
        <Field label="Tithe card number" optional>
          <TextInput
            value={form.titheCard}
            onChange={(v) => set("titheCard", v)}
            placeholder="e.g. TC-04821"
          />
        </Field>
        <Field label="Homecell name" optional>
          <TextInput
            value={form.homecell}
            onChange={(v) => set("homecell", v)}
            placeholder="Homecell you attend"
          />
        </Field>
      </div>
    </section>
  );
}
