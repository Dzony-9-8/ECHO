import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    // Pre-bundle everything the lazy-loaded views pull in. If a dep is only
    // discovered when a view is first opened, Vite re-optimizes mid-session and
    // reloads, which is what produced the transient "Invalid hook call" blanks.
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "recharts",
      "framer-motion",
      "lucide-react",
      "sonner",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
    // No `force: true` — it re-bundled deps on every dev start, minting a fresh
    // ?v= hash each time for no benefit. Vite invalidates the cache on its own
    // when lockfile/config change.
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
          "vendor-motion": ["framer-motion"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts": ["recharts"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-icons": ["lucide-react"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-slot",
          ],
        },
      },
    },
  },
}));
