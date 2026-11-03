import { supabase } from "../integrations/supabase/client";
import { sanitizarSvg } from "../utils/svgSanitizer";

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

/** Motivo por el que no se pudo obtener un plano (para mostrar un mensaje claro). */
export type ErrorPlano = "no_existe" | "red" | "tiempo" | "invalido";

export class PlanoError extends Error {
  readonly motivo: ErrorPlano;
  constructor(motivo: ErrorPlano) {
    super(motivo);
    this.motivo = motivo;
  }
}

const TIEMPO_MAXIMO_MS = 15000;

/**
 * Descarga un plano SVG, verifica la respuesta y lo devuelve saneado.
 * - Lanza PlanoError("no_existe") si el servidor responde 4xx (p. ej. 404/400 de Storage).
 * - Lanza PlanoError("red") si no hay conexión o el servidor falla (5xx).
 * - Lanza PlanoError("tiempo") si tarda más de 15 s.
 * - Lanza PlanoError("invalido") si el contenido no es un SVG válido.
 * Se cancela con `signal` (p. ej. al cambiar de edificio) sin lanzar errores visibles.
 */
export async function descargarPlanoSvg(url: string, signal?: AbortSignal): Promise<string> {
  const control = new AbortController();
  let porTiempo = false;
  const temporizador = setTimeout(() => {
    porTiempo = true;
    control.abort();
  }, TIEMPO_MAXIMO_MS);
  const alCancelar = () => control.abort();
  signal?.addEventListener("abort", alCancelar);

  try {
    let respuesta: Response;
    try {
      respuesta = await fetch(url, { signal: control.signal });
    } catch (e) {
      if (signal?.aborted) throw e; // cancelación intencional: la ignora quien llama
      throw new PlanoError(porTiempo ? "tiempo" : "red");
    }
    if (!respuesta.ok) {
      throw new PlanoError(respuesta.status >= 400 && respuesta.status < 500 ? "no_existe" : "red");
    }
    const limpio = sanitizarSvg(await respuesta.text());
    if (!limpio) throw new PlanoError("invalido");
    return limpio;
  } finally {
    clearTimeout(temporizador);
    signal?.removeEventListener("abort", alCancelar);
  }
}

/** Mensajes para el usuario según el motivo del error. */
export const MENSAJES_ERROR_PLANO: Record<ErrorPlano, { mensaje: string; detalle: string }> = {
  no_existe: {
    mensaje: "Este plano no está disponible",
    detalle: "El edificio o la planta solicitada no tiene un plano publicado.",
  },
  red: {
    mensaje: "No se pudo descargar el plano",
    detalle: "Revisa tu conexión a internet e inténtalo de nuevo.",
  },
  tiempo: {
    mensaje: "El plano tardó demasiado en cargar",
    detalle: "La conexión parece lenta. Inténtalo de nuevo.",
  },
  invalido: {
    mensaje: "El plano no se pudo leer",
    detalle: "El archivo del plano está dañado o no es un SVG válido.",
  },
};
