import { getPlantaUrl } from "../lib/mapas";

export interface EdificioConfig {
  id: string;
  label: string;
  nombre: string;
  /** Hotspot en % sobre el viewBox del mapa general (mapeado al id del SVG) */
  hotspot: { left: number; top: number; width: number; height: number };
  plantas: { baja?: string; alta?: string };
}

const make = (
  id: string,
  nombre: string,
  hotspot: EdificioConfig["hotspot"],
  plantas: { baja?: boolean; alta?: boolean } = { baja: true, alta: true },
): EdificioConfig => ({
  id,
  label: id.toUpperCase(),
  nombre,
  hotspot,
  plantas: {
    baja: plantas.baja ? getPlantaUrl(id, "baja") : undefined,
    alta: plantas.alta ? getPlantaUrl(id, "alta") : undefined,
  },
});

// Coordenadas extraídas directamente de los <rect id="..."> del mapa_general.svg
export const EDIFICIOS: EdificioConfig[] = [
  make("a", "Edificio A", { left: 56.63, top: 44.17, width: 12.70, height: 9.26 }),
  make("b", "Edificio B", { left: 63.91, top: 86.11, width: 12.79, height: 9.92 }),
  make("em", "Edificio EM", { left: 69.00, top: 64.12, width: 12.42, height: 10.37 }),
  make("i", "Edificio I", { left: 45.65, top: 70.86, width: 12.42, height: 8.39 }),
  make("p", "Edificio P", { left: 20.05, top: 46.62, width: 12.82, height: 9.30 }),
  make("l", "Edificio L", { left: 39.07, top: 46.42, width: 8.66, height: 9.70 }),
];

export const getEdificio = (id: string) =>
  EDIFICIOS.find((e) => e.id === id.toLowerCase());
