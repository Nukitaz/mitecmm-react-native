import { ClaseHorario, DocenteProcesado } from './tipos';
import {
  idAleatorio, limpiarNombre, limpiarTexto, normalizarAula, normalizarDia, parseHora, parseRangoHora, sinAcentos,
} from './normalizar';

type Campo = 'docente' | 'nomina' | 'materia' | 'grupo' | 'dia' | 'hora_inicio' | 'hora_fin' | 'hora' | 'aula';

// Se evalúan en este orden; cada columna se asigna a un solo campo.
const SINONIMOS: [Campo, string[][]][] = [
  ['hora_inicio', [['hora', 'inicio'], ['inicio'], ['desde'], ['entrada']]],
  ['hora_fin', [['hora', 'fin'], ['fin'], ['hasta'], ['salida'], ['termino']]],
  ['nomina', [['nomina'], ['clave', 'docente'], ['num', 'empleado'], ['no', 'empleado']]],
  ['docente', [['docente'], ['profesor'], ['maestro'], ['catedratico'], ['nombre']]],
  ['materia', [['materia'], ['asignatura'], ['curso'], ['clase']]],
  ['grupo', [['grupo'], ['seccion']]],
  ['dia', [['dia'], ['dias']]],
  ['aula', [['aula'], ['salon'], ['espacio']]],
  ['hora', [['hora'], ['horario']]],
];

function palabras(h: unknown): string[] {
  return sinAcentos(String(h ?? '')).toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim().split(' ').filter(Boolean);
}

function mapearColumnas(encabezados: unknown[]): Partial<Record<Campo, number>> {
  const mapa: Partial<Record<Campo, number>> = {};
  const usadas = new Set<number>();
  for (const [campo, frases] of SINONIMOS) {
    // primero coincidencia exacta de la frase completa, luego "contiene todas las palabras"
    let idx = encabezados.findIndex((h, i) => !usadas.has(i) && frases.some((f) => palabras(h).join(' ') === f.join(' ')));
    if (idx < 0) idx = encabezados.findIndex((h, i) => !usadas.has(i) && frases.some((f) => f.every((p) => palabras(h).includes(p))));
    if (idx >= 0) { mapa[campo] = idx; usadas.add(idx); }
  }
  return mapa;
}

export interface ResultadoExcel {
  docentes: DocenteProcesado[];
  error?: string;
}

/** Interpreta una hoja (matriz de celdas) donde cada fila es una clase. */
export function docentesDesdeMatriz(matriz: unknown[][], nombreArchivo: string): ResultadoExcel {
  // El encabezado puede no estar en la primera fila: se busca entre las primeras 15.
  let filaEnc = -1;
  let mapa: Partial<Record<Campo, number>> = {};
  for (let i = 0; i < Math.min(15, matriz.length); i++) {
    const m = mapearColumnas(matriz[i]);
    if (Object.keys(m).length >= 4 && Object.keys(m).length > Object.keys(mapa).length) { filaEnc = i; mapa = m; }
  }
  if (filaEnc < 0) {
    const vistos = (matriz[0] ?? []).map((c) => String(c)).filter(Boolean).slice(0, 12).join(', ');
    return { docentes: [], error: `No reconocí las columnas. Encabezados vistos: ${vistos || '(ninguno)'}` };
  }
  const faltan: string[] = [];
  if (mapa.docente == null) faltan.push('docente');
  if (mapa.materia == null) faltan.push('materia');
  if (mapa.dia == null) faltan.push('día');
  if (mapa.hora == null && (mapa.hora_inicio == null || mapa.hora_fin == null)) faltan.push('hora (inicio y fin)');
  if (faltan.length) return { docentes: [], error: `Faltan columnas: ${faltan.join(', ')}` };

  const celda = (fila: unknown[], campo: Campo) => (mapa[campo] != null ? fila[mapa[campo]!] : undefined);
  const grupos = new Map<string, DocenteProcesado>();

  for (let i = filaEnc + 1; i < matriz.length; i++) {
    const fila = matriz[i];
    if (!fila || fila.every((c) => limpiarTexto(c) == null)) continue;
    const nombre = limpiarNombre(celda(fila, 'docente'));
    if (!nombre) continue;
    const nominaTxt = limpiarTexto(celda(fila, 'nomina'))?.toUpperCase().replace(/\s/g, '');
    const nomina = nominaTxt || 'S/N';
    const clave = nomina !== 'S/N' ? `N:${nomina}` : `T:${nombre}`;

    if (!grupos.has(clave)) {
      grupos.set(clave, {
        id: idAleatorio(), nombreArchivo, origen: 'excel', docente: nombre, nomina,
        horasTotales: 0, horasEsperadas: null, estado: 'VERDE', aulasDesconocidas: 0,
        clases: [], avisosLectura: [], advertencias: [],
      });
    }

    let ini: string | null = null;
    let fin: string | null = null;
    if (mapa.hora_inicio != null && mapa.hora_fin != null) {
      ini = parseHora(celda(fila, 'hora_inicio'));
      fin = parseHora(celda(fila, 'hora_fin'));
    } else {
      const r = parseRangoHora(celda(fila, 'hora'));
      if (r) [ini, fin] = r;
    }
    const dia = normalizarDia(celda(fila, 'dia'));
    const clase: ClaseHorario = {
      materia: limpiarNombre(celda(fila, 'materia')) ?? '',
      grupo: limpiarTexto(celda(fila, 'grupo'))?.toUpperCase() ?? null,
      // Si no se entiende, se deja vacío: evaluar() lo marca en rojo (nunca se inventa un valor).
      dia: dia ?? String(celda(fila, 'dia') ?? ''),
      hora_inicio: ini ?? String(celda(fila, 'hora_inicio') ?? celda(fila, 'hora') ?? ''),
      hora_fin: fin ?? String(celda(fila, 'hora_fin') ?? ''),
      aula: normalizarAula(celda(fila, 'aula'), false),
    };
    grupos.get(clave)!.clases.push(clase);
  }
  return { docentes: [...grupos.values()] };
}
