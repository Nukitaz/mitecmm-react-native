/**
 * Cliente de Supabase falso para pruebas unitarias.
 * Registra cada consulta en `llamadas` y responde con lo que la prueba programe en `respuestas`.
 */
export const llamadas = [];
export const respuestas = {
  /** Resultado de .rpc(nombre, args) */
  rpc: { data: null, error: { message: "rpc no disponible" } },
  /** Resultado de .from(tabla).select(...)[.or(...)][.order(...)] */
  tabla: { data: [], error: null },
};

export function reiniciar() {
  llamadas.length = 0;
  respuestas.rpc = { data: null, error: { message: "rpc no disponible" } };
  respuestas.tabla = { data: [], error: null };
}

function consulta(tabla) {
  const registro = { tipo: "from", tabla, select: null, or: null, order: null };
  llamadas.push(registro);
  const q = {
    select(columnas) { registro.select = columnas; return q; },
    or(filtro) { registro.or = filtro; return q; },
    order(columna, opciones) { registro.order = [columna, opciones]; return q; },
    then(ok, mal) { return Promise.resolve(respuestas.tabla).then(ok, mal); },
  };
  return q;
}

export const supabase = {
  from: consulta,
  rpc(nombre, args) {
    llamadas.push({ tipo: "rpc", nombre, args });
    return Promise.resolve(respuestas.rpc);
  },
  storage: {
    from(bucket) {
      return {
        getPublicUrl(archivo) {
          return { data: { publicUrl: `https://ejemplo.supabase.co/storage/v1/object/public/${bucket}/${archivo}` } };
        },
      };
    },
  },
};
