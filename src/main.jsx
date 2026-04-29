import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import { AdminRouter } from "./admin/AdminRouter.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminRouter />} />
        <Route path="/*"       element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
