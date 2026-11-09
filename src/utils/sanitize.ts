/**
 * Utilidades de validación y escape para datos que llegan desde la URL,
 * la base de datos o los planos SVG y terminan dentro de HTML / JavaScript.
 */

/** IDs de elementos SVG de aulas: solo minúsculas, dígitos y guion bajo. */
const SVG_ID_RE = /^[a-z0-9_]{1,80}$/;

export function esIdSvgValido(id: unknown): id is string {
  return typeof id === "string" && SVG_ID_RE.test(id);
}

/**
 * Normaliza el texto de un aula recibido por parámetro de ruta (p. ej. "?aulaResaltada=A1").
 * Elimina cualquier carácter fuera de letras, dígitos, espacio, guion y guion bajo,
 * y limita la longitud. Devuelve null si no queda nada utilizable.
 */
export function normalizarAulaParam(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, 60);
  return limpio.length > 0 ? limpio : null;
}

/**
 * Serializa un valor para incrustarlo dentro de un bloque <script>.
 * Escapa "<", ">", "&" y los separadores de línea U+2028/U+2029 para que
 * ningún contenido (p. ej. "</script>") pueda cerrar el bloque o romper el JS.
 */
export function jsonParaScript(valor: unknown): string {
  return JSON.stringify(valor ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
