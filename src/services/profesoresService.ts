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

export async function obtenerProfesores(busqueda: string = ""): Promise<HorarioDocente[]> {
  try {
    const q = busqueda.trim();

    // Si no hay búsqueda, traemos todas las clases uniendo la tabla de docentes
    if (!q) {
      const { data, error } = await supabase
        .from("clases")
        .select(`
          id, materia, grupo, dia, hora_inicio, hora_fin, aula,
          docentes (nombre)
        `);
      
      if (error) throw error;
      return formatearDatos(data);
    }

    // Consulta relacional filtrando por materia, grupo, aula o el nombre del docente vinculado
    const { data, error } = await supabase
      .from("clases")
      .select(`
        id, materia, grupo, dia, hora_inicio, hora_fin, aula,
        docentes!inner (nombre)
      `)
      .or(`materia.ilike.%${q}%,aula.ilike.%${q}%,grupo.ilike.%${q}%,docentes.nombre.ilike.%${q}%`);

    if (error) {
      console.error("Error en consulta relacional:", error.message);
      return [];
    }

    return formatearDatos(data);
  } catch (err) {
    console.error("Error en servicio de profesores:", err);
    return [];
  }
}

// Convierte la respuesta relacional anidada de Supabase al formato plano que espera tu UI
function formatearDatos(data: any[] | null): HorarioDocente[] {
  if (!data) return [];
  return data.map((item) => ({
    id: item.id.toString(),
    docente: item.docentes?.nombre || "Sin Asignar",
    materia: item.materia,
    grupo: item.grupo || "",
    dia: item.dia,
    hora_inicio: item.hora_inicio,
    hora_fin: item.hora_fin,
    aula: item.aula || "",
  }));
}