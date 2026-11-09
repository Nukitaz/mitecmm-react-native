// Lista accesible de espacios (Bloque 9) con los planos reales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { listarEspacios } from "../../src/utils/espacios.ts";
import { sanitizarSvg } from "../../src/utils/svgSanitizer.ts";
import { PLANOS_EDIFICIO, leerPlano, leerFixture } from "./planos.mjs";

const comparar = (a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

for (const archivo of PLANOS_EDIFICIO) {
  test(`plano real ${archivo}: lista de espacios válida y ordenada`, () => {
    const espacios = listarEspacios(sanitizarSvg(leerPlano(archivo)));
    assert.ok(espacios.length >= 3, `solo ${espacios.length} espacios`);
    const ids = espacios.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, "IDs repetidos");
    for (const e of espacios) {
      assert.match(e.id, /^[a-z0-9_]{1,80}$/i);
      assert.ok(e.nombre.trim().length > 0, e.id);
      assert.notEqual(e.id, "contorno_edificio");
      assert.doesNotMatch(e.id, /^(rect|path|g)\d+$/i, "ID automático");
    }
    for (let i = 1; i < espacios.length; i++) assert.ok(comparar(espacios[i - 1].nombre, espacios[i].nombre) <= 0);
  });
}

test("edificio A, planta baja: incluye las aulas conocidas en orden natural", () => {
  const nombres = listarEspacios(leerPlano("planta_baja_edificio_a.svg")).map((e) => e.nombre);
  for (const n of ["Aula A1", "Aula A2", "Aula A5"]) assert.ok(nombres.includes(n), n);
  assert.ok(nombres.indexOf("Aula A2") < nombres.indexOf("Aula A3"));
});

test("orden natural: Aula A2 antes que Aula A10", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="aula_a10"/><rect id="aula_a2"/><rect id="aula_a1"/></svg>`;
  assert.deepEqual(listarEspacios(svg).map((e) => e.nombre), ["Aula A1", "Aula A2", "Aula A10"]);
});

test("plano con contorno_edificio: el contorno no aparece como espacio", () => {
  const ids = listarEspacios(leerFixture("sintetico_baja_contorno.svg")).map((e) => e.id);
  assert.ok(ids.length > 0);
  assert.ok(!ids.includes("contorno_edificio"));
});

test("entradas vacías o inválidas devuelven lista vacía", () => {
  for (const v of [null, undefined, "", "<html></html>", "{}"]) assert.deepEqual(listarEspacios(v), []);
});
