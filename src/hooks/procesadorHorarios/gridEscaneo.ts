/**
 * Detecta la cuadrícula de un horario ESCANEADO a partir de los píxeles en gris
 * (la página se renderiza a ~200 ppi). Sin librerías: perfiles de líneas largas.
 */

export interface LineaV { x: number; y0: number; y1: number }
export interface Cuadricula {
  lineas: LineaV[]; // líneas verticales de izquierda a derecha
  nFilas: number; // incluye la fila de encabezado (fila 0)
}
export interface Rect { x0: number; y0: number; x1: number; y1: number }

type Gris = Uint8Array | Uint8ClampedArray;

/** Fondo de la página (mediana) y alcance de la tinta (fondo - negro más oscuro, percentil 1). */
function contraste(gris: Gris): { fondo: number; rango: number } {
  const muestra: number[] = [];
  for (let i = 0; i < gris.length; i += 97) muestra.push(gris[i]);
  muestra.sort((a, b) => a - b);
  const fondo = muestra[Math.floor(muestra.length / 2)];
  const negro = muestra[Math.floor(muestra.length * 0.01)];
  return { fondo, rango: Math.max(40, fondo - negro) };
}

/** Umbral de gris por debajo del cual un píxel es tinta de texto (relativo al contraste de ESTE escaneo). */
export function umbralTexto(gris: Gris): number {
  const { fondo, rango } = contraste(gris);
  return Math.round(fondo - 0.5 * rango);
}

function tramoMasLargo(esOscuro: (i: number) => boolean, n: number, hueco: number): [number, number, number] {
  let mejor = 0, mejorIni = 0, mejorFin = 0, ini = -1, fallos = 0, ultimo = -1;
  for (let i = 0; i < n; i++) {
    if (esOscuro(i)) {
      if (ini < 0) ini = i;
      fallos = 0;
      ultimo = i;
      if (ultimo - ini + 1 > mejor) { mejor = ultimo - ini + 1; mejorIni = ini; mejorFin = ultimo; }
    } else if (ini >= 0 && ++fallos > hueco) {
      ini = -1;
    }
  }
  return [mejor, mejorIni, mejorFin];
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Reconstruye las 8 líneas verticales esperadas (horas + 6 días) cuando el escaneo
 * no permite ver todas las divisiones. Usa las líneas detectadas como anclaje y un paso regular.
 */
export function reconstruirLineasEsperadas(lineasDetectadas: LineaV[], w: number, y0: number, y1: number): LineaV[] {
  const detectadas = lineasDetectadas
    .map((l) => l.x)
    .sort((a, b) => a - b)
    .filter((x, i, a) => i === 0 || x - a[i - 1] >= 2);

  let paso = 0;
  if (detectadas.length >= 2) {
    const difs = detectadas.slice(1).map((x, i) => x - detectadas[i]).filter((d) => d >= 20);
    paso = difs.length ? mediana(difs) : 0;
  }
  if (!paso) paso = w / 10;

  let mejor: number[] | null = null;
  let mejorPuntaje = -Infinity;
  for (let i = 0; i < detectadas.length; i++) {
    for (let indice = 0; indice < 8; indice++) {
      const x0 = detectadas[i] - indice * paso;
      if (x0 < w * 0.01 || x0 + 7 * paso > w * 0.99) continue;
      const cuadricula = Array.from({ length: 8 }, (_, k) => Math.round(x0 + k * paso));
      let cercania = 0;
      for (const x of detectadas) {
        let distancia = w;
        for (const gx of cuadricula) distancia = Math.min(distancia, Math.abs(x - gx));
        cercania += Math.max(0, 18 - distancia);
      }
      const puntaje = cercania * 100 - Math.abs(paso - w / 10);
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = cuadricula; }
    }
  }

  if (!mejor) {
    const x0 = w * 0.08;
    const x7 = w * 0.94;
    mejor = Array.from({ length: 8 }, (_, k) => Math.round(x0 + (x7 - x0) * k / 7));
  }
  return mejor.map((x) => ({ x, y0, y1 }));
}

function intentarCuadricula(gris: Gris, w: number, h: number, fracFuerte: number): Cuadricula | { error: string } {
  const { fondo, rango } = contraste(gris);
  const T = fondo - Math.max(5, 0.05 * rango); // sensible: también ve las líneas finas y claras de la tabla
  const Tfuerte = fondo - Math.max(8, fracFuerte * rango); // para ubicar las líneas verticales sin confundirlas con texto

  // 1) Líneas verticales largas y continuas (el texto no forma tramos tan largos)
  const cand: number[] = [];
  for (let x = 0; x < w; x++) {
    const [run] = tramoMasLargo((y) => gris[y * w + x] < Tfuerte, h, 3);
    if (run >= h * 0.15) cand.push(x);
  }
  const grupos: number[][] = [];
  for (const x of cand) {
    const g = grupos[grupos.length - 1];
    if (g && x - g[g.length - 1] <= 3) g.push(x); else grupos.push([x]);
  }
  let lineas: LineaV[] = grupos.map((g) => {
    const xc = Math.round(g.reduce((a, b) => a + b, 0) / g.length);
    // extensión real de la línea (con tolerancia a huecos de los trazos tenues)
    let mejor = { run: 0, a: 0, b: 0, x: xc };
    for (let xx = xc - 3; xx <= xc + 3; xx++) {
      if (xx < 0 || xx >= w) continue;
      const [run, a, b] = tramoMasLargo((y) => gris[y * w + xx] < T, h, 12);
      if (run > mejor.run) mejor = { run, a, b, x: xx };
    }
    return { x: xc, y0: mejor.a, y1: mejor.b };
  });
  if (lineas.length < 1) return { error: 'No se encontró la cuadrícula del horario' };

  // quedarse con las que comparten extensión vertical (las de la tabla)
  const mA = mediana(lineas.map((l) => l.y0));
  const mB = mediana(lineas.map((l) => l.y1));
  lineas = lineas.filter((l) => Math.abs(l.y0 - mA) <= 40 && Math.abs(l.y1 - mB) <= 40);
  if (lineas.length < 1) return { error: 'No se encontró la cuadrícula del horario' };

  // Si solo aparecen 1, 2 o 5 líneas verticales, no se rechaza el escaneo:
  // se completa la cuadrícula con divisiones uniformes ancladas a las líneas reales.
  if (lineas.length !== 8) lineas = reconstruirLineasEsperadas(lineas, w, mA, mB);

  // 2) Alto de fila: picos de líneas horizontales dentro de la tabla
  const xL = lineas[0].x + 5;
  const xR = lineas[lineas.length - 1].x - 5;
  const ancho = xR - xL;
  const picos: number[] = [];
  const frac: number[] = [];
  for (let y = mA; y <= mB; y++) {
    let n = 0;
    for (let x = xL; x < xR; x++) if (gris[y * w + x] < T) n++;
    frac.push(n / ancho);
  }
  let k = 0;
  while (k < frac.length) {
    if (frac[k] >= 0.35) {
      let mx = k;
      while (k < frac.length && frac[k] >= 0.35) { if (frac[k] > frac[mx]) mx = k; k++; }
      picos.push(mA + mx);
    } else k++;
  }
  const difs = picos.slice(1).map((p, i) => p - picos[i]).filter((d) => d >= 20 && d <= 150);
  if (difs.length < 3) return { error: 'No se pudo medir el alto de las filas' };
  const paso = mediana(difs);
  const nFilas = Math.round((mB - mA) / paso);
  if (nFilas < 3 || Math.abs((mB - mA) / nFilas - paso) > paso * 0.1) {
    return { error: 'La cuadrícula detectada no tiene filas regulares' };
  }
  return { lineas, nFilas };
}


/**
 * Detecta la cuadrícula. Si se indica `lineasEsperadas` (8 = columna de horas + 6 días) y no salen, reintenta
 * con umbrales más sensibles (escaneos con líneas tenues) y devuelve el intento que más se acerque.
 */
export function detectarCuadricula(gris: Gris, w: number, h: number, lineasEsperadas?: number): Cuadricula | { error: string } {
  let mejor: Cuadricula | { error: string } = { error: 'No se encontró la cuadrícula del horario' };
  for (const frac of [0.16, 0.11, 0.07]) {
    const r = intentarCuadricula(gris, w, h, frac);
    if ('error' in r) continue;
    if (lineasEsperadas == null || r.lineas.length === lineasEsperadas) return r;
    if ('error' in mejor || Math.abs(r.lineas.length - lineasEsperadas) < Math.abs(mejor.lineas.length - lineasEsperadas)) mejor = r;
  }
  return mejor;
}

/**
 * Inclinación de la página en grados (positivo = el contenido está girado en sentido antihorario).
 * Busca el ángulo que hace más "afiladas" las líneas horizontales (perfil de proyección).
 */
export function estimarInclinacion(gris: Gris, w: number, h: number): number {
  const f = 4;
  const wd = Math.floor(w / f);
  const hd = Math.floor(h / f);
  const c0 = contraste(gris);
  const T = c0.fondo - Math.max(8, 0.16 * c0.rango);
  const px: number[] = [];
  const py: number[] = [];
  for (let y = 0; y < hd; y++) {
    for (let x = 0; x < wd; x++) {
      let oscuro = false;
      for (let dy = 0; dy < f && !oscuro; dy++) {
        const fila = (y * f + dy) * w + x * f;
        for (let dx = 0; dx < f; dx++) if (gris[fila + dx] < T) { oscuro = true; break; }
      }
      if (oscuro) { px.push(x); py.push(y); }
    }
  }
  const puntaje = (grados: number): number => {
    const t = Math.tan((grados * Math.PI) / 180);
    const desp = Math.ceil(Math.abs(t) * wd) + 2;
    const bins = new Int32Array(hd + desp * 2 + 2);
    for (let i = 0; i < px.length; i++) bins[Math.round(py[i] + px[i] * t) + desp]++;
    let sc = 0;
    for (let i = 0; i < bins.length; i++) sc += bins[i] * bins[i];
    return sc;
  };
  let mejor = 0;
  let mejorSc = -1;
  for (let a = -4; a <= 4.0001; a += 0.25) { const sc = puntaje(a); if (sc > mejorSc) { mejorSc = sc; mejor = a; } }
  const centro = mejor;
  for (let a = centro - 0.25; a <= centro + 0.2501; a += 0.05) { const sc = puntaje(a); if (sc > mejorSc) { mejorSc = sc; mejor = a; } }
  return Math.round(mejor * 100) / 100;
}

/** Gira la imagen en gris `grados` (positivo = antihorario) alrededor del centro; el relleno es blanco. */
export function rotarGris(gris: Gris, w: number, h: number, grados: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h).fill(255);
  const a = (grados * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // posición de origen (giro inverso) con ejes y hacia abajo
      const dx = x - cx;
      const dy = y - cy;
      const sx = c * dx - s * dy + cx;
      const sy = s * dx + c * dy + cy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      const i = y0 * w + x0;
      out[y * w + x] =
        gris[i] * (1 - fx) * (1 - fy) + gris[i + 1] * fx * (1 - fy) + gris[i + w] * (1 - fx) * fy + gris[i + w + 1] * fx * fy;
    }
  }
  return out;
}

/** Rectángulo de una celda. fila 1..nFilas-1 (0 es el encabezado), col 0..lineas.length-2 (0 = columna de horas). */
export function rectCelda(c: Cuadricula, fila: number, col: number, margen = 6): Rect {
  const izq = c.lineas[col];
  const der = c.lineas[col + 1];
  const top = (izq.y0 + der.y0) / 2;
  const bot = (izq.y1 + der.y1) / 2;
  const alto = (bot - top) / c.nFilas;
  return {
    x0: Math.round(izq.x + margen),
    x1: Math.round(der.x - margen),
    y0: Math.round(top + fila * alto + margen - 2),
    y1: Math.round(top + (fila + 1) * alto - margen + 2),
  };
}

/** Fracción de píxeles realmente oscuros (tinta negra, no las líneas grises) dentro de un rectángulo. */
export function fraccionTinta(gris: Gris, w: number, r: Rect, umbral = 110): number {
  let n = 0;
  let total = 0;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) { total++; if (gris[y * w + x] < umbral) n++; }
  }
  return total ? n / total : 0;
}

/**
 * Las filas dicen "07:00:00 - 08:00:00". Dadas las lecturas (null si no se pudo leer),
 * reconstruye el minuto de inicio de cada fila asumiendo filas contiguas de 60 min.
 */
export function inferirInicios(lecturas: (number | null)[]): { inicios: number[]; leidas: number } | null {
  const votos = new Map<number, number>();
  lecturas.forEach((m, i) => { if (m != null) votos.set(m - i * 60, (votos.get(m - i * 60) ?? 0) + 1); });
  if (votos.size === 0) return null;
  const [base] = [...votos].sort((a, b) => b[1] - a[1])[0];
  return { inicios: lecturas.map((_, i) => base + i * 60), leidas: [...votos.values()].reduce((a, b) => a + b, 0) };
}

/** Binarización de Otsu sobre un recorte en gris (para el OCR). */
export function umbralOtsu(gris: Gris): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gris.length; i++) hist[gris[i]]++;
  const total = gris.length;
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, wB = 0, mejor = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumaB += t * hist[t];
    const mB = sumaB / wB;
    const mF = (suma - sumaB) / wF;
    const varEntre = wB * wF * (mB - mF) * (mB - mF);
    if (varEntre > mejor) { mejor = varEntre; umbral = t; }
  }
  return umbral;
}
