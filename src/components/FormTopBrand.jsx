import { BrandLogo } from "./BrandLogo.jsx";

export function FormTopBrand() {
  return (
    <header className="brand">
      <BrandLogo />
      <div className="brand-name">Salvation Ministries</div>
      <div className="brand-divider" />
      <div className="brand-meta">Form · v1.0</div>
    </header>
  );
}
