import { limpiarNombre, normalizarAula, sinAcentos } from './normalizar';

export interface CeldaLeida {
  materia: string | null;
  grupo: string | null;
  aula: string | null;
}

// "Grupo: N Aula: LDS" | "Aula: CUBIC-JFJP". Tolera errores típicos del OCR (Auta, Gruoo, falta de ':').
const MARCADOR =
  /(?:Gru\w{0,3}\s*:?\s*([A-Za-z0-9]{1,3})\b)?\s*A[uU][lLtI1]a\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-.]*)/i;

function limpiarLineaMateria(l: string): string | null {
  const t = l
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,()\-/&]/g, ' ')
    .replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+|[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9.)]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sinAcentos(t).replace(/[^A-Za-zñÑ]/g, '').length >= 3 ? t : null;
}

/** Interpreta el texto de UNA celda de la cuadrícula (líneas ya separadas). */
export function parseTextoCelda(lineas: string[]): CeldaLeida {
  const partesMateria: string[] = [];
  let grupo: string | null = null;
  let aula: string | null = null;

  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const m = MARCADOR.exec(linea);
    if (m) {
      grupo = m[1] ? m[1].toUpperCase() : grupo;
      aula = normalizarAula(m[2]);
      const prefijo = limpiarLineaMateria(linea.slice(0, m.index));
      if (prefijo) partesMateria.push(prefijo);
    } else {
      const t = limpiarLineaMateria(linea);
      if (t) partesMateria.push(t);
    }
  }
  return { materia: limpiarNombre(partesMateria.join(' ')), grupo, aula };
}
