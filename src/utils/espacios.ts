import { DOMParser } from "@xmldom/xmldom";
import { esEspacio, nombreLegible } from "../components/mapa3d/runtime/etiquetas";

export interface Espacio {
  id: string;
  nombre: string;
}

/**
 * Lista los espacios de un plano SVG (ya saneado) con la MISMA regla que el motor 3D
 * (etiquetas.esEspacio), ordenados por nombre de forma natural ("Aula A2" < "Aula A10").
 * Sirve como alternativa accesible al mapa: funciona con lector de pantalla y teclado.
 */
export function listarEspacios(svg: string | null | undefined): Espacio[] {
  if (!svg) return [];
  let doc: any;
  try {
    // onError vacío: un plano dañado solo produce una lista vacía, sin ruido en la consola.
    doc = new DOMParser({ onError: () => {} } as any).parseFromString(svg, "image/svg+xml");
  } catch {
    return [];
  }
  const vistos = new Set<string>();
  const espacios: Espacio[] = [];

  const recorrer = (nodo: any) => {
    const hijos = nodo?.childNodes;
    if (!hijos) return;
    for (let i = 0; i < hijos.length; i++) {
      const el = hijos[i];
      if (el.nodeType !== 1) continue;
      const id: string | null = el.getAttribute?.("id");
      if (id && !vistos.has(id) && esEspacio(el.localName || el.nodeName, id) && /^[a-z0-9_]{1,80}$/i.test(id)) {
        vistos.add(id);
        espacios.push({ id, nombre: nombreLegible(id) });
      }
      recorrer(el);
    }
  };
  recorrer(doc?.documentElement);

  return espacios.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true, sensitivity: "base" }));
}
