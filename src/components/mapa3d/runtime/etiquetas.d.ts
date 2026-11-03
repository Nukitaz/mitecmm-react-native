/** Tipos de src/components/mapa3d/runtime/etiquetas.js (fuente única de etiquetas). */
export type TipoServicio = "restroom" | "medical" | "security" | "stairs" | "electric";

/** Icono de servicio (naranja) o null si es un espacio normal. */
export function tipoServicio(id: string): TipoServicio | null;

/** Texto de la etiqueta 3D: categoría (línea superior) y código/nombre corto. */
export function etiqueta(id: string): { categoria: string; codigo: string };

/** Nombre legible para personas: "Aula A3", "Laboratorio de redes (LR)". */
export function nombreLegible(id: string): string;

/** ¿El elemento SVG (nombre de etiqueta + ID) es un espacio del edificio? */
export function esEspacio(etiquetaSvg: string, id: string): boolean;

/** ¿El ID tiene prefijo de espacio de servicio (sanitario_, escalera_…)? */
export function esIdServicio(id: string): boolean;
