import { Dropzone } from "../components/Dropzone.jsx";
import { SectionHead } from "./SectionHead.jsx";

export function PhotoSection({ form, set }) {
  return (
    <section className="section">
      <SectionHead
        num="04"
        title="Passport photo"
        desc="A clear portrait helps us identify you at service unit meetings."
      />
      <Dropzone value={form.photo} onChange={(v) => set("photo", v)} />
    </section>
  );
}
