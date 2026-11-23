export interface DatosQR {
  unidad: string;
  periodo: string;
  nombre: string;
  nomina: string;
  fecha: string;
  vigencia: string;
  version: string;
  /** TOT[40] -> 40 */
  horasTotal: number | null;
  /** MAT[23] -> 23 (horas de asignaturas) */
  horasAsignaturas: number | null;
}

/**
 * El QR del horario de docente trae (separado por comas):
 * unidad, periodo, nombre, nómina, fecha, vigencia, versión, ...totales (TOT[40], MAT[23], ...)
 */
export function parseQR(texto: string): DatosQR | null {
  const partes = texto.split(',').map((p) => p.trim());
  if (partes.length < 7) return null;
  const nomina = partes[3].toUpperCase();
  if (!/^[A-Z]{2,4}\d{3,6}$/.test(nomina)) return null;
  const tot = /TOT\[(\d+)\]/.exec(texto);
  const mat = /MAT\[(\d+)\]/.exec(texto);
  return {
    unidad: partes[0],
    periodo: partes[1],
    nombre: partes[2],
    nomina,
    fecha: partes[4],
    vigencia: partes[5],
    version: partes[6],
    horasTotal: tot ? Number(tot[1]) : null,
    horasAsignaturas: mat ? Number(mat[1]) : null,
  };
}
