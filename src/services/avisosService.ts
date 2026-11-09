import { supabase } from "../integrations/supabase/client";
import { log } from "../utils/log";

// 1. Exportamos la interfaz que espera AvisosBanner
export interface Aviso {
  id: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  created_at?: string;
}

type AvisoEditable = Pick<Aviso, "categoria" | "titulo" | "fecha" | "descripcion">;

/** Solo las columnas que usa la interfaz. */
const COLUMNAS = "id,categoria,titulo,descripcion,fecha,created_at";

// 2. Exportamos la función individual que necesita AvisosBanner
export async function fetchAvisos(): Promise<Aviso[]> {
  try {
    const { data, error } = await supabase
      .from("avisos")
      .select(COLUMNAS)
      .order("created_at", { ascending: false });

    if (error) {
      log.error("Error al obtener avisos públicos:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    log.error("Error en servicio de avisos:", err);
    return [];
  }
}

// 3. Mantenemos la estructura avisosService intacta para que el Panel Admin siga funcionando
export const avisosService = {
  async getAvisos() {
    return fetchAvisos();
  },

  async createAviso(aviso: AvisoEditable) {
    const { data, error } = await supabase.from("avisos").insert([aviso]).select(COLUMNAS);
    if (error) throw error;
    return data[0];
  },

  async updateAviso(id: string, aviso: AvisoEditable) {
    const { data, error } = await supabase.from("avisos").update(aviso).eq("id", id).select(COLUMNAS);
    if (error) throw error;
    return data[0];
  },

  async deleteAviso(id: string) {
    const { error } = await supabase.from("avisos").delete().eq("id", id);
    if (error) throw error;
  },
};
