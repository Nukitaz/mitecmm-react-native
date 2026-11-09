// Motor 3D de Android/iOS (HTML inline de src/vendor/kioskBundle.native.ts) con un puente
// ReactNativeWebView simulado y SIN red, sobre los 12 planos reales:
//  - cada aula del 3D coincide con su posición real en el 2D (dibujada por el navegador)
//  - el canal de Android (document "message") selecciona y limpia sin eco
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const e = require("./entorno.cjs");

const bundle = fs.readFileSync(path.join(e.RAIZ, "src", "vendor", "kioskBundle.native.ts"), "utf8");
const HTML = JSON.parse(bundle.match(/KIOSK_HTML_NATIVE: string \| null = (".*");\r?\n/s)[1]);
const PLANOS = fs.readdirSync(e.DIR_PLANOS).filter((f) => f.startsWith("planta_")).sort();

describe("motor 3D móvil (sin red)", () => {
  let navegador;
  before(async () => { navegador = await e.lanzarNavegador(); });
  after(async () => { await navegador?.close(); });

  /** Abre el motor como lo haría el WebView y lo inicia con un plano. */
  async function iniciarMotor(svg, { selectedId = "", viewport = { width: 500, height: 700 } } = {}) {
    const p = await navegador.newPage();
    await p.setViewport(viewport);
    p.red = [];
    await p.setRequestInterception(true);
    p.on("request", (r) => {
      if (r.url() === "http://webview.local/") return r.respond({ status: 200, contentType: "text/html; charset=utf-8", body: HTML.replace("<body>", '<body class="dark">') });
      if (r.url().startsWith("data:")) return r.continue();
      p.red.push(r.url());
      return r.abort();
    });
    await p.evaluateOnNewDocument(() => {
      window.__msgs = [];
      window.ReactNativeWebView = { postMessage: (m) => window.__msgs.push(JSON.parse(m)) };
    });
    await p.goto("http://webview.local/", { waitUntil: "load" });
    await e.espera(300);
    await p.evaluate((svg, sel) => document.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "INIT", svg, isDark: true, selectedId: sel }) })), svg, selectedId);
    await e.espera(2500);
    return p;
  }

  test("arranca sin ninguna petición de red y responde al puente", async () => {
    const p = await iniciarMotor(fs.readFileSync(path.join(e.DIR_PLANOS, "planta_baja_edificio_a.svg"), "utf8"), { selectedId: "aula_a1" });
    const r = await p.evaluate(() => ({
      cargado: window.__msgs.some((m) => m.type === "KIOSK_LOADED"),
      listo: window.__msgs.find((m) => m.type === "KIOSK_READY"),
      three: THREE.REVISION,
    }));
    assert.equal(r.cargado, true);
    assert.ok(r.listo?.totalRooms > 0);
    assert.equal(r.three, "148");
    assert.equal(await p.evaluate(() => window.__kiosco.seleccion()), "aula_a1");
    assert.deepEqual(p.red, []);
    await p.close();
  });

  for (const archivo of PLANOS) {
    test(`${archivo}: posiciones 3D = 2D y canal SELECT/CLEAR sin eco`, async () => {
      const svg = fs.readFileSync(path.join(e.DIR_PLANOS, archivo), "utf8");
      const p = await iniciarMotor(svg);
      const listo = await p.evaluate(() => window.__msgs.find((m) => m.type === "KIOSK_READY"));
      assert.ok(listo && listo.rooms.length > 0, "el motor construyó la escena");

      const primera = listo.rooms[0].id;
      const canal = await p.evaluate(async (id) => {
        const env = (d) => document.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(d) }));
        env({ type: "SELECT_ROOM", id });
        await new Promise((r) => setTimeout(r, 100));
        const s1 = window.__kiosco.seleccion();
        env({ type: "CLEAR_SELECTION" });
        await new Promise((r) => setTimeout(r, 100));
        return { s1, s2: window.__kiosco.seleccion(), ecos: window.__msgs.filter((m) => m.type === "AULA_CLICK").length };
      }, primera);
      assert.deepEqual(canal, { s1: primera, s2: null, ecos: 0 });
      await p.close();

      // Posición real que dibuja el navegador en 2D (las aulas se miden visibles, como al resaltarlas)
      const q = await navegador.newPage();
      await q.setContent('<html><body style="margin:0"><div id="c" style="width:1100px;height:850px"></div></body></html>');
      const reales = await q.evaluate((svg, ids) => {
        const c = document.getElementById("c");
        c.innerHTML = svg;
        const s = c.querySelector("svg");
        s.setAttribute("width", "100%");
        s.setAttribute("height", "100%");
        const inv = s.getScreenCTM().inverse();
        const out = {};
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) continue;
          el.style.setProperty("display", "inline", "important");
          const r = el.getBoundingClientRect();
          el.style.removeProperty("display");
          const pt = new DOMPoint(r.left + r.width / 2, r.top + r.height / 2).matrixTransform(inv);
          out[id] = { x: pt.x, y: pt.y };
        }
        return out;
      }, svg, listo.rooms.map((r) => r.id));
      await q.close();

      const xs = listo.rooms.map((r) => r.cx), ys = listo.rooms.map((r) => r.cy);
      const tam = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
      let peor = { id: "-", d: 0 };
      for (const r of listo.rooms) {
        const real = reales[r.id];
        if (!real) continue;
        const d = Math.hypot(real.x - r.cx, real.y - r.cy) / tam;
        if (d > peor.d) peor = { id: r.id, d };
      }
      assert.ok(peor.d < 0.01, `desviación máxima ${(peor.d * 100).toFixed(2)}% en ${peor.id}`);
    });
  }
});
