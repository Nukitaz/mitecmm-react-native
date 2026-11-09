/**
 * Entorno de las pruebas de navegador (Chrome sin ventana + puppeteer-core).
 *
 * - Sirve el build web (test/.dist) emulando Vercel: rewrite SPA + cabeceras de vercel.json.
 * - Supabase es FALSO: el build usa https://pruebas-mitecmm.supabase.co y cada petición a
 *   *.supabase.co se responde aquí (planos desde test/fixtures/planos, tablas con datos de prueba).
 *   Ninguna prueba toca la base real.
 * - Cualquier otro host externo se bloquea y se registra (no debe haber CDN).
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const RAIZ = path.join(__dirname, "..", "..");
const DIST = process.env.E2E_DIST || path.join(RAIZ, "test", ".dist");
const DIR_PLANOS = path.join(RAIZ, "test", "fixtures", "planos");
const VERCEL = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));
const ARGS_GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ Chrome

function buscarChrome() {
  const candidatos = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const encontrado = candidatos.find((c) => fs.existsSync(c));
  if (!encontrado) throw new Error("No se encontró Chrome. Define CHROME_PATH con la ruta del ejecutable.");
  return encontrado;
}

function lanzarNavegador(args = ARGS_GL) {
  return puppeteer.launch({ executablePath: buscarChrome(), headless: true, args });
}

// ------------------------------------------------------------------ Servidor (emula Vercel)

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".ico": "image/x-icon", ".png": "image/png", ".ttf": "font/ttf", ".svg": "image/svg+xml",
};

/** Sirve DIST. Con { conCabeceras: false } emula GitHub Pages (sin cabeceras HTTP, CSP solo por <meta>). */
function servir({ conCabeceras = true } = {}) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error(`No existe ${DIST}/index.html. Ejecuta "npm run test:e2e" (compila el sitio antes de probar).`);
  }
  const raizDist = path.resolve(DIST);
  const servidor = http.createServer((req, res) => {
    const ruta = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
    let archivo = path.resolve(path.join(raizDist, ruta));
    if (!archivo.startsWith(raizDist) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      archivo = path.join(raizDist, "index.html");
    }
    const cabeceras = { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" };
    if (conCabeceras) {
      for (const regla of VERCEL.headers) {
        if (new RegExp(`^${regla.source}$`).test(ruta)) for (const h of regla.headers) cabeceras[h.key] = h.value;
      }
    }
    res.writeHead(200, cabeceras);
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise((ok) =>
    servidor.listen(0, "127.0.0.1", () => {
      const base = `http://localhost:${servidor.address().port}`;
      ok({ base, cerrar: () => new Promise((r) => servidor.close(r)) });
    })
  );
}

function cabecerasDe(url) {
  return new Promise((ok, mal) => http.get(url, (r) => { r.resume(); ok(r.headers); }).on("error", mal));
}

// ------------------------------------------------------------------ Supabase falso

// Con 3 o más avisos la marquesina se anima (con menos se muestran fijos).
const AVISOS = [
  { id: "1", categoria: "Urgente", titulo: "Aviso de prueba <img src=x onerror=top.__pwned=1>", descripcion: "Contenido", fecha: "2026-11-01", created_at: "2026-11-01T10:00:00Z" },
  { id: "2", categoria: "General", titulo: "Segundo aviso", descripcion: "Contenido", fecha: "2026-10-31", created_at: "2026-10-31T10:00:00Z" },
  { id: "3", categoria: "General", titulo: "Tercer aviso", descripcion: "Contenido", fecha: "2026-10-30", created_at: "2026-10-30T10:00:00Z" },
];

const HORARIOS = [
  { id: 101, docente: "DOCENTE DE PRUEBA UNO", materia: "MATEMÁTICAS DISCRETAS", grupo: "3A", dia: "Lunes", hora_inicio: "07:00", hora_fin: "08:40", aula: "A1" },
  { id: 102, docente: "DOCENTE DE PRUEBA UNO", materia: "CÁLCULO INTEGRAL", grupo: "2B", dia: "Martes", hora_inicio: "09:00", hora_fin: "10:40", aula: "A5" },
  { id: 103, docente: "DOCENTE DE PRUEBA DOS", materia: "REDES DE COMPUTADORAS", grupo: "5A", dia: "Miércoles", hora_inicio: "11:00", hora_fin: "12:40", aula: "LR" },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

/** Respuesta del Supabase falso para una petición, o null si no corresponde. */
function respuestaSupabase(peticion) {
  const url = new URL(peticion.url());
  if (peticion.method() === "OPTIONS") return { status: 204, headers: CORS, body: "" };
  const json = (datos, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(datos) });

  const plano = url.pathname.match(/^\/storage\/v1\/object\/public\/Maps\/([a-z0-9_]+\.svg)$/);
  if (plano) {
    const archivo = path.join(DIR_PLANOS, plano[1]);
    if (!fs.existsSync(archivo)) return json({ statusCode: "404", error: "not_found", message: "Object not found" }, 400);
    return { status: 200, headers: CORS, contentType: "image/svg+xml", body: fs.readFileSync(archivo, "utf8") };
  }
  if (url.pathname === "/rest/v1/avisos") return json(AVISOS);
  if (url.pathname === "/rest/v1/carreras") return json([{ nombre: "INGENIERÍA EN SISTEMAS" }]);
  if (url.pathname === "/rest/v1/horarios") {
    // Respuesta anidada como la de PostgREST: horarios -> profesores -> carreras
    const anidar = (h) => ({
      id: h.id, materia: h.materia, grupo: h.grupo, dia: h.dia, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin, aula: h.aula,
      profesores: { nombre: h.docente, carreras: { nombre: "INGENIERÍA EN SISTEMAS" } },
    });
    const or = url.searchParams.get("or");
    if (!or) return json(HORARIOS.map(anidar));
    const t = (or.match(/ilike\.%([^%]*)%/)?.[1] || "").toUpperCase();
    return json(HORARIOS.filter((h) => [h.docente, h.materia, h.aula, h.grupo].some((c) => c.toUpperCase().includes(t))).map(anidar));
  }
  return json({ message: "ruta no simulada" }, 404);
}

/**
 * Abre una página con el Supabase falso.
 * opciones.regla(url, peticion) -> "abortar" | "colgar" | { status, body, contentType } | undefined (normal)
 */
async function abrir(navegador, url, opciones = {}) {
  const pagina = await navegador.newPage();
  await pagina.setViewport(opciones.viewport || { width: 1200, height: 800 });
  if (opciones.reducido) await pagina.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  if (opciones.antesDeCargar) await pagina.evaluateOnNewDocument(opciones.antesDeCargar);

  pagina.regla = opciones.regla;
  pagina.externos = [];
  pagina.consultasSupabase = [];
  pagina.violacionesCsp = [];
  pagina.consola = [];
  pagina.dialogo = false;

  pagina.on("dialog", (d) => { pagina.dialogo = true; d.dismiss().catch(() => {}); });
  pagina.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) pagina.violacionesCsp.push(t.slice(0, 200));
    if (["error", "warn", "warning", "log"].includes(m.type()) && !/Failed to load resource|net::ERR/.test(t)) pagina.consola.push(t.slice(0, 160));
  });

  await pagina.setRequestInterception(true);
  pagina.on("request", (r) => {
    const u = new URL(r.url());
    const decision = pagina.regla && pagina.regla(r.url(), r);
    if (decision === "abortar") return r.abort("internetdisconnected");
    if (decision === "colgar") return undefined; // nunca responde
    if (decision && typeof decision === "object") {
      return r.respond({ status: decision.status || 200, contentType: decision.contentType || "text/html", body: decision.body, headers: CORS });
    }
    if (u.protocol === "data:" || u.protocol === "blob:" || u.hostname === "localhost" || u.hostname === "127.0.0.1") return r.continue();
    if (u.hostname.endsWith(".supabase.co")) {
      pagina.consultasSupabase.push({ metodo: r.method(), url: decodeURIComponent(r.url()), cuerpo: r.postData() || "" });
      return r.respond(respuestaSupabase(r));
    }
    pagina.externos.push(r.url());
    return r.abort();
  });

  await pagina.goto(url, { waitUntil: opciones.esperarRed === false ? "domcontentloaded" : "networkidle0", timeout: 60000 });
  if (opciones.espera !== 0) await espera(opciones.espera ?? 4000);
  return pagina;
}

// ------------------------------------------------------------------ Atajos sobre la app

const kiosco = (pagina) => pagina.frames().find((f) => f.url().includes("/vendor/kiosk.html"));
const texto = (pagina) => pagina.evaluate(() => document.body.innerText);
const hay = async (pagina, t) => (await texto(pagina)).includes(t);
const banner = (pagina) => pagina.evaluate(() => document.body.innerText.match(/RESALTADO: ([^\n]+)/)?.[1] || null);
const seleccion = (pagina) => kiosco(pagina).evaluate(() => window.__kiosco.seleccion());
const info3D = (pagina) => kiosco(pagina).evaluate(() => window.__kiosco.info());
const planos2D = (pagina) => pagina.evaluate(() => document.querySelectorAll("svg rect[id^=aula_]").length);
const pwned = (pagina) => pagina.evaluate(() => window.__pwned || null);

/** Pulsa el elemento cuyo texto es exactamente `t` (botones de React Native Web). */
const pulsar = (pagina, t) =>
  pagina.evaluate((t) => {
    const el = [...document.querySelectorAll("[role=button], button, div")].find((d) => d.textContent === t);
    el?.click();
    return !!el;
  }, t);

/** Clic real del ratón sobre un elemento del iframe del motor 3D. */
async function clicEnKiosco(pagina, selectorOId) {
  const caja = await (await pagina.$("iframe")).boundingBox();
  const p = await kiosco(pagina).evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selectorOId);
  await pagina.mouse.click(caja.x + p.x, caja.y + p.y);
  await espera(400);
}

/** Clic real del ratón sobre el centro (en pantalla) de un aula del 3D. */
async function clicEnAula(pagina, id, otraPlanta = false) {
  const caja = await (await pagina.$("iframe")).boundingBox();
  const p = await kiosco(pagina).evaluate((id, o) => window.__kiosco.pantalla(id, o), id, otraPlanta);
  await pagina.mouse.click(caja.x + p.x, caja.y + p.y);
}

module.exports = {
  RAIZ, DIST, DIR_PLANOS, ARGS_GL, espera, buscarChrome, lanzarNavegador, servir, cabecerasDe, abrir,
  kiosco, texto, hay, banner, seleccion, info3D, planos2D, pwned, pulsar, clicEnKiosco, clicEnAula, HORARIOS,
};
