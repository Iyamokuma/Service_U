import { useId } from "react";

export function RadioGroup({ value, onChange, options, name, error }) {
  const id = useId();
  const groupName = name || id;
  return (
    <div className="radio-group" role="radiogroup">
      {options.map((opt) => {
        const [v, l] = Array.isArray(opt) ? opt : [opt, opt];
        return (
          <label key={v} className="radio" data-error={error ? "true" : undefined}>
            <input
              type="radio"
              name={groupName}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span className="radio-dot" aria-hidden="true" />
            <span className="radio-label">{l}</span>
          </label>
        );
      })}
    </div>
  );
}
