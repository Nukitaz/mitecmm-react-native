// Sanitizador de planos SVG (Bloque 2) con los planos reales y con planos maliciosos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import { sanitizarSvg } from "../../src/utils/svgSanitizer.ts";
import { listarEspacios } from "../../src/utils/espacios.ts";
import { PLANOS_EDIFICIO, leerPlano } from "./planos.mjs";

/** Rasgos que nunca deben sobrevivir al saneado. */
function assertSinCodigo(svg, contexto) {
  assert.doesNotMatch(svg, /<script/i, `${contexto}: <script>`);
  assert.doesNotMatch(svg, /<foreignObject/i, `${contexto}: <foreignObject>`);
  assert.doesNotMatch(svg, /\son[a-z]+\s*=/i, `${contexto}: manejador on*`);
  assert.doesNotMatch(svg, /javascript\s*:/i, `${contexto}: javascript:`);
  assert.doesNotMatch(svg, /<animate|<set\b/i, `${contexto}: animación`);
}

const idsDe = (svg) => {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const ids = new Set();
  const recorrer = (n) => {
    for (let i = 0; i < (n.childNodes?.length || 0); i++) {
      const el = n.childNodes[i];
      if (el.nodeType !== 1) continue;
      if (el.getAttribute("id")) ids.add(el.getAttribute("id"));
      recorrer(el);
    }
  };
  recorrer(doc.documentElement);
  return ids;
};

for (const archivo of [...PLANOS_EDIFICIO, "mapa_general.svg"]) {
  test(`plano real ${archivo}: el saneado conserva todos los espacios`, () => {
    const original = leerPlano(archivo);
    const limpio = sanitizarSvg(original);
    assert.ok(limpio, "debe ser un SVG válido");
    assertSinCodigo(limpio, archivo);
    assert.deepEqual(listarEspacios(limpio), listarEspacios(original));
    // Los IDs de elementos SVG permitidos siguen ahí (solo se quitan metadatos del editor)
    const antes = idsDe(original), despues = idsDe(limpio);
    for (const id of despues) assert.ok(antes.has(id));
    const perdidos = [...antes].filter((id) => !despues.has(id) && !/^(namedview|metadata|defs)\d*$/i.test(id));
    assert.ok(perdidos.length <= antes.size * 0.02, `IDs perdidos: ${perdidos.slice(0, 10).join(", ")}`);
    // Saneado idempotente
    assert.equal(sanitizarSvg(limpio), limpio);
  });
}

const VENENO =
  '<script>top.__pwned="script"</script>' +
  '<image href="x" onerror="top.__pwned=1" width="1" height="1"/>' +
  '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="top.__pwned=1"/></div></foreignObject>' +
  '<a href="javascript:top.__pwned=1"><text>x</text></a>' +
  '<animate attributeName="href" to="javascript:alert(1)"/>' +
  '<set attributeName="onmouseover" to="alert(1)"/>' +
  '<use href="https://evil.example/x.svg#a"/>' +
  '<use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>' +
  '<iframe src="https://evil.example"></iframe>' +
  "<!-- comentario --><?php echo 1; ?>";

test("plano real con código malicioso inyectado: se elimina y el plano sigue completo", () => {
  const original = leerPlano("planta_baja_edificio_a.svg");
  const envenenado = original
    .replace(/(<svg[^>]*?)>/, '$1 onload="top.__pwned=1">')
    .replace("</svg>", VENENO + "</svg>")
    .replace(/id="aula_a2"/, 'id="aula_a2" onclick="top.__pwned=1" filter="url(https://evil.example/f.svg#x)"');
  const limpio = sanitizarSvg(envenenado);
  assert.ok(limpio);
  assertSinCodigo(limpio, "envenenado");
  assert.doesNotMatch(limpio, /evil\.example|<iframe|data:image\/svg|<\?php|<!--/);
  assert.deepEqual(listarEspacios(limpio), listarEspacios(original));
  assert.match(limpio, /id="aula_a2"/);
});

test("conserva referencias internas e imágenes raster embebidas", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs><linearGradient id="g1"><stop offset="0"/></linearGradient><symbol id="s1"><rect width="1" height="1"/></symbol></defs>
    <use xlink:href="#s1"/><use href="#s1"/><rect id="aula_a1" fill="url(#g1)" width="5" height="5"/>
    <image href="${png}" width="1" height="1"/></svg>`;
  const limpio = sanitizarSvg(svg);
  assert.match(limpio, /xlink:href="#s1"/);
  assert.match(limpio, /href="#s1"/);
  assert.match(limpio, /fill="url\(#g1\)"/);
  assert.ok(limpio.includes(`href="${png}"`));
});

test("limpia CSS que carga recursos externos o ejecuta código", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/a.css); rect{fill:url(https://evil.example/x.png);behavior:expression(alert(1))}</style>
    <rect id="aula_a1" style="background:url('http://evil.example/y.png');fill:url(#ok)" width="1" height="1"/></svg>`;
  const limpio = sanitizarSvg(svg);
  assert.doesNotMatch(limpio, /evil\.example|@import|expression\(/);
  assert.match(limpio, /url\(#ok\)/);
});

test("quita atributos de editores (inkscape:, sodipodi:)", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd">
    <sodipodi:namedview id="namedview1"/><g inkscape:label="Capa 1" inkscape:groupmode="layer"><rect id="aula_a1" width="1" height="1"/></g></svg>`;
  const limpio = sanitizarSvg(svg);
  assert.doesNotMatch(limpio, /inkscape:label|sodipodi:namedview|groupmode/);
  assert.match(limpio, /id="aula_a1"/);
});

test("rechaza lo que no es un SVG válido (respuestas de error del servidor, HTML, XML roto)", () => {
  for (const malo of [
    "",
    null,
    undefined,
    '{"statusCode":"404","error":"not_found"}',
    "<html><body>Error</body></html>",
    "<svg><rect></svg>",
    "texto plano",
    '<?xml version="1.0"?><datos/>',
  ]) {
    assert.equal(sanitizarSvg(malo), null, String(malo));
  }
});
