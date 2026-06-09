import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminAuth } from "./AdminContext.jsx";
import { AdminBrandLogo } from "./components/AdminBrandLogo.jsx";
import { SmhLoader } from "../components/SmhLoader.jsx";
import { clearLoginChallenge, readLoginChallenge, saveLoginChallenge } from "./loginChallenge.js";

export function AdminLogin({ initialStep = "credentials" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { startLogin, verifyLoginOtp, resendLoginOtp, loading, error, clearLoginError } = useAdminAuth();
  const [step, setStep] = useState(() => {
    if (initialStep === "otp" && readLoginChallenge()) return "otp";
    return "credentials";
  });
  const [showActivated, setShowActivated] = useState(() => searchParams.get("activated") === "1");
  const [form, setForm] = useState(() => ({
    email: String(searchParams.get("email") || "").trim(),
    password: "",
  }));
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState(() => readLoginChallenge());
  const [resendIn, setResendIn] = useState(() => challenge?.resendAfter ?? 60);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (step === "otp" && !challenge) {
      setStep("credentials");
    }
  }, [step, challenge]);

  useEffect(() => {
    if (searchParams.get("activated") !== "1") return;
    setShowActivated(true);
    const email = String(searchParams.get("email") || "").trim();
    if (email) setForm((f) => ({ ...f, email }));
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "otp" || !challenge) return;
    saveLoginChallenge(challenge);
  }, [step, challenge]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function beginOtpStep(nextChallenge) {
    setChallenge(nextChallenge);
    saveLoginChallenge(nextChallenge);
    setOtp("");
    setResendIn(nextChallenge.resendAfter ?? 60);
    setStep("otp");
  }

  async function onCredentialsSubmit(e) {
    e.preventDefault();
    clearLoginError();
    const res = await startLogin(form.email, form.password);
    if (res?.needsOtp && res.challengeId) {
      beginOtpStep({
        challengeId: res.challengeId,
        maskedEmail: res.maskedEmail,
        resendAfter: res.resendAfter ?? 60,
        emailSent: res.emailSent !== false,
        message: res.message || "",
      });
      return;
    }
    if (res?.loggedIn) {
      clearLoginChallenge();
      setForm((f) => ({ ...f, password: "" }));
    }
  }

  function onOtpChange(e) {
    const next = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(next);
    if (next.length === 6 && challenge?.challengeId && !loading) {
      verifyLoginOtp(challenge.challengeId, next);
    }
  }

  async function onOtpSubmit(e) {
    e.preventDefault();
    clearLoginError();
    if (!challenge?.challengeId || otp.length !== 6) return;
    const ok = await verifyLoginOtp(challenge.challengeId, otp);
    if (ok) clearLoginChallenge();
  }

  async function onResend() {
    if (!challenge?.challengeId || resendIn > 0 || loading) return;
    clearLoginError();
    try {
      const res = await resendLoginOtp(challenge.challengeId);
      const next = {
        ...challenge,
        maskedEmail: res.email_masked || challenge.maskedEmail,
        emailSent: true,
        message: "",
      };
      setChallenge(next);
      saveLoginChallenge(next);
      setResendIn(res.resend_after ?? 60);
      setOtp("");
    } catch {
      /* error set in context */
    }
  }

  function backToCredentials() {
    clearLoginChallenge();
    setStep("credentials");
    setOtp("");
    setChallenge(null);
    clearLoginError();
  }

  const onSubmit = step === "otp" ? onOtpSubmit : onCredentialsSubmit;

  return (
    <div className="sa-login-page">
      <form className="sa-login-card" onSubmit={onSubmit}>
        <div className="sa-login-logo">
          <AdminBrandLogo variant="login" />
          <div>
            <div className="sa-login-title">Salvation Ministries</div>
            <div className="sa-login-sub">
              {step === "otp" ? "Verify your email" : "Admin Portal"}
            </div>
          </div>
        </div>

        {showActivated && step === "credentials" ? (
          <div className="sa-login-success" role="status">
            Your account is ready. Sign in with your email and password — we will email you a verification code
            to complete login.
          </div>
        ) : null}

        {error ? <div className="sa-login-err">{error}</div> : null}

        {step === "credentials" ? (
          <>
            <div className="sa-login-group">
              <label className="sa-login-label">Username or email</label>
              <input
                className="sa-login-input"
                type="text"
                autoComplete="username"
                placeholder="username or you@church.org"
                value={form.email}
                onChange={set("email")}
                required
              />
              <div className="sa-field-hint" style={{ marginTop: 6 }}>
                Super Admin signs in with password only. All other roles receive a 6-digit code by email after
                password verification.
              </div>
            </div>

            <div className="sa-login-group">
              <label className="sa-login-label">Password</label>
              <input
                className="sa-login-input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
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

            {loading ? (
              <p className="sa-text-muted sa-text-sm sa-login-otp-pending" role="status">
                Checking your password and preparing verification…
              </p>
            ) : null}
          </>
        ) : (
          <>
            {challenge?.emailSent === false && challenge?.message ? (
              <div className="sa-login-warn" role="status">
                {challenge.message}
              </div>
            ) : null}

            <p className="sa-text-muted sa-text-sm" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
              We sent a 6-digit code to <strong>{challenge?.maskedEmail || "your email"}</strong>. Enter it below
              to finish signing in.
            </p>

            <div className="sa-login-group">
              <label className="sa-login-label">Login code</label>
              <input
                className="sa-login-input sa-login-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                pattern="[0-9]{6}"
                value={otp}
                onChange={onOtpChange}
                required
                autoFocus
              />
            </div>

            <button className="sa-login-btn" type="submit" disabled={loading || otp.length !== 6}>
              {loading ? (
                <SmhLoader label="" variant="compact" size={24} className="sa-login-btn-loader" />
              ) : (
                "Sign in"
              )}
            </button>

            {loading ? (
              <p className="sa-text-muted sa-text-sm sa-login-otp-pending" role="status">
                Verifying code and opening your dashboard…
              </p>
            ) : null}

            <div className="sa-login-otp-actions">
              <button
                type="button"
                className="sa-btn sa-btn-ghost sa-text-sm"
                onClick={onResend}
                disabled={loading || resendIn > 0}
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button type="button" className="sa-btn sa-btn-ghost sa-text-sm" onClick={backToCredentials}>
                Use different account
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
