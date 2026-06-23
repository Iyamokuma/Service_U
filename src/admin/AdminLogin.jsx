import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "./api.js";
import { useAdminAuth } from "./AdminContext.jsx";
import { AdminAuthCard } from "./components/AdminAuthCard.jsx";
import { PasswordField } from "./components/PasswordField.jsx";
import { useToast } from "./components/Toast.jsx";
import { SmhLoader } from "../components/SmhLoader.jsx";
import { clearLoginChallenge, readLoginChallenge, saveLoginChallenge } from "./loginChallenge.js";

const LOGIN_STEPS = ["Sign in", "Verify"];

export function AdminLogin({ initialStep = "credentials" }) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    startLogin,
    verifyLoginOtp,
    verifyDualLoginOtp,
    sendLoginEmailOtp,
    resendLoginOtp,
    loading,
    error,
    clearLoginError,
    setLoginError,
  } = useAdminAuth();
  const [step, setStep] = useState(() => {
    const saved = readLoginChallenge();
    if (initialStep === "otp" && saved) return saved.mode === "dual" ? "dual" : "otp";
    return "credentials";
  });
  const [form, setForm] = useState(() => ({
    email: String(searchParams.get("email") || "").trim(),
    password: "",
  }));
  const [emailOtp, setEmailOtp] = useState("");
  const [totp, setTotp] = useState("");
  const [challenge, setChallenge] = useState(() => readLoginChallenge());
  const [resendIn, setResendIn] = useState(() => challenge?.resendAfter ?? 0);
  const [emailSent, setEmailSent] = useState(() => !!challenge?.emailSent);
  const [resetSending, setResetSending] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if ((step === "otp" || step === "dual") && !challenge) {
      setStep("credentials");
    }
  }, [step, challenge]);

  useEffect(() => {
    const email = String(searchParams.get("email") || "").trim();
    if (email) setForm((f) => ({ ...f, email }));
    if (searchParams.get("reset") === "success") {
      toast("Password updated. Sign in with your new password.", "success");
      const next = new URLSearchParams(searchParams);
      next.delete("reset");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((step === "otp" || step === "dual") && challenge) {
      saveLoginChallenge(challenge);
    }
  }, [step, challenge]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function beginVerifyStep(nextChallenge, mode) {
    setChallenge({ ...nextChallenge, mode });
    saveLoginChallenge({ ...nextChallenge, mode });
    setEmailOtp("");
    setTotp("");
    setResendIn(nextChallenge.resendAfter ?? (mode === "dual" ? 0 : 60));
    setEmailSent(nextChallenge.emailSent !== false);
    setStep(mode);
  }

  async function onCredentialsSubmit(e) {
    e.preventDefault();
    clearLoginError();
    const res = await startLogin(form.email, form.password);
    if (res?.needsDualVerify && res.challengeId) {
      beginVerifyStep(
        {
          challengeId: res.challengeId,
          maskedEmail: res.maskedEmail,
          resendAfter: res.resendAfter ?? 0,
          emailSent: false,
        },
        "dual",
      );
      return;
    }
    if (res?.needsOtp && res.challengeId) {
      beginVerifyStep(
        {
          challengeId: res.challengeId,
          maskedEmail: res.maskedEmail,
          resendAfter: res.resendAfter ?? 60,
          emailSent: res.emailSent !== false,
          message: res.message || "",
        },
        "otp",
      );
      return;
    }
    if (res?.loggedIn) {
      clearLoginChallenge();
      setForm((f) => ({ ...f, password: "" }));
    }
  }

  async function onForgotPassword(e) {
    e.preventDefault();
    clearLoginError();
    const email = String(form.email || "").trim();
    if (!email) {
      setLoginError("Enter your email above, then click Forgot password.");
      return;
    }
    setResetSending(true);
    try {
      await api.requestPasswordReset(email);
      toast("Password reset link sent", "success");
    } catch {
      toast("Password reset link sent", "success");
    } finally {
      setResetSending(false);
    }
  }

  async function onOtpSubmit(e) {
    e.preventDefault();
    clearLoginError();
    if (!challenge?.challengeId || emailOtp.length !== 6) return;
    const ok = await verifyLoginOtp(challenge.challengeId, emailOtp);
    if (ok) clearLoginChallenge();
  }

  async function onDualSubmit(e) {
    e.preventDefault();
    clearLoginError();
    if (!challenge?.challengeId || emailOtp.length !== 6 || totp.length !== 6) return;
    const ok = await verifyDualLoginOtp(challenge.challengeId, emailOtp, totp);
    if (ok) clearLoginChallenge();
  }

  async function onSendEmailCode() {
    if (!challenge?.challengeId || resendIn > 0 || loading) return;
    clearLoginError();
    try {
      const res = await sendLoginEmailOtp(challenge.challengeId);
      setChallenge((c) => ({
        ...c,
        maskedEmail: res.email_masked || c.maskedEmail,
        emailSent: true,
      }));
      setEmailSent(true);
      setResendIn(res.resend_after ?? 60);
      setEmailOtp("");
    } catch {
      /* error in context */
    }
  }

  async function onResend() {
    if (!challenge?.challengeId || resendIn > 0 || loading) return;
    clearLoginError();
    try {
      const res = await resendLoginOtp(challenge.challengeId);
      setChallenge((c) => ({
        ...c,
        maskedEmail: res.email_masked || c.maskedEmail,
        emailSent: true,
      }));
      setEmailSent(true);
      setResendIn(res.resend_after ?? 60);
      setEmailOtp("");
    } catch {
      /* error set in context */
    }
  }

  function backToCredentials() {
    clearLoginChallenge();
    setStep("credentials");
    setEmailOtp("");
    setTotp("");
    setChallenge(null);
    clearLoginError();
  }

  const onSubmit =
    step === "dual" ? onDualSubmit : step === "otp" ? onOtpSubmit : onCredentialsSubmit;

  const isVerifyStep = step === "otp" || step === "dual";

  const subtitle = isVerifyStep ? "Verify your identity" : "Admin sign in";
  const description = isVerifyStep
    ? step === "dual"
      ? "Enter the 6-digit code from your email and the 6-digit code from your authenticator app."
      : "We sent a 6-digit code to your email. Enter it below to finish signing in."
    : "";

  return (
    <AdminAuthCard
      subtitle={subtitle}
      steps={LOGIN_STEPS}
      activeStep={isVerifyStep ? 1 : 0}
      description={description}
      footer="Secure admin access · Salvation Ministries"
    >
      {error ? <div className="sa-login-err" role="alert">{error}</div> : null}

      <form onSubmit={onSubmit}>
        {step === "credentials" ? (
          <>
            <div className="sa-login-group">
              <label className="sa-login-label" htmlFor="admin-login-email">
                Email
              </label>
              <input
                id="admin-login-email"
                className="sa-login-input"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>
            <div className="sa-login-group">
              <label className="sa-login-label" htmlFor="admin-login-password">
                Password
              </label>
              <PasswordField
                id="admin-login-password"
                inputClassName="sa-login-input"
                autoComplete="current-password"
                value={form.password}
                onChange={set("password")}
                required
              />
            </div>
            <div className="sa-login-forgot">
              <button
                type="button"
                className="sa-login-forgot-btn"
                onClick={onForgotPassword}
                disabled={loading || resetSending}
              >
                {resetSending ? "Sending reset link…" : "Forgot password?"}
              </button>
            </div>
            <button className="sa-login-btn" type="submit" disabled={loading || resetSending}>
              {loading ? (
                <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
              ) : (
                "Continue"
              )}
            </button>
          </>
        ) : step === "otp" ? (
          <>
            {challenge?.emailSent === false && challenge?.message ? (
              <div className="sa-login-warn" role="status">
                {challenge.message}
              </div>
            ) : null}
            <div className="sa-login-group">
              <label className="sa-login-label" htmlFor="admin-login-email-otp">
                {challenge?.maskedEmail ? `Email code · ${challenge.maskedEmail}` : "Email code"}
              </label>
              <input
                id="admin-login-email-otp"
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
                placeholder="000000"
              />
            </div>
            <button className="sa-login-btn" type="submit" disabled={loading || emailOtp.length !== 6}>
              {loading ? (
                <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
              ) : (
                "Verify & sign in"
              )}
            </button>
            <div className="sa-login-otp-actions">
              <button
                type="button"
                className="sa-btn sa-btn-ghost sa-text-sm"
                onClick={onResend}
                disabled={loading || resendIn > 0}
              >
                {resendIn > 0 ? `Resend code (${resendIn}s)` : "Resend code"}
              </button>
              <button type="button" className="sa-btn sa-btn-ghost sa-text-sm" onClick={backToCredentials}>
                Back to sign in
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sa-login-group">
              <label className="sa-login-label" htmlFor="admin-login-dual-email-otp">
                {challenge?.maskedEmail ? `Email code · ${challenge.maskedEmail}` : "Email code"}
              </label>
              <input
                id="admin-login-dual-email-otp"
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
                placeholder="000000"
              />
              <div className="sa-login-otp-actions" style={{ marginTop: 8, justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="sa-btn sa-btn-ghost sa-text-sm"
                  onClick={onSendEmailCode}
                  disabled={loading || resendIn > 0}
                >
                  {resendIn > 0 ? `Send code (${resendIn}s)` : emailSent ? "Resend code" : "Send email code"}
                </button>
              </div>
            </div>

            <div className="sa-login-group">
              <label className="sa-login-label" htmlFor="admin-login-totp">
                Authenticator code
              </label>
              <input
                id="admin-login-totp"
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="000000"
              />
            </div>

            <button
              className="sa-login-btn"
              type="submit"
              disabled={loading || emailOtp.length !== 6 || totp.length !== 6}
            >
              {loading ? (
                <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
              ) : (
                "Verify & sign in"
              )}
            </button>

            <div className="sa-login-otp-actions">
              <button type="button" className="sa-btn sa-btn-ghost sa-text-sm" onClick={backToCredentials}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </form>
    </AdminAuthCard>
  );
}
