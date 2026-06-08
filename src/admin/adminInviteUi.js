/** Shared invite-only admin create UX (toasts + button labels). */

export function toastAfterAdminCreate(toast, { res, email, isEdit, updatedMessage } = {}) {
  if (isEdit) {
    toast(updatedMessage || "Admin updated.", "success");
    return;
  }
  const sent = res?.data?.invite_email_sent;
  const addr = String(email || res?.data?.email || "").trim();
  if (sent && addr) {
    toast(`Invitation email sent to ${addr}. They will set their password from the link.`, "success");
    return;
  }
  if (sent) {
    toast("Invitation email sent. They must activate their account before signing in.", "success");
    return;
  }
  toast(
    "Account was created but the invitation email could not be sent. Check email configuration or resend the invite.",
    "error",
  );
}

export function adminCreateButtonLabel({ saving = false, isEdit = false, reassignOnly = false } = {}) {
  if (saving) return isEdit || reassignOnly ? "Saving…" : "Sending…";
  if (reassignOnly) return "Save reassignment";
  if (isEdit) return "Save changes";
  return "Send invitation";
}
