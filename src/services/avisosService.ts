import { supabase } from "../integrations/supabase/client";
import { log } from "../utils/log";

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
      .select("id,titulo,contenido,fecha_publicacion,es_urgente,subtitulo")
      .order("fecha_publicacion", { ascending: false });

    if (error) {
      log.error("Error al consultar avisos:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    log.error("Error en servicio de avisos:", err);
    return [];
  }
}
