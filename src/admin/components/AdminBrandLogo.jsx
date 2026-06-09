import { useState } from "react";
import { SMH_LOGO_ALT, SMH_LOGO_SRC } from "../../brandLogo.js";

const VARIANT_CLASS = {
  sidebar: "sa-brand-logo",
  login: "sa-login-mark-logo",
  topbar: "sa-topbar-logo",
};

/**
 * SMH brand mark for admin login and all dashboard sidebars.
 * @param {"sidebar"|"login"|"topbar"} variant
 */
export function AdminBrandLogo({ variant = "sidebar", className = "" }) {
  const [failed, setFailed] = useState(false);
  const imgClass = [VARIANT_CLASS[variant] || VARIANT_CLASS.sidebar, className].filter(Boolean).join(" ");

  if (failed) {
    return (
      <div className={`${imgClass} sa-brand-mark-fallback`} aria-hidden>
        S
      </div>
    );
  }

  return (
    <img
      className={imgClass}
      src={SMH_LOGO_SRC}
      alt={SMH_LOGO_ALT}
      width={variant === "login" ? 64 : variant === "topbar" ? 36 : 48}
      height={variant === "login" ? 64 : variant === "topbar" ? 36 : 48}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
