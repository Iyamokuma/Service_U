import { functionsBaseUrl, supabaseProjectUrl, supabaseAnonHeaders } from "./lib/supabaseEnv.js";

const SUBMIT_FUNCTION_NAME = import.meta.env.VITE_SUPABASE_FORM_SUBMIT_FN || "submit-registration";

function hasSupabaseSubmitConfig() {
  return Boolean(supabaseProjectUrl() && import.meta.env.VITE_SUPABASE_ANON_KEY && SUBMIT_FUNCTION_NAME);
}

function submitEndpoint() {
  return `${functionsBaseUrl()}/${SUBMIT_FUNCTION_NAME}`;
}

export async function submitRegistration(payload) {
  if (!hasSupabaseSubmitConfig()) return { skipped: true };

  const res = await fetch(submitEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseAnonHeaders(),
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message = body?.error || `Submission failed with status ${res.status}`;
    throw new Error(message);
  }

  return body || { ok: true };
}

export function isSupabaseSubmitConfigured() {
  return hasSupabaseSubmitConfig();
}
