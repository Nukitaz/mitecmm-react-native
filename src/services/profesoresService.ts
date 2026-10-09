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
    let query = supabase.from("horarios_docentes").select("*");

    if (busqueda.trim()) {
      const q = busqueda.trim();
      query = query.or(
        `docente.ilike.%${q}%,materia.ilike.%${q}%,aula.ilike.%${q}%,grupo.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

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
