import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "eval");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

type RouteContext = { params: Promise<{ path?: string[] }> };

export function GET(_request: Request, context: RouteContext) {
  return context.params.then(({ path: parts }) => {
    const rel = (parts || []).join("/");
    const file = resolveDossier(rel);
    if (!file) return new Response("Not found", { status: 404 });
    const ext = path.extname(file);
    return new Response(readFileSync(file), {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=0",
      },
    });
  });
}

function resolveDossier(rel: string): string | null {
  const candidates = rel ? [rel, `${rel}.html`] : ["index.html"];
  for (const candidate of candidates) {
    const file = path.resolve(ROOT, candidate);
    const root = path.resolve(ROOT);
    if (file !== root && !file.startsWith(root + path.sep)) continue;
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    return file;
  }
  return null;
}
