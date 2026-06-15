import { applyInputFilter, INPUT_MODES } from "../formInputFilters.js";

function resolveInputMode(filter, type) {
  if (type === "email") return "email";
  if (type === "tel" && filter === "numeric") return "numeric";
  if (filter && INPUT_MODES[filter]) return INPUT_MODES[filter];
  if (type === "tel") return "tel";
  return undefined;
}

function handleFilteredChange(e, onChange, filter) {
  const raw = e.target.value;
  onChange(applyInputFilter(raw, filter));
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  state,
  adorn,
  autoComplete,
  filter,
  inputMode,
  maxLength,
}) {
  const mode = inputMode || resolveInputMode(filter, type);

  return (
    <div className="input-wrap">
      <input
        type={filter === "numeric" ? "text" : type}
        inputMode={mode}
        value={value}
        onChange={(e) => handleFilteredChange(e, onChange, filter)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        data-state={state}
        className={`input ${adorn ? "has-adorn" : ""}`}
        maxLength={maxLength}
        {...(filter === "numeric" ? { pattern: "[0-9]*" } : {})}
      />
      {adorn && <span className="input-adorn">{adorn}</span>}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, state, filter }) {
  return (
    <textarea
      value={value}
      onChange={(e) => handleFilteredChange(e, onChange, filter)}
      placeholder={placeholder}
      data-state={state}
      className="textarea"
      inputMode={filter ? INPUT_MODES[filter] || "text" : undefined}
    />
  );
}

export function Select({ value, onChange, options, placeholder, state, disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-state={state}
      className="select"
      disabled={disabled}
    >
      <option value="">{placeholder || "Select…"}</option>
      {options.map((opt) => {
        const [v, l] = Array.isArray(opt) ? opt : [opt, opt];
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}
