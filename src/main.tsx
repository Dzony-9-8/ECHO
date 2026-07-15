import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/themes";
import { initFont } from "./lib/fonts";

// Restore user preferences (theme first, then per-property overrides)
initTheme();
initFont();
const savedAccent = localStorage.getItem("echo_accent");
if (savedAccent) document.documentElement.style.setProperty("--primary", savedAccent);
const savedFontSize = localStorage.getItem("echo_fontsize");
if (savedFontSize) document.documentElement.style.setProperty("--chat-font-size", savedFontSize);
if (localStorage.getItem("echo_scanlines") === "false") document.documentElement.classList.add("no-scanlines");

createRoot(document.getElementById("root")!).render(<App />);

// Service worker: production only.
//
// In dev the SW's cache-first strategy intercepts Vite's module requests and can
// serve a stale copy of a dependency alongside a freshly optimized one — two
// copies of React in the same graph, which surfaces as "Invalid hook call" and a
// blank page. Register it only for real builds, and actively tear down any SW +
// caches left over from a previous dev session.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }
}
