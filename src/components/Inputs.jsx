export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  state,
  adorn,
  autoComplete,
}) {
  return (
    <div className="input-wrap">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        data-state={state}
        className={`input ${adorn ? "has-adorn" : ""}`}
      />
      {adorn && <span className="input-adorn">{adorn}</span>}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, state }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-state={state}
      className="textarea"
    />
  );
}

export function Select({ value, onChange, options, placeholder, state }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-state={state}
      className="select"
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
