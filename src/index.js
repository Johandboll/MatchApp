import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    const baseUrl = process.env.PUBLIC_URL || "";
    navigator.serviceWorker.register(`${baseUrl}/service-worker.js`).catch(() => {});
  });
}
