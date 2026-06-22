import { Field } from "../../components/Field.jsx";

/**
 * Service unit / sub-unit pickers for workforce leader admin accounts.
 */
export function AdminWorkforceUnitFields({
  form,
  setForm,
  units = [],
  role = "service_unit_leader",
  isEdit = false,
  lockServiceUnit = false,
  serviceUnitHint = "",
}) {
  const isSubUnit = role === "sub_unit_leader";
  const unitOptions = (units || []).filter((u) => Number(u.is_active) !== 0);
  const selectedUnit = unitOptions.find((u) => Number(u.id) === Number(form.service_unit_id));
  const subUnitOptions = (selectedUnit?.sub_units || []).filter((s) => Number(s.is_active) !== 0);
  const selectedUnitHasSubs = subUnitOptions.length > 0;

  return (
    <div className="grid">
      <Field
        label="Service unit"
        required
        hint={serviceUnitHint}
        span={isSubUnit ? undefined : "2"}
      >
        <select
          className="select"
          value={form.service_unit_id || ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              service_unit_id: e.target.value,
              sub_unit_name: "",
            }))
          }
          disabled={isEdit || lockServiceUnit}
        >
          <option value="">Select unit</option>
          {unitOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>

      {isSubUnit ? (
        <Field
          label="Sub-unit"
          required
          hint={
            !form.service_unit_id
              ? "Select a service unit first."
              : !selectedUnitHasSubs && !isEdit
                ? "This service unit has no sub-units."
                : "Leader is scoped to this sub-unit within the service unit."
          }
        >
          <select
            className="select"
            value={form.sub_unit_name || ""}
            onChange={(e) => setForm((f) => ({ ...f, sub_unit_name: e.target.value }))}
            disabled={!form.service_unit_id || isEdit || !selectedUnitHasSubs}
          >
            <option value="">
              {!form.service_unit_id
                ? "Select service unit first"
                : selectedUnitHasSubs
                  ? "Select sub-unit"
                  : "No sub-units on this unit"}
            </option>
            {subUnitOptions.map((s) => (
              <option key={s.id || s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}
