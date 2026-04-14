import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { defineConfig } from "vite";
import viteSolid from "vite-plugin-solid";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 4175,
  },
  preview: {
    port: 4175,
  },
  plugins: [
    tailwindcss(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    nitro({
      config: { preset: "node-server" },
    }),
    tanstackStart({ spa: { enabled: false } }),
    viteSolid({ ssr: true }),
  ],
});
