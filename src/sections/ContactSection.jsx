import { Field } from "../components/Field.jsx";
import { TextInput, TextArea } from "../components/Inputs.jsx";
import { SectionHead } from "./SectionHead.jsx";
import { isEmail, isPhone } from "../data.js";

export function ContactSection({ form, set, errors }) {
  return (
    <section className="section">
      <SectionHead
        num="02"
        title="Contact information"
        desc="How we can reach you and where you live."
      />
      <div className="grid">
        <Field label="Residential address" required error={errors.address} span="2">
          <TextArea
            value={form.address}
            onChange={(v) => set("address", v)}
            filter="address"
            placeholder="Street, area, city, state"
            state={errors.address ? "error" : form.address ? "valid" : undefined}
          />
        </Field>
        <Field label="Nearest bus stop" required error={errors.busStop} span="2">
          <TextInput
            value={form.busStop}
            onChange={(v) => set("busStop", v)}
            filter="alphanumeric"
            placeholder="e.g. Rumuokoro Junction"
            state={errors.busStop ? "error" : form.busStop ? "valid" : undefined}
          />
        </Field>

        <Field
          label="Primary phone"
          required
          error={errors.phone1}
          hint="Digits only. Include country code if abroad (e.g. 2348030000000)."
        >
          <TextInput
            type="tel"
            filter="numeric"
            value={form.phone1}
            onChange={(v) => set("phone1", v)}
            placeholder="8030000000"
            maxLength={15}
            autoComplete="tel"
            state={
              errors.phone1
                ? "error"
                : form.phone1 && isPhone(form.phone1)
                  ? "valid"
                  : undefined
            }
          />
        </Field>
        <Field label="Second phone" optional error={errors.phone2}>
          <TextInput
            type="tel"
            filter="numeric"
            value={form.phone2}
            onChange={(v) => set("phone2", v)}
            placeholder="Alternate number"
            maxLength={15}
            state={
              errors.phone2
                ? "error"
                : form.phone2 && isPhone(form.phone2)
                  ? "valid"
                  : undefined
            }
          />
        </Field>

        <Field
          label="Email address"
          required
          error={errors.email}
          span="2"
          hint="We will send a confirmation to this address. One registration per email."
        >
          <TextInput
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            placeholder="name@example.com"
            autoComplete="email"
            state={
              errors.email
                ? "error"
                : form.email && isEmail(form.email)
                  ? "valid"
                  : undefined
            }
          />
        </Field>
      </div>
    </section>
  );
}
