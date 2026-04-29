import { useState, useMemo } from "react";
import { PersonalSection } from "./sections/PersonalSection.jsx";
import { ContactSection } from "./sections/ContactSection.jsx";
import { WorkSection } from "./sections/WorkSection.jsx";
import { PhotoSection } from "./sections/PhotoSection.jsx";
import { FaithSection } from "./sections/FaithSection.jsx";
import { ServiceUnitSection } from "./sections/ServiceUnitSection.jsx";
import { SERVICE_UNITS, isEmail, isPhone } from "./data.js";

const FORM_DB_KEY = "sm_form_db_v1";

const INITIAL = {
  surname: "",
  firstName: "",
  otherNames: "",
  dob: { month: "", day: "", year: "" },
  sex: "",
  maritalStatus: "",
  nationality: "",

  address: "",
  busStop: "",
  phone1: "",
  phone2: "",
  email: "",

  workplace: "",
  titheCard: "",
  homecell: "",

  photo: null,

  joinedChurch: { month: "", year: "" },
  bornAgain: "",
  bornAgainYear: "",
  foundation: "",
  foundationDate: { month: "", year: "" },
  baptised: "",
  baptisedDate: { month: "", year: "" },
  wolbi: "",
  wolbiDate: { month: "", year: "", level: "" },

  unitId: null,
  subUnit: "",
};

function validate(form) {
  const e = {};
  if (!form.surname.trim()) e.surname = "Surname is required.";
  if (!form.firstName.trim()) e.firstName = "First name is required.";
  if (!form.address.trim()) e.address = "Residential address is required.";
  if (!form.busStop.trim()) e.busStop = "Nearest bus stop is required.";
  if (!form.phone1.trim()) e.phone1 = "Primary phone is required.";
  else if (!isPhone(form.phone1)) e.phone1 = "Enter a valid phone number.";
  if (form.phone2 && !isPhone(form.phone2))
    e.phone2 = "Enter a valid phone number, or leave blank.";
  if (form.email && !isEmail(form.email))
    e.email = "Enter a valid email, or leave blank.";
  if (!form.nationality) e.nationality = "Select your nationality.";
  if (!form.sex) e.sex = "Select your sex.";
  if (!form.maritalStatus) e.maritalStatus = "Select your marital status.";
  if (!form.dob.month || !form.dob.day)
    e.dob = "Month and day of birth are required.";

  if (!form.joinedChurch.month || !form.joinedChurch.year)
    e.joinedChurch = "Month and year required.";

  if (!form.bornAgain) e.bornAgain = "Please answer Yes or No.";
  if (form.bornAgain === "Yes") {
    if (!form.bornAgainYear) e.bornAgainYear = "Year required.";
    if (!form.foundation) e.foundation = "Please answer Yes or No.";
    if (
      form.foundation === "Yes" &&
      (!form.foundationDate.month || !form.foundationDate.year)
    )
      e.foundationDate = "Month and year required.";
    if (!form.baptised) e.baptised = "Please answer Yes or No.";
    if (
      form.baptised === "Yes" &&
      (!form.baptisedDate.month || !form.baptisedDate.year)
    )
      e.baptisedDate = "Month and year required.";
    if (!form.wolbi) e.wolbi = "Please answer Yes or No.";
    if (
      form.wolbi === "Yes" &&
      (!form.wolbiDate.month ||
        !form.wolbiDate.year ||
        !form.wolbiDate.level)
    )
      e.wolbiDate = "Month, year and level required.";
  }

  if (!form.unitId) e.unitId = "Select a service unit.";
  else {
    const unit = SERVICE_UNITS.find((u) => u.id === form.unitId);
    if (unit?.subs && !form.subUnit) e.subUnit = "Select a sub-unit.";
  }

  return e;
}

export default function App() {
  const [form, setForm] = useState(INITIAL);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const allErrors = useMemo(() => validate(form), [form]);

  const errors = useMemo(() => {
    if (submitted) return allErrors;
    const shown = {};
    for (const k of Object.keys(allErrors)) {
      if (touched[k]) shown[k] = allErrors[k];
    }
    return shown;
  }, [allErrors, touched, submitted]);

  const isValid = Object.keys(allErrors).length === 0;

  const filledPct = useMemo(() => {
    const requiredKeys = [
      "surname",
      "firstName",
      "address",
      "busStop",
      "phone1",
      "nationality",
      "sex",
      "maritalStatus",
    ];
    let filled = requiredKeys.filter((k) => String(form[k]).trim()).length;
    const total = requiredKeys.length + 5;
    if (form.dob.month && form.dob.day) filled += 1;
    if (form.joinedChurch.month && form.joinedChurch.year) filled += 1;
    if (form.bornAgain) filled += 1;
    if (form.unitId) filled += 1;
    const unit = SERVICE_UNITS.find((u) => u.id === form.unitId);
    if (!unit?.subs || form.subUnit) filled += 1;
    return Math.round((filled / total) * 100);
  }, [form]);

  function onSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (isValid) {
      const unit = SERVICE_UNITS.find((u) => Number(u.id) === Number(form.unitId));
      const payload = {
        id: `FORM-${Date.now()}`,
        first_name: form.firstName,
        surname: form.surname,
        other_names: form.otherNames,
        sex: form.sex,
        marital_status: form.maritalStatus,
        nationality: form.nationality,
        address: form.address,
        bus_stop: form.busStop,
        phone1: form.phone1,
        phone2: form.phone2,
        email: form.email,
        workplace: form.workplace,
        tithe_card: form.titheCard,
        homecell: form.homecell,
        unit_id: Number(form.unitId),
        unit_name: unit?.name || "",
        sub_unit: form.subUnit || "",
        status: "new",
        notes: "",
        submitted_at: new Date().toISOString(),
        photo_path: form.photo?.dataUrl || "",
      };
      const existing = JSON.parse(localStorage.getItem(FORM_DB_KEY) || "{\"registrations\":[]}");
      existing.registrations = [payload, ...(existing.registrations || [])];
      localStorage.setItem(FORM_DB_KEY, JSON.stringify(existing));
      setDone(true);
      setTimeout(
        () => window.scrollTo({ top: 0, behavior: "smooth" }),
        50
      );
    } else {
      const el = document.querySelector(`[data-state="error"]`);
      el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }

  if (done) {
    return (
      <div className="page">
        <header className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-name">Salvation Ministries</div>
          <div className="brand-divider" />
          <div className="brand-meta">Form · v1.0</div>
        </header>
        <div className="success">
          <div className="success-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 12.5L10 16.5L18 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="hero-title" style={{ fontSize: 32, marginBottom: 12 }}>
            Thank you, <em>{form.firstName}</em>.
          </h2>
          <p className="hero-sub" style={{ margin: "0 auto" }}>
            Your service unit registration has been received. A unit coordinator
            will be in touch within a week.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="brand">
        <div className="brand-mark">S</div>
        <div className="brand-name">Salvation Ministries</div>
        <div className="brand-divider" />
        <div className="brand-meta">Form · v1.0</div>
      </header>

      <section className="hero">
        <div className="hero-eyebrow">Service Unit Registration</div>
        <h1 className="hero-title">
          Join a <em>service unit</em> and serve with purpose.
        </h1>
        <p className="hero-sub">
          Complete this form to be enrolled in one of our service units. Fields
          marked with
          <span style={{ color: "var(--accent)", margin: "0 4px" }}>●</span>
          are required. Your information is kept confidential and used only for
          ministry coordination.
        </p>
      </section>

      <form onSubmit={onSubmit} noValidate>
        <PersonalSection form={form} set={set} errors={errors} />
        <ContactSection form={form} set={set} errors={errors} />
        <WorkSection form={form} set={set} />
        <PhotoSection form={form} set={set} />
        <FaithSection form={form} set={set} errors={errors} />
        <ServiceUnitSection form={form} set={set} errors={errors} />

        <div className="submit-bar">
          <div className="submit-meta" data-ready={isValid}>
            <span className="dot" />
            <span>
              {isValid
                ? "Ready to submit"
                : `${filledPct}% complete — ${Object.keys(allErrors).length} field${
                    Object.keys(allErrors).length === 1 ? "" : "s"
                  } remaining`}
            </span>
          </div>
          <button type="submit" className="btn-primary">
            Submit registration
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
