import { supabase } from "../integrations/supabase/client";

export interface Aviso {
  id: string;
  titulo: string;
  contenido?: string;
  fecha_publicacion: string;
  es_urgente: boolean;
  subtitulo?: string;
}

export async function fetchAvisos(): Promise<Aviso[]> {
  try {
    const { data, error } = await supabase
      .from("avisos")
      .select("*")
      .order("fecha_publicacion", { ascending: false });

    if (error) {
      console.error("Error al consultar avisos:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error en servicio de avisos:", err);
    return [];
  }
}
