/** Normalized project URL and anon headers for Supabase REST and Edge Functions. */

export function supabaseProjectUrl() {
  return String(import.meta.env.VITE_SUPABASE_URL || "")
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

export function supabaseAnonHeaders() {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

export function functionsBaseUrl() {
  return `${supabaseProjectUrl()}/functions/v1`;
}
