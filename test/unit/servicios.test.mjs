// Consultas a Supabase (Bloque 3) y descarga de planos (Bloque 6), con un cliente falso y fetch simulado.
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { llamadas, respuestas, reiniciar } from "../stubs/supabase.mjs";
import { limpiarTerminoBusqueda, obtenerProfesores } from "../../src/services/profesoresService.ts";
import { fetchAvisos } from "../../src/services/avisosService.ts";
import { descargarPlanoSvg, getPlanoEdificioUrl, getMapaGeneralUrl, PlanoError } from "../../src/services/mapasService.ts";

beforeEach(() => reiniciar());

// ------------------------------------------------------------ Profesores

test("limpiarTerminoBusqueda elimina la sintaxis de filtros de PostgREST", () => {
  assert.equal(limpiarTerminoBusqueda("Matemáticas"), "Matemáticas");
  assert.equal(limpiarTerminoBusqueda("  Ana   María  "), "Ana María");
  for (const ataque of ["x,docente.eq.y", "a%", "a*", "x),id.gt.(0", 'x"', "x'or'1'='1", "a.b", "x:y", "a\\b"]) {
    assert.doesNotMatch(limpiarTerminoBusqueda(ataque), /[,.()%*"':\\]/, ataque);
  }
  assert.equal(limpiarTerminoBusqueda("x".repeat(100)).length, 60);
  assert.equal(limpiarTerminoBusqueda(",,,()"), "");
});

test("obtenerProfesores sin búsqueda pide columnas explícitas (nunca select=*)", async () => {
  respuestas.tabla = { data: [{ id: 1, docente: "Ana", materia: "Cálculo", dia: "Lunes", hora_inicio: "07:00", hora_fin: "08:00", aula: "A1" }], error: null };
  const r = await obtenerProfesores("");
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].tabla, "horarios_docentes");
  assert.equal(llamadas[0].select, "id,docente,materia,grupo,dia,hora_inicio,hora_fin,aula");
  assert.equal(r[0].id, "1");
});

test("obtenerProfesores usa la RPC y proyecta solo columnas públicas", async () => {
  respuestas.rpc = { data: [{ id: 7, docente: "Ana", materia: "Redes", dia: "Martes", hora_inicio: "09:00", hora_fin: "10:00", aula: "LR", correo: "privado@x", rfc: "SECRETO" }], error: null };
  const r = await obtenerProfesores("redes");
  assert.deepEqual(llamadas[0], { tipo: "rpc", nombre: "buscar_docentes_v3", args: { search_term: "redes" } });
  assert.deepEqual(Object.keys(r[0]).sort(), ["aula", "dia", "docente", "grupo", "hora_fin", "hora_inicio", "id", "materia"]);
  assert.ok(!JSON.stringify(r).includes("SECRETO"));
});

test("si la RPC falla, el filtro .or() solo recibe el término limpio", async () => {
  await obtenerProfesores("x),id.gt.(0,docente.eq.y");
  const consulta = llamadas.find((l) => l.tipo === "from");
  assert.ok(consulta, "debe usar la consulta de respaldo");
  assert.equal(llamadas.find((l) => l.tipo === "rpc").args.search_term, "x id gt 0 docente eq y");
  // exactamente 4 condiciones ilike, ninguna inyectada
  assert.equal(consulta.or.split(",").length, 4);
  assert.match(consulta.or, /^docente\.ilike\.%x id gt 0 docente eq y%,materia\.ilike\./);
});

test("obtenerProfesores devuelve [] ante un error de la base", async () => {
  respuestas.tabla = { data: null, error: { message: "relation does not exist" } };
  assert.deepEqual(await obtenerProfesores("ana"), []);
});

// ------------------------------------------------------------ Avisos

test("fetchAvisos pide columnas explícitas ordenadas por fecha", async () => {
  respuestas.tabla = { data: [{ id: "1", titulo: "Hola" }], error: null };
  const r = await fetchAvisos();
  assert.equal(llamadas[0].tabla, "avisos");
  assert.doesNotMatch(llamadas[0].select, /\*/);
  assert.deepEqual(llamadas[0].order, ["fecha_publicacion", { ascending: false }]);
  assert.equal(r.length, 1);
  respuestas.tabla = { data: null, error: { message: "x" } };
  assert.deepEqual(await fetchAvisos(), []);
});

// ------------------------------------------------------------ Planos

test("URLs de planos del bucket Maps", () => {
  assert.match(getPlanoEdificioUrl(" A ", "alta"), /\/Maps\/planta_alta_edificio_a\.svg$/);
  assert.match(getMapaGeneralUrl(), /\/Maps\/mapa_general\.svg$/);
});

const SVG_OK = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="aula_a1"/><script>alert(1)</script></svg>';

async function motivo(promesa) {
  try {
    await promesa;
    return "sin error";
  } catch (e) {
    return e instanceof PlanoError ? e.motivo : `otro: ${e?.name}`;
  }
}

function conFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test("descargarPlanoSvg devuelve el plano saneado", () =>
  conFetch(async () => new Response(SVG_OK, { status: 200 }), async () => {
    const svg = await descargarPlanoSvg("https://x/plano.svg");
    assert.match(svg, /aula_a1/);
    assert.doesNotMatch(svg, /script/);
  }));

test("descargarPlanoSvg clasifica cada falla", async () => {
  const casos = [
    [async () => new Response("no", { status: 404 }), "no_existe"],
    [async () => new Response("no", { status: 400 }), "no_existe"],
    [async () => new Response("caído", { status: 503 }), "red"],
    [async () => { throw new TypeError("Failed to fetch"); }, "red"],
    [async () => new Response("<html><body>Error</body></html>", { status: 200 }), "invalido"],
    [async () => new Response('{"error":"x"}', { status: 200 }), "invalido"],
  ];
  for (const [impl, esperado] of casos) {
    await conFetch(impl, async () => assert.equal(await motivo(descargarPlanoSvg("https://x/p.svg")), esperado));
  }
});

/** fetch que nunca responde, salvo para rechazar cuando se aborta su señal. */
const fetchColgado = (_url, { signal }) =>
  new Promise((_, rechazar) => signal.addEventListener("abort", () => rechazar(new DOMException("Aborted", "AbortError"))));

test("descargarPlanoSvg corta a los 15 s con motivo 'tiempo'", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await conFetch(fetchColgado, async () => {
      const p = motivo(descargarPlanoSvg("https://x/p.svg"));
      mock.timers.tick(14999);
      await Promise.resolve();
      mock.timers.tick(1);
      assert.equal(await p, "tiempo");
    });
  } finally {
    mock.timers.reset();
  }
});

test("cancelar (cambio de edificio) no se presenta como error de plano", async () => {
  await conFetch(fetchColgado, async () => {
    const control = new AbortController();
    const p = motivo(descargarPlanoSvg("https://x/p.svg", control.signal));
    control.abort();
    assert.equal(await p, "otro: AbortError");
  });
});
