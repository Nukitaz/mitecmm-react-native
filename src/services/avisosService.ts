import { supabase } from '../integrations/supabase/client';

// 1. Exportamos la interfaz que espera AvisosBanner
export interface Aviso {
  id: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  created_at?: string;
}

// 2. Exportamos la función individual que necesita AvisosBanner
export async function fetchAvisos(): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('avisos')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Error al obtener avisos públicos:", error);
    return [];
  }
  return data || [];
}

// 3. Mantenemos la estructura avisosService intacta para que tu Panel Admin siga funcionando
export const avisosService = {
  async getAvisos() {
    return fetchAvisos();
  },

  async createAviso(aviso: { categoria: string; titulo: string; fecha: string; descripcion: string }) {
    const { data, error } = await supabase.from('avisos').insert([aviso]).select();
    if (error) throw error;
    return data[0];
  },

  async updateAviso(id: string, aviso: { categoria: string; titulo: string; fecha: string; descripcion: string }) {
    const { data, error } = await supabase.from('avisos').update(aviso).eq('id', id).select();
    if (error) throw error;
    return data[0];
  },

  async deleteAviso(id: string) {
    const { error } = await supabase.from('avisos').delete().eq('id', id);
    if (error) throw error;
  }
};