/** Salvation Ministries logo — served from `public/smh.png`. */
const base = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export const SMH_LOGO_SRC = `${base}smh.png`;
export const SMH_LOGO_ALT = "Salvation Ministries logo";
