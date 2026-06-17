/** Shared invite-only admin create UX (toasts + button labels). */

export function adminErrorMessage(err) {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  return String(err.message || err.error || "Something went wrong.");
}

export function toastAfterAdminCreate(toast, { res, email, isEdit, updatedMessage } = {}) {
  if (isEdit) {
    toast(updatedMessage || "Admin updated.", "success");
    return;
  }
  const sent = res?.data?.invite_email_sent;
  const addr = String(email || res?.data?.email || "").trim();
  if (sent && addr) {
    toast(`Invitation sent to ${addr}.`, "success");
    return;
  }
  if (sent) {
    toast("Invitation sent.", "success");
    return;
  }
  toast("Invitation email could not be sent.", "error");
}

export function adminCreateButtonLabel({ saving = false, isEdit = false, reassignOnly = false } = {}) {
  if (saving) return isEdit || reassignOnly ? "Saving…" : "Sending…";
  if (reassignOnly) return "Save reassignment";
  if (isEdit) return "Save changes";
  return "Send invitation";
}
