import { Field } from "../../components/Field.jsx";
import { AdminInviteBanner } from "./AdminInviteBanner.jsx";

/**
 * Shared admin account identity fields (name, login, email) for create/edit modals.
 */
export function AdminAccountIdentityFields({
  form,
  setForm,
  isEdit = false,
  inviteCreate = false,
  usernamePlaceholder = "johndoe",
  showStatus = false,
  statusPendingReview = false,
}) {
  const set = (key) => (e) => {
    const value = key === "is_active" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <>
      {inviteCreate ? <AdminInviteBanner /> : null}
      <div className="grid">
        <Field label="Full name" required>
          <input
            className="input"
            value={form.full_name || ""}
            onChange={set("full_name")}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </Field>
        {!inviteCreate ? (
          <Field label="Username" required={!isEdit}>
            <input
              className="input"
              value={form.username || ""}
              onChange={set("username")}
              placeholder={usernamePlaceholder}
              disabled={isEdit}
              autoComplete="off"
            />
          </Field>
        ) : null}
        <Field label="Email" required span={inviteCreate ? "2" : undefined}>
          <input
            className="input"
            type="email"
            value={form.email || ""}
            onChange={set("email")}
            placeholder="admin@church.org"
            autoComplete="email"
          />
        </Field>
        {!inviteCreate ? (
          <Field label={isEdit ? "New password (optional)" : "Password"} required={!isEdit} span="2">
            <input
              className="input"
              type="password"
              value={form.password || ""}
              onChange={set("password")}
              placeholder="Min 8 characters"
              autoComplete={isEdit ? "new-password" : "new-password"}
            />
          </Field>
        ) : null}
        {showStatus && isEdit && !statusPendingReview ? (
          <Field label="Status">
            <select className="select" value={form.is_active ?? 1} onChange={set("is_active")}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </Field>
        ) : null}
        {showStatus && statusPendingReview ? (
          <Field label="Status" span="2">
            <div className="field-hint" style={{ marginTop: 4 }}>
              Submitted as <span className="sa-badge in_review">In review</span> until Super Admin approves.
            </div>
          </Field>
        ) : null}
      </div>
    </>
  );
}
