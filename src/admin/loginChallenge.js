const STORAGE_KEY = "sm_admin_login_challenge";

export function saveLoginChallenge(challenge) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
  } catch {
    /* ignore */
  }
}

export function readLoginChallenge() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.challengeId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLoginChallenge() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
