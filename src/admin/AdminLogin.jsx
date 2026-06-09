import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminAuth } from "./AdminContext.jsx";
import { AdminBrandLogo } from "./components/AdminBrandLogo.jsx";
import { SmhLoader } from "../components/SmhLoader.jsx";

export function AdminLogin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { startLogin, verifyLoginOtp, resendLoginOtp, loading, error, setLoginError, clearLoginError } =
    useAdminAuth();
  const [step, setStep] = useState("credentials");
  const [showActivated, setShowActivated] = useState(() => searchParams.get("activated") === "1");
  const [form, setForm] = useState(() => ({
    email: String(searchParams.get("email") || "").trim(),
    password: "",
  }));
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [resendIn, setResendIn] = useState(0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (searchParams.get("activated") !== "1") return;
    setShowActivated(true);
    const email = String(searchParams.get("email") || "").trim();
    if (email) setForm((f) => ({ ...f, email }));
    setSearchParams({}, { replace: true });
    // Run once when landing from invite activation (query params cleared after read).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function onCredentialsSubmit(e) {
    e.preventDefault();
    clearLoginError();
    const res = await startLogin(form.email, form.password);
    if (res?.needsOtp) {
      setChallenge(res);
      setOtp("");
      setResendIn(res.resendAfter ?? 60);
      setStep("otp");
    }
  }

  async function onOtpSubmit(e) {
    e.preventDefault();
    clearLoginError();
    if (!challenge?.challengeId) return;
    await verifyLoginOtp(challenge.challengeId, otp);
  }

  async function onResend() {
    if (!challenge?.challengeId || resendIn > 0 || loading) return;
    clearLoginError();
    try {
      const res = await resendLoginOtp(challenge.challengeId);
      setChallenge((c) => ({
        ...c,
        maskedEmail: res.email_masked || c.maskedEmail,
      }));
      setResendIn(res.resend_after ?? 60);
      setOtp("");
    } catch {
      /* error set in context */
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setOtp("");
    setChallenge(null);
    clearLoginError();
  }

  return (
    <div className="sa-login-page">
      <form className="sa-login-card" onSubmit={step === "otp" ? onOtpSubmit : onCredentialsSubmit}>
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
              <label className="sa-login-label">Email</label>
              <input
                className="sa-login-input"
                type="email"
                autoComplete="username"
                placeholder="you@church.org"
                value={form.email}
                onChange={set("email")}
                required
              />
              <div className="sa-field-hint" style={{ marginTop: 6 }}>
                Super Admin may also sign in with username. All other roles use email only.
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
                "Continue"
              )}
            </button>
          </>
        ) : (
          <>
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
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
              />
            </div>

            <button className="sa-login-btn" type="submit" disabled={loading || otp.length !== 6}>
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
