// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@lib": "/src/lib",
      "@db": "/src/db",
      "@pages": "/src/pages",
      "@components": "/src/components",
      "@i18n": "/src/i18n",
    },
  },
});
