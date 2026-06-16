export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const NATIONALITIES = [
  "Nigerian", "Ghanaian", "Kenyan", "South African", "Cameroonian", "Liberian",
  "Sierra Leonean", "Ugandan", "Tanzanian", "Rwandan", "Ethiopian", "Zimbabwean",
  "Ivorian", "Senegalese", "British", "American", "Canadian", "Other",
];

export const WOLBI_LEVELS = ["Basic", "Advance", "Diploma"];

export const SERVICE_UNITS = [
  { id: 1, name: "Choir" },
  { id: 2, name: "Special Care Unit" },
  { id: 3, name: "Medical Team" },
  { id: 4, name: "Peacekeepers Unit" },
  { id: 5, name: "Safety Unit" },
  { id: 6, name: "Sanctuary Keepers" },
  { id: 7, name: "Children Ministry", subs: [
    "Lessons & teaching",
    "Activities & programs",
    "Children's worship",
    "Environment / classroom setup",
  ]},
  { id: 8, name: "Decoration Unit", subs: [
    "Sanctuary décor & altar aesthetics",
    "Altar cleanliness & hygiene",
  ]},
  { id: 9, name: "Editorial Unit", subs: [
    "Testimonies & life stories",
    "Magazines & editorial publications",
  ]},
  { id: 10, name: "Crowd Management Unit (CC1)", subs: [
    "Entry / exit & flow",
    "Seating coordination",
    "Crowd control & queue management",
  ]},
  { id: 11, name: "Soul Establishment Unit", subs: [
    "Service unit placement & follow-up",
    "Cell fellowship integration",
  ]},
  { id: 12, name: "Media & Service", subs: ["Audio", "Video", "Electrical"] },
  { id: 13, name: "Ushering Unit", subs: [
    "Seating & order",
    "Offerings & collection support",
    "Visitors & new converts hospitality",
  ]},
  { id: 14, name: "Foreign Language Unit", subs: [
    "Live interpretation (services)",
    "Written materials translation",
  ]},
  { id: 15, name: "Horticulture", subs: [
    "Cultivation & grounds care",
    "Landscape design",
    "Garden / grounds maintenance",
  ]},
];

export const CURRENT_YEAR = new Date().getFullYear();

export const YEARS_FULL = Array.from(
  { length: 100 },
  (_, i) => String(CURRENT_YEAR - i)
);

// Salvation Ministries started in 1997, so membership year options begin there.
export const YEARS_SINCE_1997 = Array.from(
  { length: CURRENT_YEAR - 1997 + 1 },
  (_, i) => String(CURRENT_YEAR - i)
);

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isPhone(v) {
  const digits = v.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Digits-only phone for duplicate checks (must match server normalization). */
export function normalizePhoneDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

export function normalizeEmailKey(v) {
  const e = String(v ?? "").trim().toLowerCase();
  return e || "";
}

/** Map submit-registration duplicate errors to contact field keys. */
export function registrationSubmitFieldErrors(message) {
  const msg = String(message || "");
  const lower = msg.toLowerCase();
  if (lower.includes("phone number")) {
    return { phone1: msg };
  }
  if (lower.includes("email address")) {
    return { email: msg };
  }
  return {};
}
