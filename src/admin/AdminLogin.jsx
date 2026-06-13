import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminAuth } from "./AdminContext.jsx";
import { AdminBrandLogo } from "./components/AdminBrandLogo.jsx";
import { SmhLoader } from "../components/SmhLoader.jsx";
import { clearLoginChallenge, readLoginChallenge, saveLoginChallenge } from "./loginChallenge.js";

export function AdminLogin({ initialStep = "credentials" }) {
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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if ((step === "otp" || step === "dual") && !challenge) {
      setStep("credentials");
    }
  }, [step, challenge]);

  useEffect(() => {
    const email = String(searchParams.get("email") || "").trim();
    if (email) setForm((f) => ({ ...f, email }));
    if (searchParams.get("activated") === "1") {
      setSearchParams({}, { replace: true });
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

  const subTitle =
    step === "dual" ? "Verification" : step === "otp" ? "Verification" : "Admin Portal";

  return (
    <div className="sa-login-page">
      <form className="sa-login-card" onSubmit={onSubmit}>
        <div className="sa-login-logo">
          <AdminBrandLogo variant="login" />
          <div>
            <div className="sa-login-title">Salvation Ministries</div>
            <div className="sa-login-sub">{subTitle}</div>
          </div>
        </div>

        {error ? <div className="sa-login-err">{error}</div> : null}

        {step === "credentials" ? (
          <>
            <div className="sa-login-group">
              <label className="sa-login-label">Email</label>
              <input
                className="sa-login-input"
                type="text"
                autoComplete="username"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>
            <div className="sa-login-group">
              <label className="sa-login-label">Password</label>
              <input
                className="sa-login-input"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={set("password")}
                required
              />
            </div>
            <button className="sa-login-btn" type="submit" disabled={loading}>
              {loading ? (
                <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
              ) : (
                "Sign in"
              )}
            </button>
          </>
        ) : step === "otp" ? (
          <>
            {challenge?.emailSent === false && challenge?.message ? (
              <div className="sa-login-err" role="status">
                {challenge.message}
              </div>
            ) : null}
            <div className="sa-login-group">
              <label className="sa-login-label">
                {challenge?.maskedEmail ? `Email code · ${challenge.maskedEmail}` : "Email code"}
              </label>
              <input
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
              />
            </div>
            <button className="sa-login-btn" type="submit" disabled={loading || emailOtp.length !== 6}>
              {loading ? (
                <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
              ) : (
                "Continue"
              )}
            </button>
            <div className="sa-login-otp-actions">
              <button
                type="button"
                className="sa-btn sa-btn-ghost sa-text-sm"
                onClick={onResend}
                disabled={loading || resendIn > 0}
              >
                {resendIn > 0 ? `Resend (${resendIn}s)` : "Resend"}
              </button>
              <button type="button" className="sa-btn sa-btn-ghost sa-text-sm" onClick={backToCredentials}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sa-login-group">
              <label className="sa-login-label">
                {challenge?.maskedEmail ? `Email code · ${challenge.maskedEmail}` : "Email code"}
              </label>
              <input
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
              />
              <div className="sa-login-otp-actions" style={{ marginTop: 8, justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="sa-btn sa-btn-ghost sa-text-sm"
                  onClick={onSendEmailCode}
                  disabled={loading || resendIn > 0}
                >
                  {resendIn > 0 ? `Send code (${resendIn}s)` : emailSent ? "Resend code" : "Send code"}
                </button>
              </div>
            </div>

            <div className="sa-login-group">
              <label className="sa-login-label">Authenticator code</label>
              <input
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
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
                "Sign in"
              )}
            </button>

            <div className="sa-login-otp-actions">
              <button type="button" className="sa-btn sa-btn-ghost sa-text-sm" onClick={backToCredentials}>
                Back
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
