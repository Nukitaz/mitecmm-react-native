import { supabase } from "../integrations/supabase/client";
import { log } from "../utils/log";

export interface HorarioDocente {
  id: string;
  docente: string;
  materia: string;
  grupo?: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
  carrera?: string;
}

/** Solo las columnas que usa la interfaz (no se exponen campos internos). */
const COLUMNAS = `
  id, materia, grupo, dia, hora_inicio, hora_fin, aula,
  profesores (
    nombre,
    carreras (nombre)
  )
`;

/** Igual que COLUMNAS, pero exige que el horario tenga profesor (para filtrar por su nombre). */
const COLUMNAS_CON_PROFESOR = `
  id, materia, grupo, dia, hora_inicio, hora_fin, aula,
  profesores!inner (
    nombre,
    carreras (nombre)
  )
`;

/**
 * Limpia el término de búsqueda para el filtro .or() de PostgREST:
 * comas, paréntesis, puntos, comillas, % y * alteran la sintaxis del filtro.
 */
export function limpiarTerminoBusqueda(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} _-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// Descarga el catálogo de carreras para los botones de la interfaz
export async function obtenerCarreras(): Promise<string[]> {
  const { data, error } = await supabase.from("carreras").select("nombre").order("nombre");
  if (error) {
    log.error("Error al obtener carreras:", error.message);
    return ["TODAS"];
  }
  return ["TODAS", ...(data || []).map((c) => c.nombre)];
}

export async function obtenerProfesores(busqueda: string = ""): Promise<HorarioDocente[]> {
  try {
    const q = limpiarTerminoBusqueda(busqueda);

    // Consulta principal con triple relación (Horarios -> Profesores -> Carreras)
    if (!q) {
      const { data, error } = await supabase.from("horarios").select(COLUMNAS);
      if (error) {
        log.error("Error al consultar horarios:", error.message);
        return [];
      }
      return formatearDatos(data);
    }

    // Consulta con búsqueda por texto (q ya no trae caracteres de la sintaxis de PostgREST)
    const { data, error } = await supabase
      .from("horarios")
      .select(COLUMNAS_CON_PROFESOR)
      .or(`materia.ilike.%${q}%,aula.ilike.%${q}%,grupo.ilike.%${q}%,profesores.nombre.ilike.%${q}%`);

    if (error) {
      log.error("Error en consulta relacional:", error.message);
      return [];
    }

    return formatearDatos(data);
  } catch (err) {
    log.error("Error en servicio de profesores:", err);
    return [];
  }
}

// Aplana los datos anidados leyendo desde 'profesores' en lugar de 'docentes'
function formatearDatos(data: any[] | null): HorarioDocente[] {
  if (!data) return [];
  return data.map((item) => ({
    id: String(item.id),
    docente: item.profesores?.nombre || "Sin Asignar",
    carrera: item.profesores?.carreras?.nombre || "SIN CARRERA",
    materia: item.materia ?? "",
    grupo: item.grupo || "",
    dia: item.dia ?? "",
    hora_inicio: item.hora_inicio ?? "",
    hora_fin: item.hora_fin ?? "",
    aula: item.aula || "",
  }));
}
