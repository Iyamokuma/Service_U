export function Field({ label, hint, error, required, optional, children, span }) {
  const cls = span ? `field col-span-${span}` : "field";
  return (
    <div className={cls}>
      <div className="field-label">
        <span>{label}</span>
        {required && <span className="req" aria-label="required">●</span>}
        {optional && <span className="opt">Optional</span>}
      </div>
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && (
        <div className="error-msg">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M6 3.5V6.5M6 8.3V8.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
