/**
 * Servicio para procesar y normalizar geometrías 2D de planos SVG a modelos 3D.
 */

export interface Room3D {
  id: string;
  name: string;
  x: number; // Coordenada X normalizada en el espacio 3D
  z: number; // Coordenada Z normalizada en el espacio 3D
  width: number;
  depth: number;
  height: number;
  color?: string;
  isSpecial?: boolean;
}

export interface Floor3DData {
  edificioId: string;
  planta: "baja" | "alta";
  bounds: {
    width: number;
    depth: number;
    centerX: number;
    centerZ: number;
  };
  rooms: Room3D[];
}

/** Formatea nombres técnicos de aulas a etiquetas legibles */
export function formatRoomLabel(rawId: string): string {
  if (!rawId) return "";
  let clean = rawId
    .replace(/^aula_/i, "Aula ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Acrónimos comunes
  const acronyms: Record<string, string> = {
    Lti: "LTI",
    Lr: "LR",
    Lds: "LDS",
    Lis: "LIS",
    Let: "LET",
    Lia: "LIA",
    Lcs: "LCS",
    Lacd: "LACD",
    Lwi: "LWI",
    Cb1: "CB1",
    Cb2: "CB2",
    Cb3: "CB3",
    Cb4: "CB4",
    Cb5: "CB5",
    Cb6: "CB6",
    Cb7: "CB7",
    Cb8: "CB8",
    Cb9: "CB9",
    Cb10: "CB10",
    Cb11: "CB11",
    Lc1: "LC1",
    Lc2: "LC2",
    I1: "I1",
    I2: "I2",
    I3: "I3",
    I4: "I4",
    I5: "I5",
    I6: "I6",
    I7: "I7",
    A1: "A1",
    A2: "A2",
    A3: "A3",
    A4: "A4",
    A5: "A5",
    A6: "A6",
    A7: "A7",
    A8: "A8",
  };

  Object.entries(acronyms).forEach(([k, v]) => {
    clean = clean.replace(new RegExp(`\\b${k}\\b`, "g"), v);
  });

  return clean;
}

export type ServiceType = "restroom" | "medical" | "security" | "stairs" | "electric" | "standard";

export function getServiceType(rawId: string): ServiceType {
  const lower = (rawId || "").toLowerCase();
  if (lower.includes("bano") || lower.includes("sanitario") || lower.includes("wc")) return "restroom";
  if (lower.includes("medico") || lower.includes("consultorio")) return "medical";
  if (lower.includes("vigilancia") || lower.includes("paqueteria")) return "security";
  if (lower.includes("escalera")) return "stairs";
  if (lower.includes("carga") || lower.includes("mantenimiento")) return "electric";
  return "standard";
}

export function isServiceRoom(rawId: string): boolean {
  return getServiceType(rawId) !== "standard";
}

export function getRoomShortCode(rawId: string): string {
  const label = formatRoomLabel(rawId);
  // Si tiene formato Aula X, devolver X
  const aulaMatch = label.match(/Aula\s+([A-Za-z0-9]+)/i);
  if (aulaMatch) return aulaMatch[1].toUpperCase();

  // Si tiene siglas entre paréntesis o al final
  const siglaMatch = label.match(/\b([A-Z0-9]{2,6})\b/);
  if (siglaMatch) return siglaMatch[1];

  // Si es corto, devolver directo
  if (label.length <= 8) return label.toUpperCase();

  // Primeras palabras truncadas
  const words = label.split(" ");
  if (words.length >= 2) return `${words[0].slice(0, 4)} ${words[1].slice(0, 3)}`.toUpperCase();
  return label.slice(0, 7).toUpperCase();
}

