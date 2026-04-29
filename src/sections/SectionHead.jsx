export function SectionHead({ num, title, desc }) {
  return (
    <div className="section-head">
      <div className="section-num">{num}</div>
      <div>
        <h2 className="section-title">{title}</h2>
        {desc && <p className="section-desc">{desc}</p>}
      </div>
    </div>
  );
}
