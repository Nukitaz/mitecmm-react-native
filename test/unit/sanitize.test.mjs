// Validación y escape de datos que llegan por URL y terminan en HTML/JS (Bloque 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { esIdSvgValido, normalizarAulaParam, jsonParaScript } from "../../src/utils/sanitize.ts";

const ATAQUES = [
  '";top.__pwned=1;//',
  "</script><img src=x onerror=top.__pwned=1>",
  '|x"/><img src=x onerror=top.__pwned=1>',
  "'); alert(1); ('",
  "${alert(1)}",
  "aula_a1\u2028alert(1)",
  "../../etc/passwd",
  "(?=a)*+[",
  "javascript:alert(1)",
];

test("esIdSvgValido acepta solo [a-z0-9_] de 1 a 80 caracteres", () => {
  for (const ok of ["aula_a1", "laboratorio_de_redes_lr", "a", "x".repeat(80), "bodega_em4"]) {
    assert.equal(esIdSvgValido(ok), true, ok);
  }
  for (const mal of ["", "Aula_A1", "aula-a1", "aula a1", "x".repeat(81), "aula_á1", null, undefined, 12, {}, ...ATAQUES]) {
    assert.equal(esIdSvgValido(mal), false, String(mal));
  }
});

test("normalizarAulaParam deja solo letras, dígitos, espacio, '_' y '-'", () => {
  assert.equal(normalizarAulaParam("A1"), "A1");
  assert.equal(normalizarAulaParam("  Laboratorio de Redes  "), "Laboratorio de Redes");
  assert.equal(normalizarAulaParam("Cómputo-2"), "Cómputo-2");
  for (const a of ATAQUES) {
    const r = normalizarAulaParam(a);
    assert.ok(r === null || /^[\p{L}\p{N} _-]{1,60}$/u.test(r), `${a} -> ${r}`);
  }
  assert.equal(normalizarAulaParam("x".repeat(200))?.length, 60);
});

test("normalizarAulaParam devuelve null cuando no queda nada útil", () => {
  for (const v of ["", "   ", "<>\"';", null, undefined, 5, ["A1"]]) assert.equal(normalizarAulaParam(v), null, String(v));
});

test("jsonParaScript no puede cerrar el <script> ni romper el JS", () => {
  for (const a of [...ATAQUES, "\u2029", "&amp;", "<!--", "]]>"]) {
    const salida = jsonParaScript(a);
    assert.doesNotMatch(salida, /[<>&\u2028\u2029]/, a);
    // Incrustado como literal en un script se evalúa exactamente al valor original
    assert.equal(new Function(`return ${salida};`)(), a);
  }
});

test("jsonParaScript serializa objetos y undefined", () => {
  const obj = { id: "aula_a1", lista: [1, "</script>"] };
  assert.deepEqual(new Function(`return ${jsonParaScript(obj)};`)(), obj);
  assert.equal(jsonParaScript(undefined), "null");
});
