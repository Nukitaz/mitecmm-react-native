export type EstadoSemaforo = 'VERDE' | 'AMARILLO' | 'ROJO';
export type OrigenDatos = 'pdf-digital' | 'pdf-escaneado' | 'excel';

export interface ClaseHorario {
  materia: string;
  grupo: string | null;
  dia: string; // Lunes | Martes | Miercoles | Jueves | Viernes | Sabado
  hora_inicio: string; // HH:MM:SS
  hora_fin: string; // HH:MM:SS
  aula: string | null;
  /** El lector no está seguro de esta clase (solo OCR). */
  dudosa?: boolean;
  /** Calculado por evaluar(): impiden guardar. */
  problemas?: string[];
  /** Calculado por evaluar(): piden revisión pero se puede guardar. */
  avisos?: string[];
}

export interface DocenteProcesado {
  id: string;
  nombreArchivo: string;
  archivoOriginal?: File;
  origen: OrigenDatos;
  docente: string;
  /** 'S/N' cuando el archivo no trae nómina. */
  nomina: string;
  /** Horas de clase leídas (calculado). */
  horasTotales: number;
  /** TOTAL de horas que declara el documento (QR). null si no hay con qué comparar. */
  horasEsperadas: number | null;
  estado: EstadoSemaforo;
  /** Aulas distintas que el catálogo no conoce (solo aplica a escaneos). */
  aulasDesconocidas: number;
  clases: ClaseHorario[];
  /** Avisos que dejó la lectura del archivo (QR ilegible, nómina distinta, etc.). */
  avisosLectura: string[];
  /** avisosLectura + los que calcula evaluar(). Es lo que muestra la pantalla. */
  advertencias: string[];
  guardado?: boolean;
  errorGuardado?: string;
}

export interface ErrorArchivo {
  archivo: string;
  mensaje: string;
}

export interface AulaPendiente {
  aula: string;
  veces: number;
  sugerencia: string | null;
}

export interface ResumenGuardado {
  guardados: number;
  fallidos: number;
  omitidosRojos: number;
}
