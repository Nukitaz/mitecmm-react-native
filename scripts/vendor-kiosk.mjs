/**
 * Genera los archivos del motor 3D a partir de una única fuente:
 *   src/components/mapa3d/runtime/kiosk.html
 *   src/components/mapa3d/runtime/kiosk-runtime.js
 *   node_modules/three/build/three.min.js   (versión fija en package.json)
 *
 * Salidas (no se versionan, ver .gitignore):
 *   public/vendor/kiosk.html, kiosk-runtime.js, three.min.js  -> web (iframe, sin CDN)
 *   src/vendor/kioskBundle.native.ts                          -> Android/iOS (HTML inline)
 *   src/vendor/kioskBundle.ts                                 -> web (solo versión)
 *
 * Se ejecuta automáticamente en postinstall, start, web, android, ios y predeploy.
 * Manual:  npm run vendor
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p) => readFileSync(join(raiz, p), "utf8");
const escribir = (p, contenido) => {
  mkdirSync(dirname(join(raiz, p)), { recursive: true });
  writeFileSync(join(raiz, p), contenido);
};

const three = leer("node_modules/three/build/three.min.js");
const runtime = leer("src/components/mapa3d/runtime/kiosk-runtime.js");
const plantilla = leer("src/components/mapa3d/runtime/kiosk.html");

const version = createHash("sha256").update(three).update(runtime).update(plantilla).digest("hex").slice(0, 12);

// ---------- Web: archivos estáticos servidos desde el propio dominio ----------
const cspWeb =
  "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: blob:; base-uri 'none'; form-action 'none'";
const htmlWeb = plantilla
  .replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${cspWeb}" />`)
  .replace("<!--THREE-->", `<script src="three.min.js?v=${version}"></script>`)
  .replace("<!--RUNTIME-->", `<script src="kiosk-runtime.js?v=${version}"></script>`);

escribir("public/vendor/three.min.js", three);
escribir("public/vendor/kiosk-runtime.js", runtime);
escribir("public/vendor/kiosk.html", htmlWeb);

// ---------- Móvil: todo inline (funciona sin conexión) ----------
const inline = (js) => {
  // "<!--" dentro de un <script> inline altera el parseo HTML: no se permite.
  if (js.includes("<!--")) throw new Error("[vendor-kiosk] el JS contiene '<!--' y no puede ir inline");
  return js.replace(/<\/script/gi, "<\\/script");
};
const cspNativo =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; base-uri 'none'; form-action 'none'";
const htmlNativo = plantilla
  .replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${cspNativo}" />`)
  .replace("<!--THREE-->", () => `<script>${inline(three)}</script>`)
  .replace("<!--RUNTIME-->", () => `<script>${inline(runtime)}</script>`);

const cabecera = "// ARCHIVO GENERADO por scripts/vendor-kiosk.mjs — no editar.\n";
escribir(
  "src/vendor/kioskBundle.native.ts",
  `${cabecera}export const KIOSK_VERSION = ${JSON.stringify(version)};\nexport const KIOSK_HTML_NATIVE: string | null = ${JSON.stringify(htmlNativo)};\n`
);
escribir(
  "src/vendor/kioskBundle.ts",
  `${cabecera}export const KIOSK_VERSION = ${JSON.stringify(version)};\nexport const KIOSK_HTML_NATIVE: string | null = null;\n`
);

console.log(`[vendor-kiosk] motor 3D generado (versión ${version}, three ${JSON.parse(leer("node_modules/three/package.json")).version})`);
