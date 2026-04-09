import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("@monaco-editor/react") ||
            id.includes("monaco-editor")
          )
            return "monaco"
          if (id.includes("@xyflow/react") || id.includes("dagre"))
            return "xyflow"
          if (id.includes("@dbml/parse")) return "dbml"
        },
      },
    },
  },
})
