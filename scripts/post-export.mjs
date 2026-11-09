/**
 * Post-procesado del build web para GitHub Pages (que no permite cabeceras HTTP).
 *
 * - Inserta la CSP de vercel.json como <meta http-equiv> en dist/index.html.
 *   (Las directivas frame-ancestors / sandbox / report-* no funcionan en <meta> y se omiten;
 *    en Vercel se aplican completas como cabeceras.)
 * - Copia index.html a 404.html (fallback SPA de GitHub Pages).
 *
 * Uso: node scripts/post-export.mjs [carpeta]   (por defecto: dist)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(raiz, process.argv[2] || "dist");
const indexPath = join(dist, "index.html");
if (!existsSync(indexPath)) throw new Error(`[post-export] no existe ${indexPath}; ejecuta antes "npx expo export -p web"`);

const vercel = JSON.parse(readFileSync(join(raiz, "vercel.json"), "utf8"));
const reglaApp = vercel.headers.find((r) => !r.source.startsWith("/vendor/"));
const csp = reglaApp?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
if (!csp) throw new Error("[post-export] no se encontró la CSP de la app en vercel.json");

const cspMeta = csp
  .split(";")
  .map((d) => d.trim())
  .filter((d) => d && !/^(frame-ancestors|sandbox|report-uri|report-to)\b/.test(d))
  .join("; ");

let html = readFileSync(indexPath, "utf8");
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, "");
html = html.replace(
  /<meta charset="utf-8"\s*\/?>/i,
  (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${cspMeta}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`
);
if (!html.includes('http-equiv="Content-Security-Policy"')) throw new Error("[post-export] no se pudo insertar la CSP");

writeFileSync(indexPath, html);
writeFileSync(join(dist, "404.html"), html);
console.log("[post-export] CSP insertada en index.html y 404.html");
