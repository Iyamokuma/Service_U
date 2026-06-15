/** Live input sanitizers for the public registration form. */

/** Personal names — letters, spaces, hyphens, apostrophes, periods. */
export function filterAlpha(value) {
  return String(value ?? "").replace(/[^\p{L}\s'.\-]/gu, "");
}

/** Street names, bus stops, group names — letters, digits, common punctuation. */
export function filterAlphanumeric(value) {
  return String(value ?? "").replace(/[^\p{L}\p{N}\s,.\-#/&]/gu, "");
}

/** Multi-line addresses — same as alphanumeric plus line breaks. */
export function filterAddress(value) {
  return String(value ?? "").replace(/[^\p{L}\p{N}\s,.\-#/&\n]/gu, "");
}

/** Phone numbers, tithe card numbers, etc. */
export function filterNumeric(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export const INPUT_FILTERS = {
  alpha: filterAlpha,
  alphanumeric: filterAlphanumeric,
  address: filterAddress,
  numeric: filterNumeric,
};

export const INPUT_MODES = {
  alpha: "text",
  alphanumeric: "text",
  address: "text",
  numeric: "numeric",
};

export function applyInputFilter(value, filter) {
  if (!filter) return value;
  if (typeof filter === "function") return filter(value);
  const fn = INPUT_FILTERS[filter];
  return fn ? fn(value) : value;
}
