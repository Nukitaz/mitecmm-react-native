export const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'] as const;

/** Quita acentos pero conserva la ñ (DISEÑO no debe volverse DISENO). */
export function sinAcentos(s: string): string {
  return s
    .replace(/ñ/g, '\u0001')
    .replace(/Ñ/g, '\u0002')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/\u0002/g, 'Ñ');
}

export function limpiarTexto(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (!t || /^(null|undefined|empty|n\/a|-)$/i.test(t)) return null;
  return t;
}

/** Nombres y materias: MAYÚSCULAS, sin acentos (la ñ se conserva). */
export function limpiarNombre(s: unknown): string | null {
  const t = limpiarTexto(s);
  if (!t) return null;

  const normalizado = sinAcentos(t)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:_!?-]+$/g, '')
    .trim();
  if (!normalizado) return null;

  const basura = [
    'PRUEBA',
    'PRUEBAS',
    'TEST',
    'TESTING',
    'DEMO',
    'DEMOSTRACION',
    'EJEMPLO',
    'EJEMPLOS',
    'DUMMY',
    'SAMPLE',
    'LOREM',
    'LOREM IPSUM',
    'ASDF',
  ];
  const clave = normalizado.replace(/[.,;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (
    basura.includes(clave) ||
    /^(?:DOCENTE|MATERIA|MATERIAS|TEXTO|NOMBRE|DATOS)\s+(?:DE\s+)?(?:PRUEBA|TEST|EJEMPLO|DEMO|SAMPLE)\b/.test(clave) ||
    /^(?:PRUEBA|TEST|EJEMPLO|DEMO|DUMMY|SAMPLE)(?:\s+(?:[0-9]+|UNO|DOS|TRES|XX+))?$/.test(clave) ||
    /^LOREM(?:\s+IPSUM)?\b/.test(clave) ||
    /^([A-ZÑ])\1{2,}$/.test(clave)
  ) return null;

  return normalizado;
}

export function normalizarAula(s: unknown, quitarEspacios = true): string | null {
  const t = limpiarTexto(s);
  if (!t) return null;
  let u = t.toUpperCase();
  if (quitarEspacios) u = u.replace(/\s+/g, '');
  u = u.replace(/^[.\-_,;:]+|[.\-_,;:]+$/g, '');
  return u || null;
}

const ABREV_DIAS: Record<string, string> = {
  lunes: 'Lunes', lun: 'Lunes',
  martes: 'Martes', mar: 'Martes',
  miercoles: 'Miercoles', mie: 'Miercoles', mier: 'Miercoles',
  jueves: 'Jueves', jue: 'Jueves',
  viernes: 'Viernes', vie: 'Viernes',
  sabado: 'Sabado', sab: 'Sabado',
};

export function normalizarDia(d: unknown): string | null {
  const k = sinAcentos(String(d ?? '')).trim().toLowerCase().replace(/\.$/, '');
  return ABREV_DIAS[k] ?? null;
}

export function minutos(hms: string): number {
  const [h, m] = hms.split(':').map(Number);
  return h * 60 + m;
}

export function aHMS(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Acepta "14:00", "14:00:00", "2:00 PM", "14.00" o una fracción de día de Excel (0.5833). */
export function parseHora(v: unknown): string | null {
  if (typeof v === 'number') {
    if (v >= 0 && v < 1) return aHMS(Math.round(v * 24 * 60));
    return null;
  }
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) {
    const pm = m[3].startsWith('p');
    if (h < 1 || h > 12) return null;
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return aHMS(h * 60 + min);
}

/** "14:00 - 15:00", "14:00 a 15:00", "14:00–15:00" -> [inicio, fin] */
export function parseRangoHora(v: unknown): [string, string] | null {
  const s = String(v ?? '');
  const m = /(\d{1,2}[:.]\d{2}(?::\d{2})?)\s*(?:-|–|—|a|al|hasta)\s*(\d{1,2}[:.]\d{2}(?::\d{2})?)/i.exec(s);
  if (!m) return null;
  const a = parseHora(m[1]);
  const b = parseHora(m[2]);
  return a && b ? [a, b] : null;
}

export function levenshtein(a: string, b: string): number {
  const d: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** "ZAD0099_V1.pdf" -> "ZAD0099" */
export function nominaDeArchivo(nombre: string): string | null {
  const m = /^([A-Za-z]{2,4}\d{3,6})/.exec(nombre.trim());
  return m ? m[1].toUpperCase() : null;
}

export function idAleatorio(): string {
  return Math.random().toString(36).slice(2, 10);
}
