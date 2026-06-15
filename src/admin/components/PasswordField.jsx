import { useState } from "react";

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0012 15a2 2 0 001.41-3.41M9.88 4.24A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 8-1.02 2.94-3.07 5.28-5.66 6.58M6.61 6.61C4.62 7.99 3.18 10.03 2 12c1.73 4.89 6 8 10 8 1.05 0 2.07-.16 3.03-.45"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Password input with show/hide toggle. */
export function PasswordField({
  className = "",
  inputClassName = "sa-input",
  id,
  value,
  onChange,
  ...rest
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`sa-password-field${className ? ` ${className}` : ""}`}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={inputClassName}
        value={value}
        onChange={onChange}
        {...rest}
      />
      <button
        type="button"
        className="sa-password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
