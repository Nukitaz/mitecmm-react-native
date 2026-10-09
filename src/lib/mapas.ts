// Imagen por defecto o mapa general (puedes ajustar el link por una imagen local o remota)
export const MAPA_GENERAL = "https://via.placeholder.com/800x600";

/**
 * Función para obtener la URL de la imagen/SVG del plano de cada planta de un edificio.
 */
export const getPlantaUrl = (edificioId: string, planta: "baja" | "alta"): string => {
  // Ajusta las rutas según donde tengas tus recursos de imagenes/mapas
  return `https://via.placeholder.com/800x600?text=${edificioId}_${planta}`;
};
