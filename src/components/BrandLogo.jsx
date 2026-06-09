import { useState } from "react";
import { SMH_LOGO_ALT, SMH_LOGO_SRC } from "../brandLogo.js";

export function BrandLogo({ className = "brand-logo", size = 40 }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} brand-mark-fallback`} aria-hidden>
        S
      </div>
    );
  }

  return (
    <img
      className={className}
      src={SMH_LOGO_SRC}
      alt={SMH_LOGO_ALT}
      width={size}
      height={size}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
