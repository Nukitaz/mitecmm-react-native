// Etiquetas de espacios: fuente única para el motor 3D y la app (Bloques 8 y 9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { etiqueta, nombreLegible, tipoServicio, esEspacio, esIdServicio } from "../../src/components/mapa3d/runtime/etiquetas.js";

test("etiqueta 3D: categoría y código", () => {
  assert.deepEqual(etiqueta("aula_a3"), { categoria: "AULA", codigo: "A3" });
  assert.deepEqual(etiqueta("laboratorio_de_redes_lr"), { categoria: "LAB", codigo: "LR" });
  assert.deepEqual(etiqueta("jefatura_de_division_de_sistemas_computacionales"), { categoria: "JEFATURA", codigo: "DIV. SIST. COMP." });
  assert.deepEqual(etiqueta(""), { categoria: "", codigo: "" });
});

test("nombre legible para personas (con acentos y siglas)", () => {
  assert.equal(nombreLegible("aula_a3"), "Aula A3");
  assert.equal(nombreLegible("aula_magna"), "Aula magna");
  assert.equal(nombreLegible("laboratorio_de_redes_lr"), "Laboratorio de redes (LR)");
  assert.equal(nombreLegible("bodega_em4"), "Bodega EM4");
  assert.equal(nombreLegible("taller_restiradores_20"), "Taller restiradores 20");
  assert.equal(nombreLegible("coordinacion_de_tutorias"), "Coordinación de tutorías");
  assert.equal(nombreLegible(""), "");
});

test("nombre legible ignora caracteres fuera de [a-z0-9_]", () => {
  assert.doesNotMatch(nombreLegible('aula_<img src=x onerror="1">'), /[<>"=]/);
});

test("tipo de servicio para iconos", () => {
  assert.equal(tipoServicio("sanitario_hombres"), "restroom");
  assert.equal(tipoServicio("bano_mujeres"), "restroom");
  assert.equal(tipoServicio("consultorio_medico"), "medical");
  assert.equal(tipoServicio("caseta_de_vigilancia"), "security");
  assert.equal(tipoServicio("escalera_norte"), "stairs");
  assert.equal(tipoServicio("subestacion_electrica"), "electric");
  assert.equal(tipoServicio("aula_a1"), null);
});

test("qué elementos son espacios (misma regla en 3D y en la lista)", () => {
  assert.equal(esEspacio("rect", "aula_a1"), true);
  assert.equal(esEspacio("svg:rect", "aula_a1"), true);
  assert.equal(esEspacio("rect", "rect1234"), false, "ID automático de Inkscape");
  assert.equal(esEspacio("rect", "contorno_edificio"), false, "ID reservado para apilar plantas");
  assert.equal(esEspacio("path", "sanitario_hombres"), true);
  assert.equal(esEspacio("g", "escalera_1"), true);
  assert.equal(esEspacio("path", "aula_a1"), false, "un path normal es dibujo, no espacio");
  assert.equal(esEspacio("text", "aula_a1"), false);
  assert.equal(esEspacio("rect", ""), false);
  assert.equal(esIdServicio("escalera_1"), true);
  assert.equal(esIdServicio("aula_a1"), false);
});

test("el mismo archivo funciona como script clásico del motor (global MiTecmmEtiquetas)", () => {
  const ruta = createRequire(import.meta.url).resolve("../../src/components/mapa3d/runtime/etiquetas.js");
  const ventana = {};
  vm.runInNewContext(readFileSync(ruta, "utf8"), { self: ventana });
  assert.equal(typeof ventana.MiTecmmEtiquetas?.nombreLegible, "function");
  assert.equal(ventana.MiTecmmEtiquetas.nombreLegible("aula_a3"), "Aula A3");
});
