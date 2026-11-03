/**
 * Pruebas de navegador de punta a punta.
 *
 *   npm run test:e2e                     compila el sitio (test/.dist) y ejecuta todo
 *   npm run test:e2e -- --sin-compilar   reutiliza el último build
 *   npm run test:e2e -- mapa3d errores   solo esos archivos (test/e2e/<nombre>.test.cjs)
 *
 * Requiere Google Chrome (o CHROME_PATH). El build usa un Supabase ficticio:
 * todas las respuestas salen de test/fixtures y test/e2e/entorno.cjs (no toca la base real).
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const sinCompilar = args.includes("--sin-compilar");
const filtros = args.filter((a) => !a.startsWith("--"));

function ejecutar(comando, argumentos, env = {}) {
  const r = spawnSync(comando, argumentos, {
    cwd: raiz,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

ejecutar("node", ["scripts/vendor-kiosk.mjs"]);
if (!sinCompilar) {
  ejecutar("npx", ["expo", "export", "-p", "web", "--output-dir", "test/.dist", "--clear"], {
    EXPO_PUBLIC_SUPABASE_URL: "https://pruebas-mitecmm.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "clave-de-prueba",
    CI: "1",
  });
  ejecutar("node", ["scripts/post-export.mjs", "test/.dist"]);
}

const archivos = readdirSync(join(raiz, "test", "e2e"))
  .filter((f) => f.endsWith(".test.cjs"))
  .filter((f) => !filtros.length || filtros.some((n) => f.startsWith(n)))
  .map((f) => join("test", "e2e", f));
if (!archivos.length) {
  console.error(`No hay pruebas que coincidan con: ${filtros.join(", ")}`);
  process.exit(1);
}
ejecutar("node", ["--test", "--test-concurrency=1", ...archivos]);
