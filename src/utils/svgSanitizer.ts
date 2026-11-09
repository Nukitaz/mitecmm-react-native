/**
 * Sanitizador de planos SVG (lista blanca), independiente de la plataforma.
 *
 * Se ejecuta en el JS de React Native (web, Android e iOS) con un parser XML puro,
 * ANTES de que el SVG llegue a cualquier innerHTML, iframe o WebView.
 * Elimina scripts, manejadores de eventos (on*), enlaces externos, <foreignObject>,
 * animaciones y referencias CSS a recursos externos.
 */
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/** Elementos SVG permitidos (nombre local, sin prefijo de namespace). */
const ELEMENTOS_PERMITIDOS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath",
  "clipPath", "mask", "pattern", "marker",
  "linearGradient", "radialGradient", "stop",
  "image", "style",
]);

/** Imágenes embebidas permitidas: solo raster en base64 (nunca image/svg+xml). */
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

/** Quita de un texto CSS cualquier referencia a recursos externos o código. */
function limpiarCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/-moz-binding[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, "none");
}

function esHrefSeguro(nombreElemento: string, valor: string): boolean {
  const v = valor.trim();
  if (v.startsWith("#")) return true; // referencia interna (<use>, clip-path…)
  return nombreElemento === "image" && DATA_IMAGE_RE.test(v);
}

function limpiarAtributos(el: any): void {
  const nombre = el.localName;
  // Se copia la lista porque se modifica mientras se recorre
  const attrs = Array.from(el.attributes as ArrayLike<any>);
  for (const attr of attrs) {
    const local: string = (attr.localName || attr.name || "").toLowerCase();
    const prefijo: string | null = attr.prefix || null;
    const valor: string = attr.value || "";

    // Namespaces de editor (inkscape:, sodipodi:) y cualquier on*
    const prefijoPermitido = !prefijo || prefijo === "xlink" || prefijo === "xml" || prefijo === "xmlns";
    const esEvento = local.startsWith("on");
    const valorPeligroso = /javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i.test(valor);

    if (!prefijoPermitido || esEvento || valorPeligroso) {
      el.removeAttributeNode(attr);
      continue;
    }

    if (local === "href") {
      if (!esHrefSeguro(nombre, valor)) el.removeAttributeNode(attr);
      continue;
    }

    if (local === "style") {
      el.setAttribute(attr.name, limpiarCss(valor));
      continue;
    }

    // Atributos de presentación que aceptan url(): solo referencias internas
    if (/url\(/i.test(valor) && !/^\s*url\(\s*['"]?#[^)]*\)\s*$/i.test(valor)) {
      el.removeAttributeNode(attr);
    }
  }
}

function limpiarNodo(nodo: any): void {
  const hijos = Array.from(nodo.childNodes as ArrayLike<any>);
  for (const hijo of hijos) {
    // 1 = elemento, 3 = texto, 4 = CDATA. Comentarios, PIs, etc. se eliminan.
    if (hijo.nodeType === 3 || hijo.nodeType === 4) {
      if (nodo.localName === "style") {
        nodo.replaceChild(nodo.ownerDocument.createTextNode(limpiarCss(hijo.data || "")), hijo);
      }
      continue;
    }
    if (hijo.nodeType !== 1) {
      nodo.removeChild(hijo);
      continue;
    }
    const enNsSvg = !hijo.namespaceURI || hijo.namespaceURI === SVG_NS;
    if (!enNsSvg || !ELEMENTOS_PERMITIDOS.has(hijo.localName)) {
      nodo.removeChild(hijo);
      continue;
    }
    limpiarAtributos(hijo);
    limpiarNodo(hijo);
  }
}

/**
 * Devuelve el SVG saneado como texto, o null si el contenido no es un SVG válido
 * (p. ej. una respuesta de error JSON/HTML del servidor).
 */
export function sanitizarSvg(texto: string | null | undefined): string | null {
  if (!texto || typeof texto !== "string") return null;

  let errorDeParseo = false;
  const parser = new DOMParser({
    onError: (nivel: string) => {
      if (nivel === "error" || nivel === "fatalError") errorDeParseo = true;
    },
  } as any);

  let doc: any;
  try {
    doc = parser.parseFromString(texto, "image/svg+xml");
  } catch {
    return null;
  }
  const raiz = doc?.documentElement;
  if (errorDeParseo || !raiz || raiz.localName !== "svg") return null;

  limpiarAtributos(raiz);
  limpiarNodo(raiz);

  // Garantiza los namespaces necesarios para que <use xlink:href> siga funcionando
  if (!raiz.getAttribute("xmlns")) raiz.setAttribute("xmlns", SVG_NS);
  if (!raiz.getAttribute("xmlns:xlink")) raiz.setAttribute("xmlns:xlink", XLINK_NS);

  return new XMLSerializer().serializeToString(raiz);
}
