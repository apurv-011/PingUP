import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          router: ["react-router-dom"],
          redux: ["react-redux", "@reduxjs/toolkit"],
          clerk: ["@clerk/react"],
          ui: ["lucide-react", "react-hot-toast"],
          time: ["moment"],
        },
      },
    },
  },
});
