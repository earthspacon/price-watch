import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = path.join(ROOT, "dist");

const server = await createServer({
  root: ROOT,
  logLevel: "warn",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { buildPrerenderedFiles } = await server.ssrLoadModule("/src/prerender/entry.tsx");
  const template = await readFile(path.join(DIST, "index.html"), "utf8");

  await mkdir(DIST, { recursive: true });

  for (const { file, content } of buildPrerenderedFiles(template)) {
    await writeFile(path.join(DIST, file), content);
  }
} finally {
  await server.close();
}
