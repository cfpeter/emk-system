import { resolve } from "node:path";
import { defineConfig } from "vite";

// Relative base so the build works at any GitHub Pages path (user.github.io/<repo>/).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        product: resolve(import.meta.dirname, "product.html"),
        info: resolve(import.meta.dirname, "info.html"),
      },
    },
  },
});
