// Directorio de profesores (B3), con datos de prueba conocidos: se verifica el CONTENIDO mostrado
// (nombres, materias, horas), no solo que haya "algo con forma de hora" en pantalla.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const e = require("./entorno.cjs");

describe("profesores", () => {
  let navegador, sitio;
  before(async () => {
    navegador = await e.lanzarNavegador([]);
    sitio = await e.servir();
  });
  after(async () => {
    await navegador?.close();
    await sitio?.cerrar();
  });

  /** Tarjetas de resultados: nombre del docente + materia + horario. */
  const tarjetas = (p) =>
    p.evaluate(() => {
      const t = document.body.innerText;
      return {
        total: Number(t.match(/(\d+) RESULTADOS/)?.[1] ?? -1),
        uno: (t.match(/DOCENTE DE PRUEBA UNO/g) || []).length,
        dos: (t.match(/DOCENTE DE PRUEBA DOS/g) || []).length,
        discretas: t.includes("MATEMÁTICAS DISCRETAS"),
        redes: t.includes("REDES DE COMPUTADORAS"),
        horario: t.includes("07:00 → 08:40"),
        vacio: t.includes("No se encontraron resultados."),
      };
    });

  test("búsqueda por materia: muestra exactamente los registros que coinciden", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores?q=${encodeURIComponent("matem")}`);
    const r = await tarjetas(p);
    assert.equal(r.total, 1, JSON.stringify(r));
    assert.ok(r.uno >= 1 && r.discretas && r.horario, JSON.stringify(r));
    assert.equal(r.redes, false);
    const rpc = p.consultasSupabase.filter((c) => c.url.endsWith("/rest/v1/rpc/buscar_docentes_v3"));
    assert.ok(rpc.length >= 1, "usa la RPC de búsqueda");
    assert.deepEqual(JSON.parse(rpc.at(-1).cuerpo), { search_term: "matem" });
    await p.close();
  });

  test("búsqueda por docente: agrupa sus materias", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores?q=${encodeURIComponent("prueba uno")}`);
    const r = await tarjetas(p);
    assert.equal(r.total, 2, JSON.stringify(r));
    assert.equal(r.dos, 0);
    await p.close();
  });

  test("sin búsqueda: lista todo con columnas explícitas", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores`);
    const r = await tarjetas(p);
    assert.equal(r.total, e.HORARIOS.length, JSON.stringify(r));
    const tabla = p.consultasSupabase.find((c) => c.url.includes("/rest/v1/horarios_docentes"));
    assert.match(tabla.url, /select=id,docente,materia,grupo,dia,hora_inicio,hora_fin,aula/);
    await p.close();
  });

  test("término con sintaxis de filtros: llega limpio a la base y no rompe la página", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores?q=${encodeURIComponent("x),id.gt.(0,docente.eq.y%")}`);
    const r = await tarjetas(p);
    assert.equal(r.total, 0);
    assert.equal(r.vacio, true, "muestra el mensaje de sin resultados");
    const rpc = p.consultasSupabase.filter((c) => c.url.endsWith("/rest/v1/rpc/buscar_docentes_v3")).at(-1);
    assert.doesNotMatch(JSON.parse(rpc.cuerpo).search_term, /[,.()%]/);
    assert.deepEqual(p.consola, [], "el build de producción no imprime en consola");
    await p.close();
  });
});
