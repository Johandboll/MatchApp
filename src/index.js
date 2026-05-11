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
    let refreshing = false;

    const notifyUpdateAvailable = (registration) => {
      window.dispatchEvent(
        new CustomEvent("matchapp:update-available", {
          detail: { registration }
        })
      );
    };

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(`${baseUrl}/service-worker.js`)
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable(registration);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable(registration);
            }
          });
        });

        window.addEventListener("focus", () => registration.update());
        window.setInterval(() => registration.update(), 5 * 60 * 1000);
      })
      .catch(() => {});
  });
}
