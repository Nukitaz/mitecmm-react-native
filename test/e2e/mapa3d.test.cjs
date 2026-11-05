// Mapa 3D en la app web: sincronización con la app (B5), controles, teclado, quiosco,
// "Usted está aquí", plantas apiladas, movimiento reducido y lista accesible (B9).
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const e = require("./entorno.cjs");

const SINTETICOS = path.join(e.RAIZ, "test", "fixtures");
const planosConContorno = (url) => {
  if (url.includes("/Maps/planta_baja_edificio_a.svg")) return { contentType: "image/svg+xml", body: fs.readFileSync(path.join(SINTETICOS, "sintetico_baja_contorno.svg"), "utf8") };
  if (url.includes("/Maps/planta_alta_edificio_a.svg")) return { contentType: "image/svg+xml", body: fs.readFileSync(path.join(SINTETICOS, "sintetico_alta_contorno.svg"), "utf8") };
  return undefined;
};
// Planos reales SIN el rectángulo contorno_edificio (para probar que entonces no se ofrece apilar).
const planosSinContorno = (url) => {
  const m = url.match(/\/Maps\/(planta_[a-z_]+\.svg)$/);
  if (!m) return undefined;
  const svg = fs.readFileSync(path.join(SINTETICOS, "planos", m[1]), "utf8");
  return { contentType: "image/svg+xml", body: svg.replace(/<rect id="contorno_edificio"[^>]*\/>/, "") };
};
const enfocarLienzo = (p) => e.kiosco(p).evaluate(() => document.getElementById("canvas-container").focus());

describe("mapa 3D", () => {
  let navegador, sitio;
  before(async () => {
    navegador = await e.lanzarNavegador();
    sitio = await e.servir();
  });
  after(async () => {
    await navegador?.close();
    await sitio?.cerrar();
  });

  // ------------------------------------------------------------ B5
  test("B5: clic en el 3D, 'quitar' y selección sin recargar ni ciclos de mensajes", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, {
      espera: 5000,
      antesDeCargar: () => {
        window.__ecos = 0;
        window.addEventListener("message", (ev) => { try { if (JSON.parse(ev.data).type === "AULA_CLICK") window.__ecos++; } catch (_) {} });
      },
    });
    assert.equal(await e.seleccion(p), "aula_a1");
    await e.kiosco(p).evaluate(() => { window.__marca = "sin-recargar"; });

    await e.clicEnAula(p, "aula_a5");
    await e.espera(2500);
    assert.equal(await e.seleccion(p), "aula_a5");
    assert.equal(await e.banner(p), "Aula A5");
    assert.equal(await e.kiosco(p).evaluate(() => window.__marca), "sin-recargar");
    assert.equal(await p.evaluate(() => window.__ecos), 1, "un clic produce exactamente un AULA_CLICK");

    await e.pulsar(p, "quitar");
    await e.espera(1200);
    assert.equal(await e.seleccion(p), null);
    assert.equal(await e.banner(p), null);
    assert.equal(await e.kiosco(p).evaluate(() => window.__marca), "sin-recargar");
    await p.close();
  });

  test("B5: el clic acierta el aula tras redimensionar (rotar el celular)", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a`, { espera: 5000 });
    for (const [w, h] of [[900, 700], [600, 900], [1400, 760]]) {
      await p.setViewport({ width: w, height: h });
      await e.espera(1500);
      await e.clicEnAula(p, "aula_a3");
      await e.espera(800);
      assert.equal(await e.seleccion(p), "aula_a3", `${w}x${h}`);
      assert.equal(await e.banner(p), "Aula A3", `${w}x${h}`);
      await e.pulsar(p, "quitar");
      await e.espera(600);
    }
    await p.close();
  });

  test("B5: búsqueda exacta o por prefijo único con frontera '_'", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/l`, { espera: 1000 });
    await e.pulsar(p, "PA");
    await e.espera(5000);
    const enviar = (m) => p.evaluate((m) => document.querySelector("iframe").contentWindow.postMessage(JSON.stringify(m), "*"), m);
    await enviar({ type: "SELECT_ROOM", id: "laboratorio_de_redes" });
    await e.espera(600);
    assert.equal(await e.seleccion(p), "laboratorio_de_redes_lr");
    await enviar({ type: "CLEAR_SELECTION" });
    await enviar({ type: "SELECT_ROOM", id: "laboratorio" });
    await e.espera(600);
    assert.equal(await e.seleccion(p), null, "un prefijo ambiguo no elige al azar");
    await p.close();
  });

  // ------------------------------------------------------------ B9
  test("B9: botones de cámara y teclado", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { regla: planosSinContorno, espera: 5000, viewport: { width: 1200, height: 900 } });
    assert.equal(await p.evaluate(() => document.querySelector("iframe").title), "Mapa 3D del Edificio A");
    assert.match(await e.kiosco(p).evaluate(() => document.getElementById("canvas-container").getAttribute("aria-label")), /Flechas/);

    const r0 = (await e.info3D(p)).radio;
    await e.clicEnKiosco(p, "btn-acercar");
    const r1 = (await e.info3D(p)).radio;
    await e.clicEnKiosco(p, "btn-alejar");
    await e.clicEnKiosco(p, "btn-alejar");
    const r2 = (await e.info3D(p)).radio;
    assert.ok(r1 < r0 && r2 > r1, `zoom ${r0} -> ${r1} -> ${r2}`);
    assert.equal(await e.seleccion(p), "aula_a1", "pulsar un botón no selecciona el aula de detrás");
    assert.equal(await e.kiosco(p).evaluate(() => document.getElementById("btn-plantas").hidden), true, "sin contorno_edificio no se ofrece apilar");

    await enfocarLienzo(p);
    const o0 = (await e.info3D(p)).objetivo;
    await p.keyboard.press("ArrowRight");
    await p.keyboard.press("ArrowUp");
    const o1 = (await e.info3D(p)).objetivo;
    assert.ok(o1[0] !== o0[0] || o1[1] !== o0[1], "las flechas mueven la cámara");
    await p.keyboard.press("+");
    assert.ok((await e.info3D(p)).radio < r2, "la tecla + acerca");

    await e.clicEnKiosco(p, "btn-inicio");
    await e.espera(2500);
    const ini = await e.info3D(p);
    assert.equal(ini.radio, 170);
    assert.ok(Math.abs(ini.objetivo[0]) < 0.5 && Math.abs(ini.objetivo[1]) < 0.5);

    await enfocarLienzo(p);
    await p.keyboard.press("Escape");
    await e.espera(800);
    assert.equal(await e.seleccion(p), null);
    assert.equal(await e.banner(p), null, "la app se entera de que Escape quitó el resaltado");
    await p.close();
  });

  test("B9: lista accesible de espacios (3D y 2D)", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a`, { espera: 5000 });
    const botones = () => p.evaluate(() => [...document.querySelectorAll("[role=button]")].map((d) => d.textContent));
    const pulsarRol = (t) => p.evaluate((t) => [...document.querySelectorAll("[role=button]")].find((d) => d.textContent === t)?.click(), t);
    await p.evaluate(() => [...document.querySelectorAll("[role=button]")].find((d) => /Lista de espacios/.test(d.textContent))?.click());
    await e.espera(500);
    const chips = (await botones()).filter((t) => /^(Aula|Taller|Psicolog|Sala)/.test(t));
    assert.ok(chips.length >= 10, chips.join(", "));
    assert.ok(chips.indexOf("Aula A2") < chips.indexOf("Aula A3"));

    await e.kiosco(p).evaluate(() => { window.__marca = 1; });
    await pulsarRol("Aula A5");
    await e.espera(1500);
    assert.equal(await e.seleccion(p), "aula_a5");
    assert.equal(await e.banner(p), "Aula A5");
    assert.equal(await e.kiosco(p).evaluate(() => window.__marca), 1, "sin recargar el 3D");
    const aria = await p.evaluate(() => [...document.querySelectorAll("[role=button]")].find((d) => d.textContent === "Aula A5")?.getAttribute("aria-selected"));
    assert.equal(aria, "true");

    await e.pulsar(p, "2D Plano");
    await e.espera(800);
    await pulsarRol("Aula A2");
    await e.espera(800);
    assert.equal(await p.evaluate(() => document.getElementById("aula_a2")?.classList.contains("resaltado-activo")), true);
    await p.close();
  });

  test("B9: 'Usted está aquí' (válido, inválido e inexistente)", async () => {
    let p = await e.abrir(navegador, `${sitio.base}/mapa/a?kiosco=1&aqui=aula_a5`, { espera: 5000 });
    assert.equal((await e.info3D(p)).aqui, true);
    await p.close();
    p = await e.abrir(navegador, `${sitio.base}/mapa/a?kiosco=1&aqui=${encodeURIComponent('../x"<b>')}`, { espera: 5000 });
    assert.equal((await e.info3D(p)).aqui, false);
    await p.close();
    p = await e.abrir(navegador, `${sitio.base}/mapa/a?kiosco=1&aqui=no_existe`, { espera: 5000 });
    assert.equal((await e.info3D(p)).aqui, false);
    await p.close();
  });

  test("B9: modo quiosco vuelve a la vista inicial tras la inactividad (y la actividad reinicia el contador)", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?kiosco=1&inactividad=15&aulaResaltada=A1`, { espera: 5000 });
    await e.clicEnKiosco(p, "btn-acercar");
    await e.espera(9000);
    await enfocarLienzo(p);
    await p.keyboard.press("ArrowLeft");
    await e.espera(9000);
    assert.equal(await e.seleccion(p), "aula_a1", "a los 18 s (con actividad a los 9 s) sigue resaltada");
    await e.espera(8000);
    assert.equal(await e.seleccion(p), null);
    assert.equal(await e.banner(p), null);
    assert.equal((await e.info3D(p)).radio, 170);
    await p.close();
  });

  test("B9: fuera del modo quiosco no hay reinicio por inactividad", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { espera: 5000 });
    await e.espera(17000);
    assert.equal(await e.seleccion(p), "aula_a1");
    await p.close();
  });

  test("B9: plantas apiladas alineadas con contorno_edificio", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a`, { regla: planosConContorno, espera: 5000 });
    assert.equal(await e.kiosco(p).evaluate(() => document.getElementById("btn-plantas").hidden), false);
    await e.clicEnKiosco(p, "btn-plantas");
    assert.equal((await e.info3D(p)).plantasApiladasVisibles, true);
    assert.equal(await e.kiosco(p).evaluate(() => document.getElementById("btn-plantas").getAttribute("aria-pressed")), "true");
    const pos = await e.kiosco(p).evaluate(() => window.__kiosco.posiciones());
    assert.ok(pos.fantasma?.length > 0);
    for (const g of pos.fantasma) {
      assert.ok(pos.aulas.some((a) => Math.hypot(a[0] - g[0], a[1] - g[1]) < 0.3), `planta alta desalineada en ${g}`);
    }
    await p.close();
  });

  // Bloque 13: los 12 planos reales traen contorno_edificio (alineado por los muros de ambas plantas).
  for (const ed of ["a", "b", "em", "i", "l", "p"]) {
    test(`B13: edificio ${ed.toUpperCase()}: planos reales con contorno, la otra planta cae dentro del edificio`, async () => {
      const p = await e.abrir(navegador, `${sitio.base}/mapa/${ed}`, { espera: 5000 });
      assert.equal(await e.kiosco(p).evaluate(() => document.getElementById("btn-plantas").hidden), false, "se ofrece apilar");
      await e.clicEnKiosco(p, "btn-plantas");
      assert.equal((await e.info3D(p)).plantasApiladasVisibles, true);
      const pos = await e.kiosco(p).evaluate(() => window.__kiosco.posiciones());
      assert.ok(pos.fantasma?.length > 0 && pos.aulas.length > 0);
      // La otra planta cae dentro del contorno del edificio y lo ocupa en buena parte
      // (una planta corrida o encogida falla aquí).
      const [x0, z0, x1, z1] = pos.contorno;
      const tol = 2;
      for (const g of pos.fantasma) {
        assert.ok(g[0] >= x0 - tol && g[0] <= x1 + tol && g[1] >= z0 - tol && g[1] <= z1 + tol, `fuera del contorno ${pos.contorno}: ${g}`);
      }
      const gx = pos.fantasma.map((g) => g[0]), gz = pos.fantasma.map((g) => g[1]);
      assert.ok((Math.max(...gx) - Math.min(...gx)) > 0.5 * (x1 - x0), "la otra planta ocupa al menos la mitad del ancho");
      // En EM la planta alta solo tiene espacios en una franja: el mínimo de fondo es bajo a propósito.
      assert.ok((Math.max(...gz) - Math.min(...gz)) > 0.15 * (z1 - z0), "la otra planta ocupa al menos el 15 % del fondo");
      await p.close();
    });
  }

  // Bloque 14: escaleras y baños en ambas plantas; vista apilada sólida, de lado.
  for (const ed of ["a", "b", "em", "i", "l", "p"]) {
    test(`B14: edificio ${ed.toUpperCase()}: escaleras y baños en ambas plantas`, async () => {
      const p = await e.abrir(navegador, `${sitio.base}/mapa/${ed}`, { espera: 5000 });
      const activa = await e.kiosco(p).evaluate(() => window.__kiosco.aulas());
      assert.ok(activa.some((id) => id.startsWith("escalera_")), "la planta activa tiene escalera");
      assert.ok(activa.some((id) => id.startsWith("sanitario_")), "la planta activa tiene baño");
      const pos = await e.kiosco(p).evaluate(() => window.__kiosco.posiciones());
      assert.ok(pos.fantasmaIds.some((id) => id.startsWith("escalera_")), "la otra planta tiene escalera");
      assert.ok(pos.fantasmaIds.some((id) => id.startsWith("sanitario_")), "la otra planta tiene baño");
      await p.close();
    });
  }

  test("B14: la vista apilada separa las plantas, gira la cámara de lado y la restaura", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a`, { espera: 5000 });
    const antes = await e.info3D(p);
    await e.clicEnKiosco(p, "btn-plantas");
    const apilada = await e.info3D(p);
    assert.equal(apilada.plantasApiladasVisibles, true);
    assert.ok(apilada.radio > antes.radio, "la cámara se aleja para encuadrar ambas plantas");
    // Desde planta baja, la otra (alta) queda arriba y bien separada.
    assert.ok((await e.kiosco(p).evaluate(() => window.__kiosco.posiciones())).nivelOtraPlanta >= 30);
    await e.clicEnKiosco(p, "btn-plantas");
    const despues = await e.info3D(p);
    assert.equal(despues.plantasApiladasVisibles, false);
    assert.equal(despues.radio, antes.radio, "al ocultarla vuelve la vista anterior");

    // Desde planta alta, la otra planta queda abajo.
    await e.pulsar(p, "PA");
    await e.espera(5000);
    assert.ok((await e.kiosco(p).evaluate(() => window.__kiosco.posiciones())).nivelOtraPlanta <= -30);
    await p.close();
  });

  // Bloque 15: escaleras y baños con forma propia (su caja es invisible pero se puede tocar).
  test("B15: tocar un baño o la escalera (forma propia) los selecciona", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a`, { espera: 5000, viewport: { width: 1200, height: 900 } });
    for (const id of ["sanitario_hombres", "escalera_1"]) {
      await e.clicEnAula(p, id);
      await e.espera(1500);
      assert.equal(await e.seleccion(p), id);
      await e.pulsar(p, "quitar");
      await e.espera(600);
    }
    await p.close();
  });

  test("B16: al seleccionar escalera o baño se pinta su forma, sin cubo naranja encima", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/l`, { espera: 5000, viewport: { width: 1200, height: 900 } });
    const ids = (await e.kiosco(p).evaluate(() => window.__kiosco.aulas()))
      .filter((id) => id.startsWith("escalera_") || id.startsWith("sanitario_"));
    assert.ok(ids.length >= 2, "el edificio L tiene escalera y baño");
    const aspecto = (id) => e.kiosco(p).evaluate((i) => window.__kiosco.aspecto(i), id);
    for (const id of ids) {
      await e.clicEnAula(p, id);
      await e.espera(1200);
      assert.equal(await e.seleccion(p), id);
      const sel = await aspecto(id);
      assert.equal(sel.cajaVisible, false, `${id}: la caja sigue invisible al seleccionarla`);
      assert.ok(sel.resaltadas > 0, `${id}: su forma propia se resalta`);
      await e.pulsar(p, "quitar");
      await e.espera(600);
      const libre = await aspecto(id);
      assert.equal(libre.resaltadas, 0, `${id}: al quitar la selección recupera sus colores`);
    }
    await p.close();
  });

  test("B9: con 'reducir movimiento' no hay animación continua", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { reducido: true, espera: 5000 });
    const a = await e.info3D(p);
    await e.espera(2000);
    const b = await e.info3D(p);
    assert.equal(a.movimientoReducido, true);
    assert.equal(b.cuadros, a.cuadros);
    await p.close();
  });

  test("B7: en reposo el motor no dibuja cuadros", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a`, { espera: 6000 });
    const a = await e.info3D(p);
    await e.espera(2000);
    const b = await e.info3D(p);
    assert.equal(b.cuadros, a.cuadros, `cuadros ${a.cuadros} -> ${b.cuadros}`);
    await p.close();
  });
});
