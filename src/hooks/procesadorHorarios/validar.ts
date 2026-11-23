import { ClaseHorario, DocenteProcesado, EstadoSemaforo, AulaPendiente } from './tipos';
import { DIAS, levenshtein, minutos } from './normalizar';

const HMS = /^\d{2}:\d{2}:\d{2}$/;

/** Orden estable: por día y por hora de inicio. */
export function ordenarClases(clases: ClaseHorario[]): ClaseHorario[] {
  return [...clases].sort(
    (a, b) =>
      DIAS.indexOf(a.dia as never) - DIAS.indexOf(b.dia as never) ||
      a.hora_inicio.localeCompare(b.hora_inicio),
  );
}

/** Une horas consecutivas de la misma materia, grupo y aula en un solo bloque. */
export function fusionarClases(clases: ClaseHorario[]): ClaseHorario[] {
  const orden = ordenarClases(clases);
  const out: ClaseHorario[] = [];
  for (const c of orden) {
    const prev = out[out.length - 1];
    if (
      prev && prev.dia === c.dia && prev.hora_fin === c.hora_inicio && HMS.test(c.hora_inicio) &&
      prev.materia === c.materia && prev.grupo === c.grupo && prev.aula === c.aula
    ) {
      prev.hora_fin = c.hora_fin;
      prev.dudosa = !!(prev.dudosa || c.dudosa);
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

function claveDocente(d: DocenteProcesado): string {
  return d.nomina !== 'S/N' ? `N:${d.nomina}` : `T:${d.docente}`;
}

/**
 * Calcula problemas, avisos, horas y semáforo de un docente. No modifica `d`.
 *   ROJO     -> hay algo que impide guardar (o faltan horas respecto al TOTAL)
 *   AMARILLO -> se puede guardar, pero conviene revisar
 *   VERDE    -> el total cuadra y no hay dudas
 */
export function evaluar(
  d: DocenteProcesado,
  aulasConocidas: Set<string>,
  duplicados: Set<string> = new Set(),
): DocenteProcesado {
  const clases: ClaseHorario[] = ordenarClases(d.clases).map((c) => ({ ...c, problemas: [], avisos: [] }));

  const desconocidas = new Set<string>();
  let horas = 0;

  for (const c of clases) {
    const p = c.problemas!;
    const a = c.avisos!;
    if (!c.materia.trim()) p.push('Falta la materia');
    if (!DIAS.includes(c.dia as never)) p.push('Día inválido');
    const horaOk = HMS.test(c.hora_inicio) && HMS.test(c.hora_fin);
    if (!horaOk) p.push('Hora inválida');
    else if (minutos(c.hora_fin) <= minutos(c.hora_inicio)) p.push('La hora fin no es posterior al inicio');
    else horas += (minutos(c.hora_fin) - minutos(c.hora_inicio)) / 60;

    if (c.dudosa) a.push('Lectura dudosa');
    if (!c.aula) a.push('Sin aula');
    else if (d.origen === 'pdf-escaneado' && !aulasConocidas.has(c.aula)) {
      a.push(`Aula sin confirmar: ${c.aula}`);
      desconocidas.add(c.aula);
    }
  }

  // Escaneos: una materia casi igual a otra más repetida del mismo docente suele ser un error de OCR
  if (d.origen === 'pdf-escaneado') {
    const cuenta = new Map<string, number>();
    for (const c of clases) if (c.materia) cuenta.set(c.materia, (cuenta.get(c.materia) ?? 0) + 1);
    for (const c of clases) {
      const n = cuenta.get(c.materia) ?? 0;
      for (const [otra, m] of cuenta) {
        if (otra !== c.materia && m > n && levenshtein(c.materia, otra) <= Math.max(2, Math.round(otra.length * 0.2))) {
          c.avisos!.push(`Materia parecida a "${otra}"`);
          break;
        }
      }
    }
  }

  // Empalmes entre clases del mismo día
  for (let i = 0; i < clases.length; i++) {
    for (let j = i + 1; j < clases.length; j++) {
      const x = clases[i];
      const y = clases[j];
      if (x.dia !== y.dia || x.problemas!.some((m) => m.startsWith('Hora')) || y.problemas!.some((m) => m.startsWith('Hora'))) continue;
      if (minutos(y.hora_inicio) < minutos(x.hora_fin) && minutos(x.hora_inicio) < minutos(y.hora_fin)) {
        x.problemas!.push(`Empalme con ${y.materia}`);
        y.problemas!.push(`Empalme con ${x.materia}`);
      }
    }
  }

  horas = Math.round(horas * 100) / 100;
  const advertencias = [...d.avisosLectura];
  const conProblemas = clases.filter((c) => c.problemas!.length > 0).length;
  const conAvisos = clases.filter((c) => c.avisos!.length > 0).length;

  let rojo = false;
  if (!d.docente.trim()) { advertencias.push('Falta el nombre del docente'); rojo = true; }
  if (clases.length === 0) { advertencias.push('No se leyó ninguna clase'); rojo = true; }
  if (conProblemas > 0) { advertencias.push(`${conProblemas} clase(s) con errores que hay que corregir`); rojo = true; }
  if (d.horasEsperadas != null && horas !== d.horasEsperadas) {
    advertencias.push(`Horas leídas (${horas}) distintas al TOTAL del documento (${d.horasEsperadas})`);
    rojo = true;
  }
  if (conAvisos > 0) advertencias.push(`${conAvisos} clase(s) por revisar`);
  if (duplicados.has(claveDocente(d))) advertencias.push('Este docente aparece en más de un archivo del lote; se guardará el último');

  const estado: EstadoSemaforo = rojo ? 'ROJO' : conAvisos > 0 || d.avisosLectura.length > 0 ? 'AMARILLO' : 'VERDE';
  return { ...d, clases, horasTotales: horas, aulasDesconocidas: desconocidas.size, estado, advertencias };
}

export function evaluarLote(lista: DocenteProcesado[], aulasConocidas: Set<string>): DocenteProcesado[] {
  const cuenta = new Map<string, number>();
  for (const d of lista) cuenta.set(claveDocente(d), (cuenta.get(claveDocente(d)) ?? 0) + 1);
  const duplicados = new Set([...cuenta].filter(([, n]) => n > 1).map(([k]) => k));
  return lista.map((d) => evaluar(d, aulasConocidas, duplicados));
}

/** Aulas de escaneos que el catálogo no conoce, con cuántas veces salen y una sugerencia. */
export function calcularAulasPendientes(lista: DocenteProcesado[], aulasConocidas: Set<string>): AulaPendiente[] {
  const veces = new Map<string, number>();
  for (const d of lista) {
    if (d.origen !== 'pdf-escaneado') continue;
    for (const c of d.clases) if (c.aula && !aulasConocidas.has(c.aula)) veces.set(c.aula, (veces.get(c.aula) ?? 0) + 1);
  }
  // Candidatas para sugerir: aulas conocidas + las que más se repiten en este lote
  const frecuentes = [...veces].filter(([, n]) => n >= 2).map(([a]) => a);
  const candidatas = [...new Set([...aulasConocidas, ...frecuentes])];

  return [...veces]
    .map(([aula, n]) => {
      let mejor: string | null = null;
      let mejorDist = Infinity;
      for (const c of candidatas) {
        if (c === aula) continue;
        const dist = levenshtein(aula, c);
        const tope = c.length >= 8 ? 2 : 1;
        const masFrecuente = (veces.get(c) ?? Infinity) > n; // conocidas cuentan como "infinitas"
        if (dist <= tope && masFrecuente && dist < mejorDist) { mejor = c; mejorDist = dist; }
      }
      return { aula, veces: n, sugerencia: mejor };
    })
    .sort((a, b) => b.veces - a.veces);
}
