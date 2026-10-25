import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { loadAdSenseIfAllowed } from "./ads/adsense.ts";
import { getConsent, loadAnalytics } from "./api/analytics.ts";
import "98.css";
import "./index.css";

if (getConsent() === "granted") loadAnalytics();
loadAdSenseIfAllowed();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
