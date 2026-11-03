/**
 * Registro de errores solo en desarrollo.
 * En producción no se imprime nada en la consola (no se filtran detalles internos
 * como URLs, mensajes de Supabase o trazas a quien abra las DevTools).
 */
/* eslint-disable no-console */
export const log = {
  error: (...args: unknown[]) => {
    if (__DEV__) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn(...args);
  },
};
