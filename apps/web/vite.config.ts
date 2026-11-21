import { SECURITY_HEADERS } from "../../packages/contract/src/security.ts";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const NOINDEX_TAG = '<meta name="robots" content="noindex" />';

// Emits the empty app shell the Worker serves for /app and /sign-in, and Cloudflare's `_headers` for static assets.
function appShellAndHeaders(): Plugin {
  return {
    name: "app-shell-and-headers",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      const template = index?.type === "asset" ? String(index.source) : "";

      this.emitFile({
        type: "asset",
        fileName: "app-shell.html",
        source: template.replace("</head>", `  ${NOINDEX_TAG}\n  </head>`),
      });
      const headerLines = Object.entries(SECURITY_HEADERS).map(([name, value]) => {
        return `  ${name}: ${value}`;
      });
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: ["/*", ...headerLines, ""].join("\n"),
      });
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), appShellAndHeaders()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/dev": "http://localhost:8787",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
