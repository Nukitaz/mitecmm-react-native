import { supabase } from "../integrations/supabase/client";

const BUCKET_NAME = "Maps";

/**
 * Obtiene la URL pública del mapa general del campus.
 */
export function getMapaGeneralUrl(): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl("mapa_general.svg");
  return data.publicUrl;
}

/**
 * Obtiene la URL pública del plano de un edificio según la planta (baja o alta) y su ID (a, b, em, i, l, p, etc.).
 */
export function getPlanoEdificioUrl(
  edificioId: string,
  planta: "baja" | "alta"
): string {
  const idClean = edificioId.toLowerCase().trim();
  const fileName = `planta_${planta}_edificio_${idClean}.svg`;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return data.publicUrl;
}
