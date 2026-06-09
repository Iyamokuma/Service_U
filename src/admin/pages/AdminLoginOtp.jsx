import { AdminLogin } from "../AdminLogin.jsx";

/** Legacy /admin/verify URL — renders the OTP step of the shared login flow. */
export function AdminLoginOtp() {
  return <AdminLogin initialStep="otp" />;
}
