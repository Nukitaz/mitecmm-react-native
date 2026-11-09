// Marquesina de avisos: con "reducir movimiento" no debe animarse.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const e = require("./entorno.cjs");

const TITULO = "Aviso de prueba <img src=x onerror=top.__pwned=1>";

/** Estado de la marquesina: si hay pista animada y cuántas veces aparece el aviso. */
const marquesina = (p, titulo) =>
  p.evaluate((titulo) => {
    const pista = document.querySelector(".marquee-track-web");
    const animacion = pista ? getComputedStyle(pista).animationName : null;
    const copias = [...document.querySelectorAll("div")].filter(
      (d) => d.childElementCount === 0 && d.textContent === titulo
    ).length;
    return { pista: !!pista, animacion, copias };
  }, titulo);

describe("avisos", () => {
  let navegador, sitio;
  before(async () => {
    navegador = await e.lanzarNavegador([]);
    sitio = await e.servir();
  });
  after(async () => {
    await navegador?.close();
    await sitio?.cerrar();
  });

  test("sin preferencia: la marquesina se anima", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/`);
    assert.ok(await e.hay(p, TITULO));
    const m = await marquesina(p, TITULO);
    assert.equal(m.pista, true);
    assert.equal(m.animacion, "marqueeLoopWeb");
    assert.ok(m.copias >= 2, "la marquesina duplica los avisos para el bucle");
    await p.close();
  });

  test("con reducir movimiento: fila fija sin animación y una sola copia", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/`, { reducido: true });
    assert.ok(await e.hay(p, TITULO));
    const m = await marquesina(p, TITULO);
    assert.equal(m.pista, false, "no se dibuja la pista animada");
    assert.equal(m.copias, 1, "el aviso aparece una sola vez");
    await p.close();
  });

  test("si el ajuste cambia con la app abierta, la marquesina se detiene", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/`);
    assert.ok(await e.hay(p, TITULO));
    assert.equal((await marquesina(p, TITULO)).pista, true);
    await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await p.waitForFunction(() => !document.querySelector(".marquee-track-web"), { timeout: 5000 });
    await p.close();
  });
});
