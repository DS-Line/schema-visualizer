import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["@monaco-editor/react", "monaco-editor"],
          xyflow: ["@xyflow/react", "dagre"],
          dbml: ["@dbml/parse"],
        },
      },
    },
  },
})
