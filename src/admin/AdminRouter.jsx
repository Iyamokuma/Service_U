import "./admin.css";
import { Routes, Route } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminContext.jsx";
import { AdminLogin } from "./AdminLogin.jsx";
import { AdminLayout } from "./AdminLayout.jsx";
import { AdminAcceptInvite } from "./pages/AdminAcceptInvite.jsx";
import { ForceChangePassword } from "./components/ForceChangePassword.jsx";
import { ToastProvider } from "./components/Toast.jsx";

function AdminGate() {
  const { admin } = useAdminAuth();
  if (!admin) return <AdminLogin />;
  if (admin.must_change_password) return <ForceChangePassword />;
  return <AdminLayout />;
}

export function AdminRouter() {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="accept-invite" element={<AdminAcceptInvite />} />
          <Route path="*" element={<AdminGate />} />
        </Routes>
      </ToastProvider>
    </AdminAuthProvider>
  );
}
