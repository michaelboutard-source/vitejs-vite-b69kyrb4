import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "@i18n"; // uses alias from vite.config.ts

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
// Register service worker (ignore in dev if needed)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* no-op */
    });
  });
}
