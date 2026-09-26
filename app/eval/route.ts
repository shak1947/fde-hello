import { readFileSync } from "node:fs";
import path from "node:path";

const html = readFileSync(path.join(process.cwd(), "public/eval/index.html"), "utf8");

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0",
    },
  });
}
