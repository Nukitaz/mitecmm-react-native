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
  carrera?: string;
}

// Descarga el catálogo de carreras para los botones de la interfaz
export async function obtenerCarreras(): Promise<string[]> {
  const { data, error } = await supabase.from("carreras").select("nombre").order("nombre");
  if (error) {
    console.error("Error al obtener carreras:", error.message);
    return ["TODAS"];
  }
  return ["TODAS", ...data.map(c => c.nombre)];
}

export async function obtenerProfesores(busqueda: string = ""): Promise<HorarioDocente[]> {
  try {
    const q = busqueda.trim();

    // Consulta principal con triple relación (Clases -> Docentes -> Carreras)
    if (!q) {
      const { data, error } = await supabase
        .from("clases")
        .select(`
          id, materia, grupo, dia, hora_inicio, hora_fin, aula,
          docentes (
            nombre,
            carreras (nombre)
          )
        `);
      
      if (error) throw error;
      return formatearDatos(data);
    }

    // Consulta con búsqueda por texto
    const { data, error } = await supabase
      .from("clases")
      .select(`
        id, materia, grupo, dia, hora_inicio, hora_fin, aula,
        docentes!inner (
          nombre,
          carreras (nombre)
        )
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

// Aplana los datos anidados para que la tarjeta de React Native los pueda leer
function formatearDatos(data: any[] | null): HorarioDocente[] {
  if (!data) return [];
  return data.map((item) => ({
    id: item.id.toString(),
    docente: item.docentes?.nombre || "Sin Asignar",
    carrera: item.docentes?.carreras?.nombre || "SIN CARRERA",
    materia: item.materia,
    grupo: item.grupo || "",
    dia: item.dia,
    hora_inicio: item.hora_inicio,
    hora_fin: item.hora_fin,
    aula: item.aula || "",
  }));
}