import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/app-theme.css";
import "./styles/ux.css";
import App from "./App.jsx";
import { AuthProvider } from "./components/Auth/AuthProvider";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

document.documentElement.setAttribute("data-theme", "dark");

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
