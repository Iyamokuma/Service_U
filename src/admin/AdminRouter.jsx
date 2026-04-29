import "./admin.css";
import { AdminAuthProvider, useAdminAuth } from "./AdminContext.jsx";
import { AdminLogin } from "./AdminLogin.jsx";
import { AdminLayout } from "./AdminLayout.jsx";
import { ToastProvider } from "./components/Toast.jsx";

function AdminGate() {
  const { admin } = useAdminAuth();
  return admin ? <AdminLayout /> : <AdminLogin />;
}

export function AdminRouter() {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <AdminGate />
      </ToastProvider>
    </AdminAuthProvider>
  );
}
