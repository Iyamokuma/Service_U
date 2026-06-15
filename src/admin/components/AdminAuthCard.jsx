import { AdminBrandLogo } from "./AdminBrandLogo.jsx";

/** Shared admin sign-in / invite card chrome. */
export function AdminAuthCard({
  title = "Salvation Ministries",
  subtitle,
  description,
  steps,
  activeStep = 0,
  children,
  footer,
}) {
  return (
    <div className="sa-login-page">
      <div className="sa-login-backdrop" aria-hidden="true">
        <span className="sa-login-orb sa-login-orb-1" />
        <span className="sa-login-orb sa-login-orb-2" />
        <span className="sa-login-orb sa-login-orb-3" />
        <span className="sa-login-orb sa-login-orb-4" />
      </div>
      <div className="sa-login-card">
        <div className="sa-login-logo">
          <AdminBrandLogo variant="login" />
          <div>
            <div className="sa-login-title">{title}</div>
            {subtitle ? <div className="sa-login-sub">{subtitle}</div> : null}
          </div>
        </div>

        {steps?.length ? (
          <ol className="sa-login-steps" aria-label="Progress">
            {steps.map((label, i) => (
              <li
                key={label}
                className={`sa-login-step${i < activeStep ? " is-done" : ""}${i === activeStep ? " is-active" : ""}`}
                aria-current={i === activeStep ? "step" : undefined}
              >
                <span className="sa-login-step-num">{i + 1}</span>
                <span className="sa-login-step-label">{label}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {description ? <p className="sa-login-desc">{description}</p> : null}

        {children}

        {footer ? <div className="sa-login-badge">{footer}</div> : null}
      </div>
    </div>
  );
}
