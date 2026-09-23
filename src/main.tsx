import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Revisa cada vez que se abre la app si hay una versión nueva
        // publicada, y si el service worker cambia, recarga solo.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {
        // Silencioso: si falla el registro, la app sigue funcionando como web normal.
      });
  });
}
