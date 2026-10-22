import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Starts the i18n layer in English for every test.
    setupFiles: ["./src/test/setup.ts"],
  },
});
