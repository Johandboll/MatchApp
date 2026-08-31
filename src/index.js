import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { APP_VERSION, BUILD_TIME } from "./config/appVersion";
import { migrateLegacyStorage } from "./lib/storageKeys";

migrateLegacyStorage();

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", async () => {
    const baseUrl = process.env.PUBLIC_URL || "";
    const cacheScope = /(^|\/)test$/i.test(baseUrl) ? "test" : "prod";
    const repairMarker = `matchapp:${cacheScope}:worker-repair:${APP_VERSION}`;

    // 2.0.4.9 repairs iOS installations that are still controlled by the
    // original worker and therefore launch an old app shell offline.
    if (APP_VERSION === "2.0.4.9" && !localStorage.getItem(repairMarker)) {
      try {
        const oldRegistration = await navigator.serviceWorker.getRegistration();
        if (oldRegistration) await oldRegistration.unregister();
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => (
              key.startsWith(`matchapp-${cacheScope}-shell-`) || /^matchapp-shell-v\d+$/i.test(key)
            ))
            .map((key) => caches.delete(key))
        );
        localStorage.setItem(repairMarker, "1");
      } catch {
        // Registration below still gets a chance to replace the old worker.
      }
    }

    const notifyUpdateAvailable = (registration) => {
      window.dispatchEvent(
        new CustomEvent("matchapp:update-available", {
          detail: { registration }
        })
      );
    };

    navigator.serviceWorker
      // A build-specific URL makes the browser install a fresh worker even
      // when the service-worker source itself has not changed.
      .register(`${baseUrl}/service-worker.js?v=${encodeURIComponent(`${APP_VERSION}-${BUILD_TIME}`)}`)
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

        const updateRegistration = () => {
          if (navigator.onLine === false) return;
          registration.update().catch(() => {});
        };
        window.setInterval(updateRegistration, 5 * 60 * 1000);
        window.addEventListener("online", updateRegistration);
      })
      .catch(() => {});
  });
}
