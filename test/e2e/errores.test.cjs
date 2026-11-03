// Fallas reales (B6): mensaje claro, reintento y regreso automático al 2D; nunca un loader infinito.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const e = require("./entorno.cjs");

describe("errores y regreso al 2D", () => {
  let navegador, sitio;
  before(async () => {
    navegador = await e.lanzarNavegador();
    sitio = await e.servir();
  });
  after(async () => {
    await navegador?.close();
    await sitio?.cerrar();
  });
  const abrir = (ruta, opciones = {}) => e.abrir(navegador, sitio.base + ruta, { esperarRed: false, espera: 0, ...opciones });

  test("edificio inexistente o con ruta extraña: 'no está disponible', sin reintento inútil", async () => {
    for (const ruta of ["/mapa/zzz", `/mapa/${encodeURIComponent("../../secreto")}`]) {
      const p = await abrir(ruta);
      await e.espera(4000);
      assert.ok(await e.hay(p, "Este plano no está disponible"), ruta);
      assert.equal(await e.hay(p, "Reintentar"), false);
      assert.equal(await e.hay(p, "Cargando plano"), false);
      await p.close();
    }
  });

  test("red caída: mensaje y Reintentar; al volver la red, el 3D carga", async () => {
    let sinRed = true;
    const p = await abrir("/mapa/a?aulaResaltada=A1", { regla: (u) => (sinRed && u.includes("/Maps/planta_") ? "abortar" : undefined) });
    await e.espera(4000);
    assert.ok(await e.hay(p, "No se pudo descargar el plano"));
    assert.ok(await e.hay(p, "Reintentar"));
    assert.deepEqual(p.consola, [], "el build de producción no imprime errores en consola");
    sinRed = false;
    await e.pulsar(p, "Reintentar");
    await e.espera(7000);
    assert.equal(await e.seleccion(p), "aula_a1");
    await p.close();
  });

  test("servidor que no responde: a los 15 s 'tardó demasiado'", async () => {
    const p = await abrir("/mapa/a", { regla: (u) => (u.includes("/Maps/planta_") ? "colgar" : undefined) });
    await e.espera(17500);
    assert.ok(await e.hay(p, "tardó demasiado"));
    await p.close();
  });

  test("respuesta que no es SVG: 'El plano no se pudo leer'", async () => {
    const p = await abrir("/mapa/a", { regla: (u) => (u.includes("/Maps/planta_") ? { body: "<html><body>Error</body></html>" } : undefined) });
    await e.espera(4000);
    assert.ok(await e.hay(p, "El plano no se pudo leer"));
    await p.close();
  });

  test("Three.js no carga: aviso y plano 2D", async () => {
    const p = await abrir("/mapa/a?aulaResaltada=A1", { regla: (u) => (u.includes("/vendor/three.min.js") ? "abortar" : undefined) });
    await e.espera(7000);
    assert.ok(await e.hay(p, "No se pudo cargar el motor 3D"));
    assert.ok((await e.planos2D(p)) > 0);
    await p.close();
  });

  test("el motor nunca responde: a los 20 s vuelve al 2D; '3D Quiosco' reintenta", async () => {
    const p = await abrir("/mapa/a", { regla: (u) => (u.includes("/vendor/kiosk.html") ? "abortar" : undefined) });
    await e.espera(24000);
    assert.ok(await e.hay(p, "La vista 3D tardó demasiado"));
    assert.ok((await e.planos2D(p)) > 0);
    p.regla = undefined;
    await e.pulsar(p, "3D Quiosco");
    await e.espera(6000);
    assert.equal(await e.hay(p, "tardó demasiado"), false);
    assert.equal(await e.kiosco(p).evaluate(() => !!window.__kiosco), true);
    await p.close();
  });

  test("pérdida del contexto WebGL: se recupera, o vuelve al 2D a los 5 s", async () => {
    const p = await abrir("/mapa/a");
    await e.espera(7000);
    const k = e.kiosco(p);
    await k.evaluate(() => {
      window.__ext = document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context");
      window.__ext.loseContext();
    });
    await e.espera(800);
    assert.equal(await k.evaluate(() => document.getElementById("aviso-contexto").hidden), false, "aviso 'Recuperando gráficos'");
    await k.evaluate(() => window.__ext.restoreContext());
    await e.espera(1500);
    assert.equal(await k.evaluate(() => document.getElementById("aviso-contexto").hidden), true);
    assert.equal(await e.hay(p, "Se perdió la aceleración"), false);

    await k.evaluate(() => window.__ext.loseContext());
    await e.espera(7000);
    assert.ok(await e.hay(p, "Se perdió la aceleración gráfica"));
    assert.ok((await e.planos2D(p)) > 0);
    await p.close();
  });

  test("mapa general sin red: Reintentar lo recupera", async () => {
    let sinRed = true;
    const p = await abrir("/mapa", { regla: (u) => (sinRed && u.includes("/Maps/mapa_general.svg") ? "abortar" : undefined) });
    await e.espera(4000);
    assert.ok(await e.hay(p, "No se pudo descargar el plano"));
    sinRed = false;
    await e.pulsar(p, "Reintentar");
    await e.espera(4000);
    assert.ok((await p.evaluate(() => document.querySelectorAll("svg path").length)) > 100);
    await p.close();
  });

  test("navegador sin WebGL: aviso claro y plano 2D con el aula resaltada", async () => {
    const sinGL = await e.lanzarNavegador(["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"]);
    try {
      const p = await e.abrir(sinGL, `${sitio.base}/mapa/a?aulaResaltada=A1`, { esperarRed: false, espera: 7000 });
      assert.ok(await e.hay(p, "no admite gráficos 3D"));
      assert.ok((await e.planos2D(p)) > 0);
    } finally {
      await sinGL.close();
    }
  });
});
