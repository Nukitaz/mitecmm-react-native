import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import jsQR from 'jsqr';

import {
  AulaPendiente, ClaseHorario, DocenteProcesado, ErrorArchivo, EstadoSemaforo, OrigenDatos, ResumenGuardado,
} from './procesadorHorarios/tipos';
import {
  aHMS, idAleatorio, limpiarNombre, limpiarTexto, nominaDeArchivo,
} from './procesadorHorarios/normalizar';
import { DatosQR, parseQR } from './procesadorHorarios/qr';
import { CeldaLeida, parseTextoCelda } from './procesadorHorarios/celda';
import { ItemTexto, leerCuadriculaNativa } from './procesadorHorarios/gridNativo';
import {
  Cuadricula, Rect, detectarCuadricula, estimarInclinacion, fraccionTinta, inferirInicios, rectCelda, rotarGris, umbralOtsu, umbralTexto,
} from './procesadorHorarios/gridEscaneo';
import { docentesDesdeMatriz } from './procesadorHorarios/excel';
import {
  calcularAulasPendientes, evaluarLote, fusionarClases, ordenarClases,
} from './procesadorHorarios/validar';

export type { AulaPendiente, ClaseHorario, DocenteProcesado, ErrorArchivo, EstadoSemaforo, ResumenGuardado };

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
// pdf.js y Tesseract.js descargan algunos archivos de internet al ejecutarse. Si la red de la escuela
// los bloquea, sírvelos desde tu propio proyecto (carpeta public/) y cambia estas rutas.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const ESCALA_RENDER = 200 / 72; // 200 ppi: la cuadrícula se detecta y se lee a esta resolución
const MIN_TINTA_CELDA = 0.006; // fracción de tinta negra para considerar que una celda tiene texto
const AULAS_PARA_REINTENTAR = 10; // si el catálogo ya tiene al menos tantas aulas, se relee lo desconocido

type Progreso = { actual: number; total: number; porcentaje: number; mensaje: string };
const PROGRESO_INICIAL: Progreso = { actual: 0, total: 0, porcentaje: 0, mensaje: '' };

const cedeAlNavegador = () => new Promise<void>((r) => setTimeout(r, 0));

export type VistaBorradorHorarios = 'CARRERAS' | 'DOCUMENTOS' | 'CARGA';
export const cacheBorradorHorarios: {
  docentesProcesados: DocenteProcesado[];
  carreraSeleccionadaId: string | null;
  vistaActual: VistaBorradorHorarios;
} = {
  docentesProcesados: [],
  carreraSeleccionadaId: null,
  vistaActual: 'CARRERAS',
};

const CLAVE_BORRADOR = 'mitecmm:borrador-horarios';

export function guardarEstadoBorradorHorarios(
  vistaActual: VistaBorradorHorarios,
  carreraSeleccionadaId: string | null,
) {
  cacheBorradorHorarios.vistaActual = vistaActual;
  cacheBorradorHorarios.carreraSeleccionadaId = carreraSeleccionadaId;
  if (typeof sessionStorage === 'undefined') return;
  if (!cacheBorradorHorarios.docentesProcesados.length) return;
  const serializable = cacheBorradorHorarios.docentesProcesados.map(
    ({ archivoOriginal: _archivoOriginal, ...docente }) => docente,
  );
  sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
    docentesProcesados: serializable,
    carreraSeleccionadaId,
    vistaActual,
  }));
}

function restaurarBorradorSesion(): DocenteProcesado[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const guardado = sessionStorage.getItem(CLAVE_BORRADOR);
    if (!guardado) return [];
    const valor = JSON.parse(guardado);
    cacheBorradorHorarios.carreraSeleccionadaId = valor.carreraSeleccionadaId ?? null;
    cacheBorradorHorarios.vistaActual = valor.vistaActual ?? 'CARRERAS';
    return Array.isArray(valor.docentesProcesados) ? valor.docentesProcesados : [];
  } catch {
    return [];
  }
}

// Modos de segmentación de página de Tesseract (6 = bloque de texto, 7 = una sola línea).
// Van como `any` para no depender de cómo tipa cada versión de tesseract.js este parámetro.
const PSM_BLOQUE: any = '6';
const PSM_LINEA: any = '7';

// ---------------------------------------------------------------------------
// Utilidades de imagen / OCR (solo navegador)
// ---------------------------------------------------------------------------
async function renderizarPagina(page: any): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: ESCALA_RENDER });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

function aGris(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const gris = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < gris.length; i++, j += 4) gris[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
  return gris;
}

function canvasDesdeGris(gris: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.createImageData(w, h);
  for (let i = 0, j = 0; i < gris.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = gris[i];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Los escaneos suelen salir un poco chuecos (medio grado ya rompe la detección de la cuadrícula).
 * Mide la inclinación y devuelve la página enderezada (en escala de grises).
 */
function enderezar(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; gris: Uint8ClampedArray } {
  const { width: w, height: h } = canvas;
  const gris = aGris(canvas);
  const grados = estimarInclinacion(gris, w, h);
  if (Math.abs(grados) < 0.05) return { canvas: canvasDesdeGris(gris, w, h), gris };
  const recta = rotarGris(gris, w, h, -grados);
  return { canvas: canvasDesdeGris(recta, w, h), gris: recta };
}

/**
 * El QR de un escaneo a 200 ppi suele ser demasiado pequeño y borroso para leerse tal cual: hay que
 * recortar la zona, AMPLIARLA y binarizarla. Se prueban varias ventanas (de más ajustada a más ancha)
 * y varias ampliaciones, y se queda con la primera que decodifica.
 */
function leerQR(canvas: HTMLCanvasElement): DatosQR | null {
  const { width: w, height: h } = canvas;
  // [x0, x1, y0, y1] como fracción de la página (el QR está arriba a la derecha)
  const ventanas: [number, number, number, number][] = [
    [0.77, 0.92, 0.14, 0.24],
    [0.7, 0.97, 0.1, 0.28],
    [0.6, 1.0, 0.04, 0.3],
  ];
  const intentar = (img: ImageData, invertir: 'dontInvert' | 'attemptBoth'): DatosQR | null => {
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: invertir });
    return res?.data ? parseQR(res.data) : null;
  };

  for (const [a, b, c, d] of ventanas) {
    const r: Rect = { x0: Math.round(w * a), x1: Math.round(w * b), y0: Math.round(h * c), y1: Math.round(h * d) };
    // 1) sin ampliar (suficiente para PDFs digitales, donde el QR es nítido)
    const directo = canvas.getContext('2d')!.getImageData(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    const q0 = intentar(directo, 'attemptBoth');
    if (q0) return q0;
    // 2) ampliado y binarizado (lo que necesitan los escaneos)
    for (const escala of [3, 2, 4]) {
      const grande = ampliarBinarizado(canvas, r, escala);
      const q = intentar(grande.getContext('2d')!.getImageData(0, 0, grande.width, grande.height), 'dontInvert');
      grande.width = 0;
      if (q) return q;
    }
  }
  return null;
}

/** Recorta una zona, la agranda (suavizado alto) y la binariza con Otsu. Devuelve un canvas nuevo. */
function ampliarBinarizado(canvas: HTMLCanvasElement, r: Rect, escala: number): HTMLCanvasElement {
  const rw = r.x1 - r.x0;
  const rh = r.y1 - r.y0;
  const grande = document.createElement('canvas');
  grande.width = rw * escala;
  grande.height = rh * escala;
  const g = grande.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(canvas, r.x0, r.y0, rw, rh, 0, 0, grande.width, grande.height);

  const img = g.getImageData(0, 0, grande.width, grande.height);
  const gris = new Uint8ClampedArray(grande.width * grande.height);
  for (let i = 0, j = 0; i < gris.length; i++, j += 4) gris[i] = 0.299 * img.data[j] + 0.587 * img.data[j + 1] + 0.114 * img.data[j + 2];
  const umbral = umbralOtsu(gris);
  for (let i = 0, j = 0; i < gris.length; i++, j += 4) {
    const v = gris[i] > umbral ? 255 : 0;
    img.data[j] = img.data[j + 1] = img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grande;
}

/** Para el OCR: lo mismo y con un borde blanco alrededor. */
function recortarParaOCR(canvas: HTMLCanvasElement, r: Rect, escala: number): HTMLCanvasElement {
  const grande = ampliarBinarizado(canvas, r, escala);
  const borde = 20;
  const out = document.createElement('canvas');
  out.width = grande.width + borde * 2;
  out.height = grande.height + borde * 2;
  const o = out.getContext('2d')!;
  o.fillStyle = '#fff';
  o.fillRect(0, 0, out.width, out.height);
  o.drawImage(grande, borde, borde);
  grande.width = 0;
  return out;
}

/** Elige, campo por campo, el valor que más se repite entre varias lecturas de la misma celda. */
function votar(lecturas: CeldaLeida[]): { celda: CeldaLeida; discrepa: boolean } {
  let discrepa = false;
  const elegir = (campo: keyof CeldaLeida): string | null => {
    const cuenta = new Map<string, number>();
    for (const l of lecturas) if (l[campo]) cuenta.set(l[campo]!, (cuenta.get(l[campo]!) ?? 0) + 1);
    if (cuenta.size === 0) return null;
    if (cuenta.size > 1) discrepa = true;
    return [...cuenta].sort((a, b) => b[1] - a[1])[0][0];
  };
  return { celda: { materia: elegir('materia'), grupo: elegir('grupo'), aula: elegir('aula') }, discrepa };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export const useProcesadorHorarios = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progreso, setProgreso] = useState<Progreso>(PROGRESO_INICIAL);
  const [docentes, setDocentes] = useState<DocenteProcesado[]>(() => {
    if (cacheBorradorHorarios.docentesProcesados.length) return cacheBorradorHorarios.docentesProcesados;
    const restaurados = restaurarBorradorSesion();
    cacheBorradorHorarios.docentesProcesados = restaurados;
    return restaurados;
  });
  const [erroresArchivos, setErroresArchivos] = useState<ErrorArchivo[]>([]);
  const [aulasConocidas, setAulasConocidas] = useState<Set<string>>(new Set());

  const cancelarRef = useRef(false);
  const guardandoRef = useRef(false);
  const correccionesRef = useRef<Record<string, string>>({});
  const aulasRef = useRef<Set<string>>(new Set());
  aulasRef.current = aulasConocidas;

  useEffect(() => {
    cacheBorradorHorarios.docentesProcesados = docentes;
    if (typeof sessionStorage === 'undefined') return;
    if (docentes.length) {
      const serializable = docentes.map(({ archivoOriginal: _archivoOriginal, ...docente }) => docente);
      sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
        docentesProcesados: serializable,
        carreraSeleccionadaId: cacheBorradorHorarios.carreraSeleccionadaId,
        vistaActual: cacheBorradorHorarios.vistaActual,
      }));
    } else {
      sessionStorage.removeItem(CLAVE_BORRADOR);
    }
  }, [docentes]);

  useEffect(() => {
    if (typeof window === 'undefined' || !docentes.length) return;
    const avisarAntesDeSalir = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisarAntesDeSalir);
    return () => window.removeEventListener('beforeunload', avisarAntesDeSalir);
  }, [docentes.length]);

  // El semáforo se calcula siempre a partir de los datos: si cambia el catálogo o se edita algo, se actualiza solo.
  const resultados = useMemo(() => evaluarLote(docentes, aulasConocidas), [docentes, aulasConocidas]);
  const resultadosRef = useRef<DocenteProcesado[]>([]);
  resultadosRef.current = resultados;
  const aulasPendientes: AulaPendiente[] = useMemo(
    () => calcularAulasPendientes(docentes, aulasConocidas),
    [docentes, aulasConocidas],
  );

  // -------------------------------------------------------------------------
  // Catálogo de aulas (tablas aulas_conocidas y correcciones_aula; si no existen, solo vive en memoria)
  // -------------------------------------------------------------------------
  const cargarCatalogo = async () => {
    try {
      const sb = supabase as any;
      const { data: aulas, error: e1 } = await sb.from('aulas_conocidas').select('aula');
      if (!e1 && aulas) setAulasConocidas(new Set<string>(aulas.map((r: any) => String(r.aula))));
      const { data: corr, error: e2 } = await sb.from('correcciones_aula').select('de, a');
      if (!e2 && corr) correccionesRef.current = Object.fromEntries(corr.map((r: any) => [String(r.de), String(r.a)]));
    } catch (e) {
      console.warn('No se pudo cargar el catálogo de aulas (se trabaja solo en memoria):', e);
    }
  };

  const confirmarAula = useCallback(async (aula: string) => {
    setAulasConocidas((prev) => new Set(prev).add(aula));
    try { await (supabase as any).from('aulas_conocidas').upsert({ aula }, { onConflict: 'aula' }); }
    catch (e) { console.warn('No se pudo guardar el aula confirmada:', e); }
  }, []);

  /** Corrige un aula mal leída en todo el lote y recuerda la corrección para las próximas cargas. */
  const corregirAula = useCallback(async (de: string, a: string) => {
    correccionesRef.current = { ...correccionesRef.current, [de]: a };
    setDocentes((prev) => prev.map((d) => ({ ...d, clases: d.clases.map((c) => (c.aula === de ? { ...c, aula: a, dudosa: false } : c)) })));
    setAulasConocidas((prev) => new Set(prev).add(a));
    try {
      const sb = supabase as any;
      await sb.from('aulas_conocidas').upsert({ aula: a }, { onConflict: 'aula' });
      await sb.from('correcciones_aula').upsert({ de, a }, { onConflict: 'de' });
    } catch (e) { console.warn('No se pudo guardar la corrección:', e); }
  }, []);

  // -------------------------------------------------------------------------
  // Progreso
  // -------------------------------------------------------------------------
  const avanzar = (i: number, total: number, fraccion: number, mensaje: string) =>
    setProgreso({ actual: Math.min(i + 1, total), total, porcentaje: Math.round(((i + fraccion) / total) * 100), mensaje });

  // -------------------------------------------------------------------------
  // PDF
  // -------------------------------------------------------------------------
  const ocrRef = useRef<any>(null);
  const obtenerOCR = async () => {
    if (!ocrRef.current) {
      const w = await createWorker('eng');
      await w.setParameters({ tessedit_pageseg_mode: PSM_BLOQUE });
      ocrRef.current = w;
    }
    return ocrRef.current;
  };

  const leerTexto = async (canvas: HTMLCanvasElement, r: Rect, escala: number): Promise<string> => {
    const worker = await obtenerOCR();
    const recorte = recortarParaOCR(canvas, r, escala);
    const { data } = await worker.recognize(recorte);
    recorte.width = 0;
    return String(data.text ?? '').trim();
  };

  const leerCeldaEscaneada = async (canvas: HTMLCanvasElement, r: Rect): Promise<{ celda: CeldaLeida; dudosa: boolean }> => {
    const aplicarCorreccion = (c: CeldaLeida): CeldaLeida =>
      c.aula && correccionesRef.current[c.aula] ? { ...c, aula: correccionesRef.current[c.aula] } : c;

    const primera = aplicarCorreccion(parseTextoCelda((await leerTexto(canvas, r, 3)).split('\n')));
    const incompleta = !primera.materia || !primera.aula;
    const desconocida = !!primera.aula && aulasRef.current.size >= AULAS_PARA_REINTENTAR && !aulasRef.current.has(primera.aula);
    if (!incompleta && !desconocida) return { celda: primera, dudosa: false };

    // Lectura adaptativa: solo las celdas rebeldes se leen otra vez con otro tamaño y se vota.
    const lecturas = [primera];
    for (const escala of [2, 4]) {
      lecturas.push(aplicarCorreccion(parseTextoCelda((await leerTexto(canvas, r, escala)).split('\n'))));
    }
    const { celda, discrepa } = votar(lecturas);
    const aunDesconocida = !!celda.aula && aulasRef.current.size >= AULAS_PARA_REINTENTAR && !aulasRef.current.has(celda.aula);
    return { celda, dudosa: discrepa || aunDesconocida || !celda.materia || !celda.aula };
  };

  const leerInicioDeFilas = async (canvas: HTMLCanvasElement, cuad: Cuadricula): Promise<(number | null)[]> => {
    const worker = await obtenerOCR();
    await worker.setParameters({ tessedit_char_whitelist: '0123456789:- ', tessedit_pageseg_mode: PSM_LINEA });
    const lecturas: (number | null)[] = [];
    for (let f = 1; f < cuad.nFilas; f++) {
      const t = await leerTexto(canvas, rectCelda(cuad, f, 0), 3);
      const m = /(\d{1,2})\s*:\s*(\d{2})/.exec(t);
      lecturas.push(m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null);
    }
    await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: PSM_BLOQUE });
    return lecturas;
  };

  const procesarEscaneo = async (
    canvas: HTMLCanvasElement, gris: Uint8ClampedArray, qr: DatosQR | null, etiqueta: string, alAvanzar: (f: number, msg: string) => void,
  ): Promise<{ docente?: DocenteProcesado; error?: string }> => {
    const { width: w, height: h } = canvas;
    // 8 líneas verticales = columna de horas + 6 días. Si no salen todas, NO se procesa "de todos modos":
    // los días quedarían corridos y un horario equivocado podría pasar el semáforo.
    const cuad = detectarCuadricula(gris, w, h, 8);
    if ('error' in cuad) return { error: cuad.error };
    // La cuadrícula reconstruye los límites faltantes matemáticamente. Si aun así no entrega
    // las 8 líneas esperadas, no se intenta OCR con columnas desplazadas.
    if (cuad.lineas.length !== 8) {
      return { error: `No se pudo reconstruir las 6 columnas de días (líneas encontradas: ${cuad.lineas.length} de 8).` };
    }

    const avisosLectura: string[] = [];
    alAvanzar(0.02, `${etiqueta}: leyendo horas de las filas`);
    const inicios = inferirInicios(await leerInicioDeFilas(canvas, cuad));
    let basesMin: number[];
    let horasSupuestas = false;
    if (inicios) basesMin = inicios.inicios;
    else {
      basesMin = Array.from({ length: cuad.nFilas - 1 }, (_, i) => 7 * 60 + i * 60);
      horasSupuestas = true;
      avisosLectura.push('No se pudieron leer las horas de las filas; se asumió que empiezan a las 07:00. Revisa la vista previa.');
    }

    const clases: ClaseHorario[] = [];
    const umbralDeTexto = umbralTexto(gris);
    const celdas: { f: number; c: number; r: Rect }[] = [];
    for (let f = 1; f < cuad.nFilas; f++) {
      for (let c = 1; c < cuad.lineas.length - 1; c++) {
        const r = rectCelda(cuad, f, c);
        if (fraccionTinta(gris, w, r, umbralDeTexto) >= MIN_TINTA_CELDA) celdas.push({ f, c, r });
      }
    }
    const dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    for (let i = 0; i < celdas.length; i++) {
      if (cancelarRef.current) return { error: 'Cancelado' };
      const { f, c, r } = celdas[i];
      const { celda, dudosa } = await leerCeldaEscaneada(canvas, r);
      clases.push({
        materia: celda.materia ?? '',
        grupo: celda.grupo,
        dia: dias[c - 1],
        hora_inicio: aHMS(basesMin[f - 1]),
        hora_fin: aHMS(basesMin[f - 1] + 60),
        aula: celda.aula,
        dudosa: dudosa || horasSupuestas,
      });
      alAvanzar(0.05 + 0.95 * ((i + 1) / celdas.length), `${etiqueta}: celda ${i + 1} de ${celdas.length}`);
      await cedeAlNavegador();
    }

    if (!qr) {
      avisosLectura.push('No se pudo leer el QR: escribe el nombre del docente y no se puede comprobar el total de horas.');
      if (nominaDeArchivo(etiqueta)) avisosLectura.push('La nómina se tomó del nombre del archivo.');
    }
    return {
      docente: {
        id: idAleatorio(), nombreArchivo: etiqueta, origen: 'pdf-escaneado',
        docente: qr ? (limpiarNombre(qr.nombre) ?? '') : '', nomina: qr?.nomina ?? nominaDeArchivo(etiqueta) ?? 'S/N',
        horasTotales: 0, horasEsperadas: qr?.horasTotal ?? null, estado: 'ROJO', aulasDesconocidas: 0,
        clases: ordenarClases(fusionarClases(clases)), avisosLectura, advertencias: [],
      },
    };
  };

  const procesarPDF = async (
    archivo: File, alAvanzar: (f: number, msg: string) => void,
  ): Promise<{ docentes: DocenteProcesado[]; errores: string[] }> => {
    const docentesPDF: DocenteProcesado[] = [];
    const errores: string[] = [];
    // destroy() vive en la tarea de carga (no en el documento) en las versiones recientes de pdf.js
    const tarea = pdfjsLib.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
    const pdf = await tarea.promise;
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        if (cancelarRef.current) break;
        const etiqueta = pdf.numPages > 1 ? `${archivo.name} (p. ${p})` : archivo.name;
        const page = await pdf.getPage(p);
        const vp1 = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items: ItemTexto[] = (tc.items as any[])
          .filter((i) => typeof i.str === 'string')
          .map((i) => ({ str: i.str, x: i.transform[4], y: vp1.height - i.transform[5], w: i.width, h: i.height }));
        const cantidadTexto = items.reduce((n, i) => n + i.str.trim().length, 0);

        const canvas = await renderizarPagina(page);
        try {
          if (cantidadTexto >= 50) {
            const qr = leerQR(canvas);
            // PDF digital: se lee el texto tal cual, sin OCR
            const nativo = leerCuadriculaNativa(items);
            if (!nativo.ok) {
              errores.push(`${etiqueta}: el PDF tiene texto pero no el formato de horario de docente (${nativo.motivo}). ¿Es un horario de alumno?`);
              continue;
            }
            const avisosLectura = [...nativo.avisos];
            const nombre = limpiarNombre(qr?.nombre) ?? nativo.nombre ?? '';
            const nomina = qr?.nomina ?? nativo.nomina ?? 'S/N';
            if (qr && nativo.nombre && limpiarNombre(qr.nombre) !== nativo.nombre) avisosLectura.push('El nombre del QR no coincide con el del encabezado.');
            if (!qr) avisosLectura.push('No se pudo leer el QR: no se puede comprobar el total de horas.');
            docentesPDF.push({
              id: idAleatorio(), nombreArchivo: etiqueta, origen: 'pdf-digital', docente: nombre, nomina,
              horasTotales: 0, horasEsperadas: qr?.horasTotal ?? null, estado: 'ROJO', aulasDesconocidas: 0,
              clases: ordenarClases(fusionarClases(nativo.clases)), avisosLectura, advertencias: [],
              archivoOriginal: archivo,
            });
          } else {
            // Escaneo: se endereza, se lee el QR y luego cuadrícula + OCR celda por celda
            const recta = enderezar(canvas);
            try {
              const qr = leerQR(recta.canvas);
              const r = await procesarEscaneo(recta.canvas, recta.gris, qr, etiqueta, (f, msg) => alAvanzar((p - 1 + f) / pdf.numPages, msg));
              if (r.error) errores.push(`${etiqueta}: ${r.error}`);
              else if (r.docente) docentesPDF.push({ ...r.docente, archivoOriginal: archivo });
            } finally {
              recta.canvas.width = 0;
            }
          }
        } finally {
          canvas.width = 0; // libera memoria
        }
      }
    } finally {
      await tarea.destroy();
    }

    // La nómina del nombre del archivo (ZAD0099_V1.pdf) debe coincidir con la leída
    const nominaArchivo = nominaDeArchivo(archivo.name);
    if (docentesPDF.length === 1 && nominaArchivo && docentesPDF[0].nomina !== 'S/N' && docentesPDF[0].nomina !== nominaArchivo) {
      docentesPDF[0].avisosLectura.push(`La nómina leída (${docentesPDF[0].nomina}) no coincide con la del nombre del archivo (${nominaArchivo}).`);
    }
    return { docentes: docentesPDF, errores };
  };

  // -------------------------------------------------------------------------
  // Excel / CSV
  // -------------------------------------------------------------------------
  const decodificarCSV = async (archivo: File): Promise<string> => {
    const buf = await archivo.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('\uFFFD')) t = new TextDecoder('windows-1252').decode(buf); // CSV guardado desde Excel en español
    return t;
  };

  const procesarExcel = async (archivo: File): Promise<{ docentes: DocenteProcesado[]; errores: string[] }> => {
    const esCSV = archivo.name.toLowerCase().endsWith('.csv');
    const libro = esCSV
      ? XLSX.read(await decodificarCSV(archivo), { type: 'string' })
      : XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: 'array' });

    const docentesXLS: DocenteProcesado[] = [];
    const erroresHojas: string[] = [];
    for (const hoja of libro.SheetNames) {
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[hoja], { header: 1, raw: false, defval: '' });
      const r = docentesDesdeMatriz(matriz, libro.SheetNames.length > 1 ? `${archivo.name} [${hoja}]` : archivo.name);
      if (r.error) erroresHojas.push(`${archivo.name}${libro.SheetNames.length > 1 ? ` [${hoja}]` : ''}: ${r.error}`);
      docentesXLS.push(...r.docentes.map((d) => ({ ...d, clases: ordenarClases(fusionarClases(d.clases)) })));
    }
    // En libros con varias hojas, las que no son horarios no cuentan como error si alguna sí lo fue
    return { docentes: docentesXLS, errores: docentesXLS.length ? [] : erroresHojas };
  };

  // -------------------------------------------------------------------------
  // Lote
  // -------------------------------------------------------------------------
  const procesarLote = useCallback(async (archivos: File[]) => {
    cancelarRef.current = false;
    setIsProcessing(true);
    setDocentes([]);
    setErroresArchivos([]);
    setProgreso({ actual: 0, total: archivos.length, porcentaje: 0, mensaje: 'Iniciando lote...' });
    await cargarCatalogo();

    try {
      // Fila india: un archivo a la vez, para que la memoria se mantenga estable
      for (let i = 0; i < archivos.length; i++) {
        if (cancelarRef.current) break;
        const archivo = archivos[i];
        const nombre = archivo.name.toLowerCase();
        const alAvanzar = (f: number, msg: string) => avanzar(i, archivos.length, f, msg);
        alAvanzar(0, `Procesando: ${archivo.name}`);
        try {
          let r: { docentes: DocenteProcesado[]; errores: string[] };
          if (nombre.endsWith('.pdf') || archivo.type === 'application/pdf') r = await procesarPDF(archivo, alAvanzar);
          else if (/\.(xlsx|xls|csv)$/.test(nombre)) r = await procesarExcel(archivo);
          else r = { docentes: [], errores: [`${archivo.name}: formato no soportado (usa PDF, Excel o CSV)`] };

          if (r.docentes.length) setDocentes((prev) => [...prev, ...r.docentes]);
          if (r.errores.length) setErroresArchivos((prev) => [...prev, ...r.errores.map((m) => ({ archivo: archivo.name, mensaje: m }))]);
        } catch (e: any) {
          console.error(`Error procesando ${archivo.name}:`, e);
          setErroresArchivos((prev) => [...prev, { archivo: archivo.name, mensaje: `No se pudo leer el archivo: ${e?.message ?? e}` }]);
        }
        await cedeAlNavegador();
      }
      setProgreso((p) => ({ ...p, actual: archivos.length, porcentaje: 100, mensaje: cancelarRef.current ? 'Lote cancelado' : '¡Lote procesado! Revisa la vista previa.' }));
    } finally {
      if (ocrRef.current) { try { await ocrRef.current.terminate(); } catch { /* ya cerrado */ } ocrRef.current = null; }
      setIsProcessing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelar = useCallback(() => { cancelarRef.current = true; }, []);

  const limpiar = useCallback(() => {
    setDocentes([]);
    setErroresArchivos([]);
    setProgreso(PROGRESO_INICIAL);
    cacheBorradorHorarios.docentesProcesados = [];
    cacheBorradorHorarios.carreraSeleccionadaId = null;
    cacheBorradorHorarios.vistaActual = 'CARRERAS';
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CLAVE_BORRADOR);
  }, []);

  // -------------------------------------------------------------------------
  // Edición en la vista previa (cada cambio recalcula el semáforo solo)
  // -------------------------------------------------------------------------
  const modificarDocente = (id: string, fn: (d: DocenteProcesado) => DocenteProcesado) =>
    setDocentes((prev) => prev.map((d) => (d.id === id ? fn(d) : d)));

  /** Los índices de clase son los de `resultados[i].clases` (mismo orden). */
  const actualizarClase = useCallback((idDocente: string, indice: number, cambios: Partial<ClaseHorario>) =>
    modificarDocente(idDocente, (d) => {
      const clases = ordenarClases(d.clases).map((c, i) => (i === indice ? { ...c, ...cambios, dudosa: false } : c));
      return { ...d, clases: ordenarClases(clases) };
    }), []);

  const agregarClase = useCallback((idDocente: string, clase: Partial<ClaseHorario> = {}) =>
    modificarDocente(idDocente, (d) => ({
      ...d,
      clases: ordenarClases([...d.clases, { materia: '', grupo: null, dia: '', hora_inicio: '', hora_fin: '', aula: null, ...clase }]),
    })), []);

  const eliminarClase = useCallback((idDocente: string, indice: number) =>
    modificarDocente(idDocente, (d) => ({ ...d, clases: ordenarClases(d.clases).filter((_, i) => i !== indice) })), []);

  const actualizarDocente = useCallback((id: string, cambios: { docente?: string; nomina?: string }) =>
    modificarDocente(id, (d) => {
      const nombre = cambios.docente !== undefined ? (limpiarNombre(cambios.docente) ?? '') : d.docente;
      const nom = cambios.nomina !== undefined ? (limpiarTexto(cambios.nomina)?.toUpperCase().replace(/\s/g, '') ?? 'S/N') : d.nomina;
      // si el admin completó el dato que faltaba, los avisos de lectura ya no aplican
      return { ...d, docente: nombre, nomina: nom, avisosLectura: nombre ? [] : d.avisosLectura };
    }), []);

  const descartarDocente = useCallback((id: string) => setDocentes((prev) => prev.filter((d) => d.id !== id)), []);

  // -------------------------------------------------------------------------
  // Guardado: docente por docente con la función guardar_horario_docente (todo o nada por docente)
  // -------------------------------------------------------------------------
  const guardarEnBaseDeDatos = useCallback(async (idCarrera: string): Promise<ResumenGuardado> => {
    if (!idCarrera || guardandoRef.current) {
      return { guardados: 0, fallidos: 0, omitidosRojos: 0 };
    }
    guardandoRef.current = true;
    setIsSaving(true);
    const resumen: ResumenGuardado = { guardados: 0, fallidos: 0, omitidosRojos: 0 };
    const guardadosIds = new Set<string>();
    const fallos = new Map<string, string>();

    try {
      const lista = resultadosRef.current;
      for (let i = 0; i < lista.length; i++) {
        const d = lista[i];
        const tieneNombre = !!d.docente?.trim();
        const tienePdfAdjunto = !!d.archivoOriginal &&
          (d.archivoOriginal.type === 'application/pdf' || d.archivoOriginal.name.toLowerCase().endsWith('.pdf'));
        const tieneClase = d.clases.some((c) =>
          !!c.materia?.trim() &&
          !!c.dia?.trim() &&
          !!c.hora_inicio?.trim() &&
          !!c.hora_fin?.trim(),
        );
        if (!tieneNombre && !tienePdfAdjunto) {
          resumen.omitidosRojos++;
          fallos.set(d.id, 'El docente debe tener nombre o un PDF adjunto.');
          continue;
        }
        if (!tieneClase && !tienePdfAdjunto) {
          resumen.omitidosRojos++;
          fallos.set(d.id, 'El docente debe tener al menos una clase válida.');
          continue;
        }
        setProgreso({ actual: i + 1, total: lista.length, porcentaje: Math.round((i / lista.length) * 100), mensaje: `Guardando: ${d.docente}` });

        try {
          let urlHorario: string | null = null;
          const archivoPdf = d.archivoOriginal;
          const esPdf = !!archivoPdf && (
            archivoPdf.type === 'application/pdf' ||
            archivoPdf.name.toLowerCase().endsWith('.pdf')
          );
          if (esPdf && archivoPdf) {
            const nominaRuta = d.nomina && d.nomina !== 'S/N'
              ? d.nomina.replace(/[^A-Za-z0-9_-]/g, '_')
              : d.id.replace(/[^A-Za-z0-9_-]/g, '_');
            const path = `${idCarrera}/${nominaRuta}_${Date.now()}.pdf`;
            const { data: archivoSubido, error: errorSubida } = await (supabase as any)
              .storage
              .from('horarios-pdfs')
              .upload(path, archivoPdf, {
                upsert: true,
                contentType: 'application/pdf',
              });
            if (errorSubida) throw errorSubida;
            urlHorario = archivoSubido?.path ?? path;
          }

          let temporizador: ReturnType<typeof setTimeout> | null = null;
          const llamada = (supabase as any).rpc('guardar_horario_docente', {
            p_carrera_id: idCarrera,
            p_nombre: d.docente?.trim() || d.nombreArchivo.replace(/\.pdf$/i, ''),
            p_nomina: d.nomina === 'S/N' ? null : d.nomina,
            p_clases: d.clases.map((c) => ({
              materia: c.materia, grupo: c.grupo, dia: c.dia, hora_inicio: c.hora_inicio, hora_fin: c.hora_fin, aula: c.aula,
            })),
            p_url_horario: urlHorario,
          });
          const respuesta = await Promise.race([
            llamada,
            new Promise<{ error: { message: string } }>((resolve) => {
              temporizador = setTimeout(() => resolve({ error: { message: 'Tiempo de espera agotado al guardar. Intenta nuevamente.' } }), 45000);
            }),
          ]);
          if (temporizador) clearTimeout(temporizador);
          const { data, error } = respuesta as { data: any; error: any };
          if (error) {
            console.error(`Error guardando a ${d.docente}:`, error);
            fallos.set(d.id, error.message ?? 'Error desconocido');
            resumen.fallidos++;
          } else {
            if (esPdf) {
              let profesorId: string | null = null;
              if (typeof data === 'string') profesorId = data;
              else if (Array.isArray(data) && data[0]) {
                profesorId = typeof data[0] === 'string' ? data[0] : data[0].id ?? data[0].profesor_id ?? null;
              } else if (data && typeof data === 'object') {
                profesorId = data.id ?? data.profesor_id ?? null;
              }

              if (profesorId) {
                const { error: errorNombreArchivo } = await (supabase as any)
                  .from('profesores')
                  .update({ nombre_archivo: d.nombreArchivo })
                  .eq('id', profesorId);
                if (errorNombreArchivo) throw errorNombreArchivo;
              } else {
                const { error: errorNombreArchivo } = await (supabase as any)
                  .from('profesores')
                  .update({ nombre_archivo: d.nombreArchivo })
                  .eq('carrera_id', idCarrera)
                  .eq('nombre', d.docente);
                if (errorNombreArchivo) throw errorNombreArchivo;
              }
            }
            guardadosIds.add(d.id);
            resumen.guardados++;
          }
        } catch (error: any) {
          console.error(`Excepción guardando a ${d.docente}:`, error);
          fallos.set(d.id, error?.message ?? 'Error desconocido');
          resumen.fallidos++;
        }
      }
    } catch (error: any) {
      console.error('Error inesperado durante el guardado:', error);
      setProgreso((p) => ({ ...p, mensaje: `Guardado detenido: ${error?.message ?? 'Error desconocido'}` }));
    } finally {
      guardandoRef.current = false;
      // Los guardados salen de la pantalla; los que fallaron o siguen en rojo se quedan para corregirlos
      setDocentes((prev) => prev
        .filter((d) => !guardadosIds.has(d.id))
        .map((d) => (fallos.has(d.id) ? { ...d, errorGuardado: fallos.get(d.id) } : d)));
      setProgreso((p) => ({
        ...p, porcentaje: 100,
        mensaje: `Guardados con éxito: ${resumen.guardados} · Con error: ${resumen.fallidos} · Sin guardar: ${resumen.omitidosRojos}`,
      }));
      setIsSaving(false);
    }
    return resumen;
  }, []);

  return {
    // misma interfaz de antes
    procesarLote, guardarEnBaseDeDatos, isProcessing, isSaving, progreso, resultados,
    // nuevo
    cancelar, limpiar, erroresArchivos, aulasPendientes, confirmarAula, corregirAula,
    actualizarDocente, actualizarClase, agregarClase, eliminarClase, descartarDocente,
  };
};
