/**
 * Preparación de las pruebas unitarias (se carga con `node --import`).
 *
 * Node 24 ejecuta TypeScript directamente (elimina los tipos), pero exige extensiones
 * en los imports. Este gancho:
 *  - resuelve imports relativos sin extensión (".ts", ".tsx", ".js"), como hace Metro;
 *  - sustituye el cliente real de Supabase por uno falso (sin red ni credenciales);
 *  - define __DEV__ (global de React Native).
 */
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

globalThis.__DEV__ = false;

const SUPABASE_FALSO = new URL("./stubs/supabase.mjs", import.meta.url).href;
const EXTENSIONES = [".ts", ".tsx", ".js"];

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (/(^|\/)integrations\/supabase\/client$/.test(especificador)) {
      return { url: SUPABASE_FALSO, shortCircuit: true };
    }
    const relativo = especificador.startsWith("./") || especificador.startsWith("../");
    if (relativo && contexto.parentURL && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      for (const ext of EXTENSIONES) {
        const ruta = fileURLToPath(new URL(especificador + ext, contexto.parentURL));
        if (existsSync(ruta) && statSync(ruta).isFile()) return siguiente(especificador + ext, contexto);
      }
    }
    return siguiente(especificador, contexto);
  },
});
