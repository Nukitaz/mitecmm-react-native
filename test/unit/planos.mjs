// Acceso a los planos reales usados como datos de prueba (copia fija de Supabase Storage, bucket "Maps").
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DIR_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
export const DIR_PLANOS = join(DIR_FIXTURES, "planos");

/** Planos de edificio (planta_baja_edificio_a.svg, …), sin el mapa general. */
export const PLANOS_EDIFICIO = readdirSync(DIR_PLANOS).filter((f) => f.startsWith("planta_")).sort();

export const leerPlano = (archivo) => readFileSync(join(DIR_PLANOS, archivo), "utf8");
export const leerFixture = (archivo) => readFileSync(join(DIR_FIXTURES, archivo), "utf8");
