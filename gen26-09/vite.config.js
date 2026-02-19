import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,

    // Uncomment als HMR/watching ooit vreemd doet (meestal niet nodig als je in WSL edit):
    // watch: { usePolling: true, interval: 100 },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
});

