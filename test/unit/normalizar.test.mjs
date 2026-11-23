import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiarNombre } from "../../src/hooks/procesadorHorarios/normalizar.ts";

test("limpiarNombre normaliza nombres con espacios y puntuación final", () => {
  assert.equal(limpiarNombre("  SOFT.   APLIC.  EJEC.  "), "SOFT. APLIC. EJEC");
  assert.equal(limpiarNombre("Álgebra   superior."), "ALGEBRA SUPERIOR");
  assert.equal(limpiarNombre("Programación;;;"), "PROGRAMACION");
});

test("limpiarNombre rechaza marcadores comunes de contenido de prueba", () => {
  for (const valor of [
    "prueba",
    "texto de prueba",
    "MATERIA DE EJEMPLO",
    "DOCENTE DE PRUEBA UNO",
    "lorem ipsum",
    "dummy",
    "asdf",
  ]) {
    assert.equal(limpiarNombre(valor), null, `${valor} debería rechazarse`);
  }
});

test("limpiarNombre conserva nombres académicos válidos", () => {
  assert.equal(limpiarNombre("Diseño digital"), "DISEÑO DIGITAL");
  assert.equal(limpiarNombre("Prueba de sistemas"), "PRUEBA DE SISTEMAS");
});
