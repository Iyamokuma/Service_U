import { useState } from "react";
import { SMH_LOGO_ALT, SMH_LOGO_SRC } from "../brandLogo.js";

/**
 * Salvation Ministries branded loader — logo with orbiting rings.
 * @param {"inline"|"page"|"compact"} variant
 */
export function SmhLoader({
  label = "Loading",
  size = 56,
  variant = "inline",
  className = "",
}) {
  const [failed, setFailed] = useState(false);

  const rootClass = [
    "smh-loader",
    variant === "page" ? "smh-loader--page" : "",
    variant === "compact" ? "smh-loader--compact" : "smh-loader--inline sa-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <div className="smh-loader__stage" style={{ "--smh-loader-size": `${size}px` }}>
        <div className="smh-loader__ring smh-loader__ring--outer" aria-hidden />
        <div className="smh-loader__ring smh-loader__ring--inner" aria-hidden />
        <div className="smh-loader__logo-wrap">
          {failed ? (
            <div className="smh-loader__fallback" aria-hidden>
              S
            </div>
          ) : (
            <img
              className="smh-loader__logo"
              src={SMH_LOGO_SRC}
              alt={SMH_LOGO_ALT}
              width={size}
              height={size}
              decoding="async"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </div>
      {label ? (
        <p className="smh-loader__label">
          {label}
          <span className="smh-loader__dots" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      ) : (
        <span className="sr-only">{variant === "compact" ? "Loading" : ""}</span>
      )}
    </div>
  );
}
