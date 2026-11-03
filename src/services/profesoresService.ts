import { supabase } from "../integrations/supabase/client";

export interface HorarioDocente {
  id: string;
  docente: string;
  materia: string;
  grupo?: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

/** Solo las columnas que usa la interfaz (no se exponen campos internos). */
const COLUMNAS = "id,docente,materia,grupo,dia,hora_inicio,hora_fin,aula";

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

/** Proyecta cada fila a las columnas públicas (la RPC podría devolver más). */
function aHorario(fila: any): HorarioDocente {
  return {
    id: String(fila.id),
    docente: fila.docente ?? "",
    materia: fila.materia ?? "",
    grupo: fila.grupo ?? undefined,
    dia: fila.dia ?? "",
    hora_inicio: fila.hora_inicio ?? "",
    hora_fin: fila.hora_fin ?? "",
    aula: fila.aula ?? "",
  };
}

export async function obtenerProfesores(busqueda: string = ""): Promise<HorarioDocente[]> {
  try {
    const q = limpiarTerminoBusqueda(busqueda);

    if (!q) {
      const { data, error } = await supabase.from("horarios_docentes").select(COLUMNAS);
      if (error) console.error("Error al consultar horarios_docentes:", error.message);
      return (data || []).map(aHorario);
    }

    // Intentar primero usando la función RPC de Supabase si existe
    const { data: rpcData, error: rpcError } = await supabase.rpc("buscar_docentes_v3", {
      search_term: q,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map(aHorario);
    }

    // Fallback con consulta or/ilike directa
    const { data, error } = await supabase
      .from("horarios_docentes")
      .select(COLUMNAS)
      .or(`docente.ilike.%${q}%,materia.ilike.%${q}%,aula.ilike.%${q}%,grupo.ilike.%${q}%`);

    if (error) {
      console.error("Error al consultar horarios_docentes:", error.message);
      return [];
    }

    return (data || []).map(aHorario);
  } catch (err) {
    console.error("Error en servicio de profesores:", err);
    return [];
  }
}