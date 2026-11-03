// Seguridad en el navegador: enlaces maliciosos (B1), SVG malicioso y aislamiento del iframe (B2),
// cabeceras/CSP y ausencia de CDN (B4), avisos de la base mostrados como texto.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const e = require("./entorno.cjs");

const VENENO =
  '<script>top.__pwned="script"</script>' +
  '<image href="x" onerror="top.__pwned=\'onerror\'" width="1" height="1"/>' +
  '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="top.__pwned=\'fobj\'"/></div></foreignObject>' +
  '<a href="javascript:top.__pwned=\'link\'"><text>x</text></a>';
const leer = (f) => fs.readFileSync(path.join(e.DIR_PLANOS, f), "utf8");
const BAJA_ENVENENADA = leer("planta_baja_edificio_a.svg")
  .replace(/(<svg[^>]*?)>/, "$1 onload=\"top.__pwned='svgonload'\">")
  .replace("</svg>", VENENO + "</svg>")
  .replace(/id="aula_a2"/, "id=\"aula_a2\" onclick=\"top.__pwned='onclick'\"");
const GENERAL_ENVENENADO = leer("mapa_general.svg").replace("</svg>", VENENO + "</svg>");
const planosEnvenenados = (url) => {
  if (url.includes("/Maps/planta_baja_edificio_a.svg")) return { body: BAJA_ENVENENADA, contentType: "image/svg+xml" };
  if (url.includes("/Maps/mapa_general.svg")) return { body: GENERAL_ENVENENADO, contentType: "image/svg+xml" };
  return undefined;
};

describe("seguridad", () => {
  let navegador, sitio;
  before(async () => {
    navegador = await e.lanzarNavegador();
    sitio = await e.servir();
  });
  after(async () => {
    await navegador?.close();
    await sitio?.cerrar();
  });

  // ------------------------------------------------------------ B1: parámetros de URL maliciosos
  const ATAQUES = [
    ["3D", '";top.__pwned=1;//'],
    ["3D", "</script><img src=x onerror=top.__pwned=1>"],
    ["2D", '|x"/><img src=x onerror=top.__pwned=1>'],
    ["2D", "</script><svg onload=top.__pwned=1>"],
  ];
  for (const [vista, aula] of ATAQUES) {
    test(`B1 ${vista}: aulaResaltada=${aula} no ejecuta código`, async () => {
      const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=${encodeURIComponent(aula)}`, { espera: 1000 });
      if (vista === "2D") await e.pulsar(p, "2D Plano");
      await e.espera(4000);
      assert.equal(await e.pwned(p), null);
      assert.equal(p.dialogo, false);
      await p.close();
    });
  }

  test("B1: un aula normal sigue resaltando en 3D y en 2D", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { espera: 5000 });
    assert.equal(await e.seleccion(p), "aula_a1");
    await e.pulsar(p, "2D Plano");
    await e.espera(1000);
    assert.ok((await p.evaluate(() => document.querySelectorAll(".resaltado-activo").length)) >= 1);
    await p.close();
  });

  // ------------------------------------------------------------ B2: SVG malicioso desde "Supabase"
  test("B2 3D: plano malicioso no ejecuta código y el iframe está aislado", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { regla: planosEnvenenados, espera: 6000 });
    const marco = await e.kiosco(p).evaluate(() => {
      let accesoPadre;
      try { accesoPadre = !!parent.document.body; } catch (_) { accesoPadre = false; }
      return { canvas: !!document.querySelector("canvas"), accesoPadre };
    });
    assert.equal(marco.canvas, true, "el 3D se construye con el plano saneado");
    assert.equal(marco.accesoPadre, false, "sandbox: el iframe no alcanza el DOM de la app");
    assert.equal(await e.pwned(p), null);
    assert.equal(p.dialogo, false);

    // Un clic real en un aula sigue llegando a la app
    await e.clicEnAula(p, "aula_a5");
    await e.espera(1500);
    assert.equal(await e.banner(p), "Aula A5");

    // Un mensaje falso enviado desde la propia ventana (no desde el iframe) se ignora
    await p.evaluate(() => window.postMessage(JSON.stringify({ type: "AULA_CLICK", id: "aula_falsa" }), "*"));
    await e.espera(800);
    assert.equal(await e.banner(p), "Aula A5");
    await p.close();
  });

  test("B2 2D y mapa general: plano malicioso no ejecuta código", async () => {
    let p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { regla: planosEnvenenados, espera: 1000 });
    await e.pulsar(p, "2D Plano");
    await e.espera(2000);
    await p.evaluate(() => document.getElementById("aula_a2")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await e.espera(500);
    assert.ok((await e.planos2D(p)) > 0);
    assert.equal(await e.pwned(p), null);
    assert.equal(p.dialogo, false);
    await p.close();

    p = await e.abrir(navegador, `${sitio.base}/mapa`, { regla: planosEnvenenados });
    assert.ok((await p.evaluate(() => document.querySelectorAll("svg path").length)) > 100);
    assert.equal(await e.pwned(p), null);
    await p.close();
  });

  // ------------------------------------------------------------ B4: cabeceras, CSP y sin CDN
  test("B4: cabeceras de seguridad de vercel.json", async () => {
    const app = await e.cabecerasDe(`${sitio.base}/mapa/a`);
    const motor = await e.cabecerasDe(`${sitio.base}/vendor/kiosk.html`);
    assert.match(app["content-security-policy"], /frame-ancestors 'none'/);
    assert.match(app["content-security-policy"], /script-src 'self'(;|$)/, "sin 'unsafe-inline' ni CDN en scripts");
    assert.equal(app["x-frame-options"], "DENY");
    assert.match(motor["content-security-policy"], /frame-ancestors 'self'/);
    assert.match(motor["content-security-policy"], /default-src 'none'/);
    assert.equal(motor["x-frame-options"], "SAMEORIGIN");
    for (const h of [app, motor]) {
      assert.equal(h["x-content-type-options"], "nosniff");
      assert.ok(h["referrer-policy"]);
      assert.match(h["permissions-policy"], /camera=\(\)/);
    }
  });

  test("B4: todo funciona con la CSP, sin violaciones y sin CDN", async () => {
    const paginas = [];
    let p = await e.abrir(navegador, `${sitio.base}/mapa/a?aulaResaltada=A1`, { espera: 6000 });
    paginas.push(p);
    const motor = await e.kiosco(p).evaluate(() => ({ ruta: location.pathname, three: THREE.REVISION, canvas: !!document.querySelector("canvas") }));
    assert.deepEqual(motor, { ruta: "/vendor/kiosk.html", three: "148", canvas: true });
    await e.pulsar(p, "PA");
    await e.espera(5000);
    assert.equal(await e.kiosco(p).evaluate(() => !!document.querySelector("canvas")), true, "planta alta reconstruye la escena");

    p = await e.abrir(navegador, `${sitio.base}/mapa`);
    paginas.push(p);
    p = await e.abrir(navegador, `${sitio.base}/profesores?q=redes`);
    paginas.push(p);
    p = await e.abrir(navegador, `${sitio.base}/`);
    paginas.push(p);

    for (const pg of paginas) {
      assert.deepEqual(pg.violacionesCsp, [], pg.url());
      assert.deepEqual(pg.externos, [], `peticiones externas fuera de Supabase en ${pg.url()}`);
      await pg.close();
    }
  });

  test("B4 GitHub Pages: sin cabeceras HTTP, la CSP por <meta> no rompe nada", async () => {
    const gh = await e.servir({ conCabeceras: false });
    try {
      const html = await (await fetch(`${gh.base}/`)).text();
      assert.match(html, /http-equiv="Content-Security-Policy"/);
      const p = await e.abrir(navegador, `${gh.base}/mapa/a?aulaResaltada=A1`, { espera: 6000 });
      assert.equal(await e.seleccion(p), "aula_a1");
      assert.deepEqual(p.violacionesCsp, []);
      await p.close();
    } finally {
      await gh.cerrar();
    }
  });

  // ------------------------------------------------------------ B3: datos de la base
  test("B3: avisos con HTML se muestran como texto, sin sesión guardada", async () => {
    const p = await e.abrir(navegador, `${sitio.base}/`);
    assert.ok(await e.hay(p, "Aviso de prueba <img src=x onerror=top.__pwned=1>"), "el título se pinta literal");
    assert.equal(await e.pwned(p), null);
    const avisos = p.consultasSupabase.find((c) => c.url.includes("/rest/v1/avisos"));
    assert.ok(avisos, "se consultan los avisos");
    assert.match(avisos.url, /select=id,titulo,/);
    assert.ok(!p.consultasSupabase.some((c) => /select=\*/.test(c.url)), "ninguna consulta usa select=*");
    const sesiones = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sb-")));
    assert.deepEqual(sesiones, []);
    await p.close();
  });
});
