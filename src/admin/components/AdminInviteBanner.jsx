/** Shown at the top of create-admin modals when using email invite flow. */
export function AdminInviteBanner() {
  return (
    <div className="sa-invite-banner" role="note">
      <span className="sa-invite-banner__icon" aria-hidden>
        ✉
      </span>
      <div className="sa-invite-banner__body">
        <div className="sa-invite-banner__title">Email invitation</div>
        <p className="sa-invite-banner__text">
          Enter their name and email only. They receive a link to set their password and access their dashboard.
        </p>
      </div>
    </div>
  );
}
