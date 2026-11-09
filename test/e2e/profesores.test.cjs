// Directorio de profesores (B3), con datos de prueba conocidos: se verifica el CONTENIDO mostrado
// (docentes agrupados, número de clases, materias y horas al expandir), no solo que haya "algo".
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

  /** Tarjetas de resultados: un docente por tarjeta, con sus clases. */
  const tarjetas = (p) =>
    p.evaluate(() => {
      const t = document.body.innerText;
      return {
        total: Number(t.match(/(\d+) DOCENTES/)?.[1] ?? -1),
        clases: (t.match(/(\d+) CLASES/g) || []).map((c) => Number(c.split(" ")[0])),
        uno: (t.match(/DOCENTE DE PRUEBA UNO/g) || []).length,
        dos: (t.match(/DOCENTE DE PRUEBA DOS/g) || []).length,
        discretas: t.includes("MATEMÁTICAS DISCRETAS"),
        redes: t.includes("REDES DE COMPUTADORAS"),
        horario: t.includes("07:00 → 08:40"),
        vacio: t.includes("No se encontraron resultados."),
      };
    });

  const consultaHorarios = (p) => p.consultasSupabase.filter((c) => c.url.includes("/rest/v1/horarios?")).at(-1);

  test("búsqueda por materia: muestra solo el docente que la imparte", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores?q=${encodeURIComponent("matem")}`);
    assert.ok(await e.hay(p, "DOCENTE DE PRUEBA UNO"));
    const r = await tarjetas(p);
    assert.equal(r.total, 1, JSON.stringify(r));
    assert.deepEqual(r.clases, [1], JSON.stringify(r));
    assert.equal(r.dos, 0);
    assert.match(consultaHorarios(p).url, /or=\(materia\.ilike\.%matem%,/);
    // Al expandir la tarjeta aparecen la materia y su horario
    await e.pulsar(p, "DOCENTE DE PRUEBA UNO");
    assert.ok(await e.hay(p, "07:00 → 08:40"));
    const abierta = await tarjetas(p);
    assert.ok(abierta.discretas && abierta.horario, JSON.stringify(abierta));
    assert.equal(abierta.redes, false);
    await p.close();
  });

  test("búsqueda por docente: agrupa sus materias", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores?q=${encodeURIComponent("prueba uno")}`);
    assert.ok(await e.hay(p, "DOCENTE DE PRUEBA UNO"));
    const r = await tarjetas(p);
    assert.equal(r.total, 1, JSON.stringify(r));
    assert.deepEqual(r.clases, [2], JSON.stringify(r));
    assert.equal(r.dos, 0);
    await p.close();
  });

  test("sin búsqueda: lista todo con columnas explícitas", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores`);
    assert.ok(await e.hay(p, "DOCENTE DE PRUEBA DOS"));
    const r = await tarjetas(p);
    assert.equal(r.total, new Set(e.HORARIOS.map((h) => h.docente)).size, JSON.stringify(r));
    const tabla = consultaHorarios(p);
    assert.doesNotMatch(tabla.url, /select=\*/);
    assert.match(tabla.url, /select=.*materia.*profesores/);
    await p.close();
  });

  test("término con sintaxis de filtros: llega limpio a la base y no rompe la página", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/profesores?q=${encodeURIComponent("x),id.gt.(0,docente.eq.y%")}`);
    assert.ok(await e.hay(p, "No se encontraron resultados."));
    const r = await tarjetas(p);
    assert.equal(r.total, 0);
    const or = consultaHorarios(p).url.match(/or=\(([^)]*)\)/)[1].replace(/\+/g, " ");
    // exactamente 4 condiciones ilike con el término limpio, ninguna inyectada
    assert.equal(or.split(",").length, 4, or);
    assert.ok(or.includes("materia.ilike.%x id gt 0 docente eq y%"), or);
    assert.deepEqual(p.consola, [], "el build de producción no imprime en consola");
    await p.close();
  });
});
