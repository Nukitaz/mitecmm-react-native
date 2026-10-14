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
  origen_pdf?: string;
  ultima_modificacion?: string;
}

export async function obtenerProfesores(busqueda: string = ""): Promise<HorarioDocente[]> {
  try {
    if (!busqueda.trim()) {
      const { data, error } = await supabase.from("horarios_docentes").select("*");
      if (error) console.error("Error al consultar horarios_docentes:", error.message);
      return data || [];
    }

    const q = busqueda.trim();

    // Intentar primero usando la función RPC de Supabase si existe
    const { data: rpcData, error: rpcError } = await supabase.rpc("buscar_docentes_v3", {
      search_term: q,
    });

    if (!rpcError && rpcData) {
      return rpcData;
    }

    // Fallback con consulta or/ilike directa
    const { data, error } = await supabase
      .from("horarios_docentes")
      .select("*")
      .or(`docente.ilike.%${q}%,materia.ilike.%${q}%,aula.ilike.%${q}%,grupo.ilike.%${q}%`);

    if (error) {
      console.error("Error al consultar horarios_docentes:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error en servicio de profesores:", err);
    return [];
  }
}