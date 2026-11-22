import { ClaseHorario } from './tipos';
import { limpiarNombre, limpiarTexto, parseHora, sinAcentos, DIAS } from './normalizar';
import { parseTextoCelda } from './celda';

/** Fragmento de texto de pdf.js ya con el origen arriba-izquierda (y crece hacia abajo). */
export interface ItemTexto {
  str: string;
  x: number;
  y: number; // línea base
  w: number;
  h: number;
}

interface Run { text: string; x0: number; x1: number; y: number }

export interface ResultadoNativo {
  ok: boolean;
  motivo?: string;
  nombre: string | null;
  nomina: string | null;
  clases: ClaseHorario[];
  avisos: string[];
}

const NOMBRES_DIA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const RX_ETIQUETA_HORA = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*-\s*(\d{1,2}):(\d{2})(?::\d{2})?/;

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Une fragmentos contiguos de la misma línea en "runs" (una frase de una celda). */
function construirRuns(items: ItemTexto[]): Run[] {
  const utiles = items.filter((i) => i.str.trim() !== '').sort((a, b) => a.y - b.y || a.x - b.x);
  const lineas: ItemTexto[][] = [];
  for (const it of utiles) {
    const l = lineas[lineas.length - 1];
    if (l && Math.abs(l[0].y - it.y) <= Math.max(2, it.h * 0.35)) l.push(it);
    else lineas.push([it]);
  }
  const runs: Run[] = [];
  for (const l of lineas) {
    l.sort((a, b) => a.x - b.x);
    let actual: Run | null = null;
    for (const it of l) {
      if (actual && it.x - actual.x1 <= Math.max(6, it.h * 0.9)) {
        const hueco = it.x - actual.x1;
        actual.text += (hueco > 0.8 && !actual.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
        actual.x1 = Math.max(actual.x1, it.x + it.w);
      } else {
        if (actual) runs.push(actual);
        actual = { text: it.str, x0: it.x, x1: it.x + it.w, y: it.y };
      }
    }
    if (actual) runs.push(actual);
  }
  return runs.map((r) => ({ ...r, text: r.text.replace(/\s+/g, ' ').trim() }));
}

/** Dentro de una celda: agrupa los fragmentos por línea (misma altura) y los une de izquierda a derecha. */
function ensamblarLineas(items: ItemTexto[]): string[] {
  const orden = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lineas: ItemTexto[][] = [];
  for (const it of orden) {
    const l = lineas[lineas.length - 1];
    if (l && Math.abs(l[0].y - it.y) <= Math.max(2.5, it.h * 0.4)) l.push(it); else lineas.push([it]);
  }
  return lineas.map((l) => {
    l.sort((a, b) => a.x - b.x);
    let t = '';
    let fin = -Infinity;
    for (const it of l) {
      const sep = t && it.x - fin > 0.8 && !t.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '';
      t += sep + it.str;
      fin = it.x + it.w;
    }
    return t.replace(/\s+/g, ' ').trim();
  });
}

/**
 * Lee la cuadrícula (horas × días) del horario de docente a partir del texto real del PDF.
 * Devuelve ok=false si el PDF no tiene ese formato.
 */
export function leerCuadriculaNativa(items: ItemTexto[]): ResultadoNativo {
  const vacio = (motivo: string): ResultadoNativo => ({ ok: false, motivo, nombre: null, nomina: null, clases: [], avisos: [] });
  const runs = construirRuns(items);

  // 1) Encabezado de días
  const cabeceras = NOMBRES_DIA.map((n) => runs.find((r) => sinAcentos(r.text).toLowerCase() === n));
  if (cabeceras.filter(Boolean).length < 4 || cabeceras.some((c) => !c)) {
    return vacio('No se encontró el encabezado LUNES…SABADO');
  }
  const centros = cabeceras.map((c) => (c!.x0 + c!.x1) / 2);
  const yCab = mediana(cabeceras.map((c) => c!.y));
  const paso = (centros[centros.length - 1] - centros[0]) / (centros.length - 1);
  const limites = centros.map((c, i) => [c - paso / 2, c + paso / 2] as [number, number]);

  // 2) Etiquetas de hora (columna izquierda)
  const etiquetas = runs
    .filter((r) => r.x1 < limites[0][0] + paso * 0.2 && r.y > yCab && RX_ETIQUETA_HORA.test(r.text))
    .sort((a, b) => a.y - b.y);
  if (etiquetas.length < 3) return vacio('No se encontraron las etiquetas de hora');
  const pasoFila = mediana(etiquetas.slice(1).map((e, i) => e.y - etiquetas[i].y));
  const filas = etiquetas.map((e) => {
    const m = RX_ETIQUETA_HORA.exec(e.text)!;
    return { y: e.y, inicio: parseHora(`${m[1]}:${m[2]}`)!, fin: parseHora(`${m[3]}:${m[4]}`)! };
  });
  const yMin = filas[0].y - pasoFila * 0.7;
  const yMax = filas[filas.length - 1].y + pasoFila * 0.7;

  // 3) Asignar cada fragmento de texto a su celda (fila, columna)
  const celdas = new Map<string, ItemTexto[]>();
  for (const it of items) {
    if (it.str.trim() === '' || it.y < yMin || it.y > yMax) continue;
    const cx = it.x + it.w / 2;
    const col = limites.findIndex(([a, b]) => cx >= a && cx < b);
    if (col < 0) continue;
    let fila = 0;
    let dist = Infinity;
    filas.forEach((f, i) => { const d = Math.abs(f.y - it.y); if (d < dist) { dist = d; fila = i; } });
    if (dist > pasoFila * 0.6) continue;
    const k = `${fila}|${col}`;
    celdas.set(k, [...(celdas.get(k) ?? []), it]);
  }

  // 4) Interpretar cada celda
  const clases: ClaseHorario[] = [];
  const avisos: string[] = [];
  for (const [k, its] of [...celdas].sort()) {
    const [fi, ci] = k.split('|').map(Number);
    const c = parseTextoCelda(ensamblarLineas(its));
    if (!c.materia && !c.aula) continue;
    if (!c.materia) avisos.push(`Celda ${DIAS[ci]} ${filas[fi].inicio.slice(0, 5)} sin materia legible`);
    clases.push({
      materia: c.materia ?? '',
      grupo: c.grupo,
      dia: DIAS[ci],
      hora_inicio: filas[fi].inicio,
      hora_fin: filas[fi].fin,
      aula: c.aula,
    });
  }

  // 5) Encabezado (solo como respaldo si el QR no se pudo leer)
  const etqDocente = runs.find((r) => /^docente:?$/i.test(sinAcentos(r.text)));
  const etqNomina = runs.find((r) => /^nomina:?$/i.test(sinAcentos(r.text)));
  let nombre: string | null = null;
  let nomina: string | null = null;
  if (etqDocente) {
    const tope = etqNomina && Math.abs(etqNomina.y - etqDocente.y) < 4 ? etqNomina.x0 : Infinity;
    const cand = runs.find((r) => Math.abs(r.y - etqDocente.y) < 4 && r.x0 > etqDocente.x1 && r.x0 < tope);
    nombre = limpiarNombre(cand?.text);
  }
  if (etqNomina) {
    const cand = runs.find((r) => Math.abs(r.y - etqNomina.y) < 4 && r.x0 > etqNomina.x1);
    const t = limpiarTexto(cand?.text)?.toUpperCase().replace(/\s/g, '') ?? null;
    nomina = t && /^[A-Z]{2,4}\d{3,6}$/.test(t) ? t : null;
  }

  return { ok: true, nombre, nomina, clases, avisos };
}
