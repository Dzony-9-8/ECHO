import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Restore user preferences
const savedAccent = localStorage.getItem("echo_accent");
if (savedAccent) document.documentElement.style.setProperty("--primary", savedAccent);
const savedFontSize = localStorage.getItem("echo_fontsize");
if (savedFontSize) document.documentElement.style.setProperty("--chat-font-size", savedFontSize);
if (localStorage.getItem("echo_scanlines") === "false") document.documentElement.classList.add("no-scanlines");

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
