import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AdminPage } from "./components/AdminPage.tsx";
import "./index.css";

const isAdmin = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </React.StrictMode>,
);
