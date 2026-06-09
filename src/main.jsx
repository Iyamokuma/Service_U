import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import { SmhLoader } from "./components/SmhLoader.jsx";
import "./styles.css";

const AdminRouter = lazy(() =>
  import("./admin/AdminRouter.jsx").then((m) => ({ default: m.AdminRouter })),
);

function AdminRouteFallback() {
  return (
    <div className="sa-login-page">
      <SmhLoader label="Loading admin" variant="page" size={64} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<AdminRouteFallback />}>
              <AdminRouter />
            </Suspense>
          }
        />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
