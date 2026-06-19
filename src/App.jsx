import { useState, useMemo, useEffect, useCallback } from "react";
import { PersonalSection } from "./sections/PersonalSection.jsx";
import { ContactSection } from "./sections/ContactSection.jsx";
import { PhotoSection } from "./sections/PhotoSection.jsx";
import { FaithSection } from "./sections/FaithSection.jsx";
import { ChurchMembershipSection } from "./sections/ChurchMembershipSection.jsx";
import {
  ChurchLocationSection,
  effectiveBranchStateForPayload,
  validateChurchLocation,
} from "./sections/ChurchLocationSection.jsx";
import { ServiceUnitSection } from "./sections/ServiceUnitSection.jsx";
import { SERVICE_UNITS, isEmail, isPhone, registrationSubmitFieldErrors } from "./data.js";
import { unitHasSubUnits } from "./serviceUnitUtils.js";
import { compressPhotoDataUrl } from "./photoCompress.js";
import { isSupabaseSubmitConfigured, submitRegistration } from "./registrationSubmit.js";
import { fetchServiceUnitsCatalog } from "./serviceUnitsCatalog.js";
import { FormTopBrand } from "./components/FormTopBrand.jsx";
import { branchCountryLabel, branchStateLabel } from "./admin/branchRegions.js";

function firstValidationErrorEl() {
  return (
    document.querySelector('[data-state="error"]') ||
    document.querySelector(".error-msg") ||
    document.querySelector('[data-error="true"]')
  );
}

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
  branchCountry: "",
  branchState: "",
  churchId: "",
  satelliteSite: "",
  phone1: "",
  phone2: "",
  email: "",

  photo: null,

  joinedChurch: { month: "", year: "" },
  titheCard: "",
  homecell: "",

  bornAgain: "",
  bornAgainYear: "",
  wolbi: "",
  wolbiDate: { year: "", level: "" },

  unitId: null,
  subUnit: "",

  /** Set by ChurchLocationSection for directory-backed validation (not submitted). */
  churchLocationCtx: null,
};

function validate(form, units) {
  const e = {};
  if (!form.surname.trim()) e.surname = "Surname is required.";
  if (!form.firstName.trim()) e.firstName = "First name is required.";
  if (!form.address.trim()) e.address = "Residential address is required.";
  if (!form.busStop.trim()) e.busStop = "Nearest bus stop is required.";
  if (!form.phone1.trim()) e.phone1 = "Primary phone is required.";
  else if (!isPhone(form.phone1)) e.phone1 = "Enter a valid phone number.";
  if (form.phone2 && !isPhone(form.phone2))
    e.phone2 = "Enter a valid phone number, or leave blank.";
  if (!form.email.trim()) e.email = "Email address is required.";
  else if (!isEmail(form.email)) e.email = "Enter a valid email address.";
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
    if (!form.wolbi) e.wolbi = "Please answer Yes or No.";
    if (
      form.wolbi === "Yes" &&
      (!form.wolbiDate.year || !form.wolbiDate.level)
    )
      e.wolbiDate = "Year and level required.";
  }

  if (!form.unitId) e.unitId = "Select a service unit.";
  else {
    const unit = units.find((u) => u.id === form.unitId);
    if (unitHasSubUnits(unit) && !form.subUnit) e.subUnit = "Select a sub-unit.";
  }

  Object.assign(e, validateChurchLocation(form));

  return e;
}

export default function App() {
  const [serviceUnits, setServiceUnits] = useState(SERVICE_UNITS);
  const [form, setForm] = useState(INITIAL);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [submitFieldErrors, setSubmitFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServiceUnitsCatalog().then((u) => {
      if (!cancelled) setServiceUnits(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
    if (key === "phone1" || key === "phone2" || key === "email") {
      setSubmitFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  const setSilent = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const allErrors = useMemo(() => validate(form, serviceUnits), [form, serviceUnits]);

  const locationLabel = useMemo(() => {
    const parts = [];
    const country = branchCountryLabel(form.branchCountry);
    const state = branchStateLabel(form.branchCountry, form.branchState);
    if (country) parts.push(country);
    if (state) parts.push(state);
    if (form.satelliteSite) parts.push(form.satelliteSite);
    return parts.join(" · ");
  }, [form.branchCountry, form.branchState, form.satelliteSite]);

  const errors = useMemo(() => {
    const base = submitted ? allErrors : {};
    const shown = { ...submitFieldErrors };
    if (!submitted) {
      for (const k of Object.keys(allErrors)) {
        if (touched[k]) shown[k] = allErrors[k];
      }
      return shown;
    }
    return { ...base, ...submitFieldErrors };
  }, [allErrors, touched, submitted, submitFieldErrors]);

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
    const total = requiredKeys.length + 7;
    if (form.dob.month && form.dob.day) filled += 1;
    if (form.joinedChurch.month && form.joinedChurch.year) filled += 1;
    if (form.bornAgain) filled += 1;
    if (form.unitId) filled += 1;
    const unit = serviceUnits.find((u) => u.id === form.unitId);
    if (!unitHasSubUnits(unit) || form.subUnit) filled += 1;
    if (form.branchCountry && effectiveBranchStateForPayload(form)) filled += 1;
    if (form.churchId) filled += 1;
    return Math.round((filled / total) * 100);
  }, [form, serviceUnits]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaveError("");
    setSubmitFieldErrors({});
    const validationErrors = validate(form, serviceUnits);
    setSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      requestAnimationFrame(() => {
        firstValidationErrorEl()?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      let photo_path = "";
      try {
        if (form.photo?.dataUrl) {
          photo_path = await compressPhotoDataUrl(form.photo.dataUrl);
        }
      } catch {
        photo_path = form.photo?.dataUrl || "";
      }
      const unit = serviceUnits.find((u) => Number(u.id) === Number(form.unitId));
      const ba = form.bornAgain === "Yes";
      const payload = {
        first_name: form.firstName,
        surname: form.surname,
        other_names: form.otherNames,
        dob_month: form.dob?.month || "",
        dob_day: form.dob?.day || "",
        dob_year: form.dob?.year || "",
        sex: form.sex,
        marital_status: form.maritalStatus,
        nationality: form.nationality,
        address: form.address,
        bus_stop: form.busStop,
        branch_country: form.branchCountry,
        branch_state: effectiveBranchStateForPayload(form),
        church_id: form.churchId ? Number(form.churchId) : null,
        satellite_site: String(form.satelliteSite || "").trim(),
        phone1: form.phone1,
        phone2: form.phone2,
        email: form.email,
        workplace: "",
        tithe_card: form.titheCard,
        homecell: form.homecell,
        joined_church_month: form.joinedChurch?.month || "",
        joined_church_year: form.joinedChurch?.year || "",
        born_again: form.bornAgain || "",
        born_again_year: ba ? form.bornAgainYear || "" : "",
        foundation: "",
        foundation_month: "",
        foundation_year: "",
        baptised: "",
        baptised_month: "",
        baptised_year: "",
        wolbi: ba ? form.wolbi || "" : "",
        wolbi_month: ba && form.wolbi === "Yes" ? "" : "",
        wolbi_year: ba && form.wolbi === "Yes" ? form.wolbiDate?.year || "" : "",
        wolbi_level: ba && form.wolbi === "Yes" ? form.wolbiDate?.level || "" : "",
        unit_id: Number(form.unitId),
        unit_name: unit?.name || "",
        sub_unit: form.subUnit || "",
        status: "new",
        notes: "",
        submitted_at: new Date().toISOString(),
        photo_path,
      };

      if (!isSupabaseSubmitConfigured()) {
        setSaveError(
          "Submission service is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app."
        );
        return;
      }

      try {
        await submitRegistration(payload);
      } catch (err) {
        const msg = err?.message || "Could not submit your registration right now. Please try again.";
        const fieldErrs = registrationSubmitFieldErrors(msg);
        if (Object.keys(fieldErrs).length) {
          setSubmitFieldErrors(fieldErrs);
          setSubmitted(true);
          requestAnimationFrame(() => {
            firstValidationErrorEl()?.scrollIntoView?.({ behavior: "smooth", block: "center" });
          });
        } else {
          setSaveError(msg);
        }
        return;
      }
      setDone(true);
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="page">
        <FormTopBrand />
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
            <strong>Application received successfully.</strong> We have sent a confirmation to{" "}
            <strong>{form.email}</strong>. You will be contacted shortly by the{" "}
            <strong>
              {serviceUnits.find((u) => Number(u.id) === Number(form.unitId))?.name || "service unit"}
            </strong>{" "}
            department.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <FormTopBrand />

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
        <ChurchLocationSection form={form} set={set} setSilent={setSilent} errors={errors} />
        <FaithSection form={form} set={set} errors={errors} />
        <PhotoSection form={form} set={set} />
        <ChurchMembershipSection form={form} set={set} errors={errors} />
        <ServiceUnitSection form={form} set={set} errors={errors} units={serviceUnits} locationLabel={locationLabel} />

        <div className="submit-bar">
          {saveError && (
            <div className="error-msg" style={{ width: "100%", marginBottom: 8 }} role="alert">
              {saveError}
            </div>
          )}
          <div className="submit-meta" data-ready={isValid}>
            <span className="dot" />
            <span>
              {saving
                ? "Saving…"
                : isValid
                  ? "Ready to submit"
                  : `${filledPct}% complete — ${Object.keys(allErrors).length} field${
                      Object.keys(allErrors).length === 1 ? "" : "s"
                    } remaining`}
            </span>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Submit registration"}
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
