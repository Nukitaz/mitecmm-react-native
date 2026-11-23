import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';

export interface ClaseSemanal {
  id?: string;
  materia: string;
  grupo?: string | null;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  aula?: string | null;
}

interface Props {
  clases: ClaseSemanal[];
  isDarkMode: boolean;
  onSeleccionarAula?: (aula: string) => void;
  onEliminarClase?: (id: string) => void;
  eliminandoId?: string | null;
  onActualizarClase?: (clase: ClaseSemanal, cambios: ClaseSemanal) => void | Promise<void>;
  onAgregarClase?: (dia: string, clase: ClaseSemanal) => void | Promise<void>;
  guardandoId?: string | null;
}

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function horaMinutos(hora: string): number | null {
  const coincidencia = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim());
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

function normalizarDia(dia: string): string {
  const valor = dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (valor.startsWith('mier')) return 'Miercoles';
  if (valor.startsWith('lun')) return 'Lunes';
  if (valor.startsWith('mar')) return 'Martes';
  if (valor.startsWith('jue')) return 'Jueves';
  if (valor.startsWith('vie')) return 'Viernes';
  if (valor.startsWith('sab')) return 'Sabado';
  return '';
}

function normalizarTextoClave(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizarHora(valor: string): string {
  const horas = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(valor.trim());
  if (!horas) return valor.trim();
  return `${horas[1].padStart(2, '0')}:${horas[2]}`;
}

/** Elimina clases idénticas aunque vengan repetidas por archivos o registros duplicados. */
export function clasesUnicasDia(clases: ClaseSemanal[]): ClaseSemanal[] {
  const vistas = new Set<string>();
  return clases.filter((clase) => {
    const clave = [
      normalizarTextoClave(clase.materia),
      normalizarHora(clase.hora_inicio),
      normalizarHora(clase.hora_fin),
      normalizarTextoClave(clase.aula ?? ''),
    ].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function minutosAHora(minutos: number): string {
  const horas = Math.floor(minutos / 60) % 24;
  const resto = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}:00`;
}

/**
 * Agrupa por materia y salón, fusionando intervalos solapados o consecutivos.
 * Las propiedades del primer registro se conservan y el resultado usa el intervalo unido.
 */
export function fusionarClasesDia(clases: ClaseSemanal[]): ClaseSemanal[] {
  const grupos = new Map<string, ClaseSemanal[]>();

  for (const clase of clases) {
    const inicio = horaMinutos(clase.hora_inicio);
    const fin = horaMinutos(clase.hora_fin);
    if (inicio == null || fin == null || fin <= inicio) continue;

    const clave = `${normalizarTextoClave(clase.materia)}|${normalizarTextoClave(clase.aula ?? '')}`;
    const grupo = grupos.get(clave) ?? [];
    grupo.push(clase);
    grupos.set(clave, grupo);
  }

  const resultado: ClaseSemanal[] = [];
  for (const grupo of grupos.values()) {
    const ordenados = [...grupo].sort(
      (a, b) => (horaMinutos(a.hora_inicio) ?? 24 * 60) - (horaMinutos(b.hora_inicio) ?? 24 * 60),
    );
    let actual = ordenados[0];
    let inicioActual = horaMinutos(actual.hora_inicio)!;
    let finActual = horaMinutos(actual.hora_fin)!;

    for (let i = 1; i < ordenados.length; i++) {
      const siguiente = ordenados[i];
      const inicioSiguiente = horaMinutos(siguiente.hora_inicio)!;
      const finSiguiente = horaMinutos(siguiente.hora_fin)!;

      if (inicioSiguiente <= finActual) {
        finActual = Math.max(finActual, finSiguiente);
        actual = {
          ...actual,
          hora_inicio: minutosAHora(Math.min(inicioActual, inicioSiguiente)),
          hora_fin: minutosAHora(finActual),
          grupo: actual.grupo || siguiente.grupo,
        };
        inicioActual = Math.min(inicioActual, inicioSiguiente);
      } else {
        resultado.push({
          ...actual,
          hora_inicio: minutosAHora(inicioActual),
          hora_fin: minutosAHora(finActual),
        });
        actual = siguiente;
        inicioActual = inicioSiguiente;
        finActual = finSiguiente;
      }
    }

    resultado.push({
      ...actual,
      hora_inicio: minutosAHora(inicioActual),
      hora_fin: minutosAHora(finActual),
    });
  }

  return resultado;
}

export function HorarioSemanal({
  clases,
  isDarkMode,
  onSeleccionarAula,
  onEliminarClase,
  eliminandoId,
  onActualizarClase,
  onAgregarClase,
  guardandoId,
}: Props) {
  const [indiceDia, setIndiceDia] = useState(0);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [borrador, setBorrador] = useState<ClaseSemanal | null>(null);
  const dias = useMemo(() => {
    const disponibles = DIAS.map((dia) => ({
      dia,
      clases: fusionarClasesDia(
        clasesUnicasDia(clases.filter((clase) => normalizarDia(clase.dia) === dia)),
      )
        .sort((a, b) => (horaMinutos(a.hora_inicio) ?? 24 * 60) - (horaMinutos(b.hora_inicio) ?? 24 * 60)),
    }));
    return onAgregarClase
      ? disponibles
      : disponibles.filter((diaConClases) => diaConClases.clases.length > 0);
  }, [clases, onAgregarClase]);

  if (dias.length === 0) return null;

  const indiceSeguro = Math.min(indiceDia, dias.length - 1);
  const diaActual = dias[indiceSeguro];

  return (
    <View style={styles.accordion}>
      <View style={[styles.carouselHeader, !isDarkMode && styles.carouselHeaderLight]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setIndiceDia((indice) => Math.max(0, indice - 1))}
          disabled={indiceSeguro === 0}
          activeOpacity={0.7}
        >
          <ChevronLeft
            size={20}
            color={indiceSeguro === 0 ? '#71717a' : isDarkMode ? '#e4e4e7' : '#475569'}
          />
        </TouchableOpacity>

        <View style={styles.dayIndicator}>
          <Text style={[styles.dayTitle, !isDarkMode && styles.dayTitleLight]}>
            {diaActual.dia}
          </Text>
          <Text style={[styles.dayCount, !isDarkMode && styles.dayCountLight]}>
            {indiceSeguro + 1} DE {dias.length} · {diaActual.clases.length} CLASE{diaActual.clases.length === 1 ? '' : 'S'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setIndiceDia((indice) => Math.min(dias.length - 1, indice + 1))}
          disabled={indiceSeguro === dias.length - 1}
          activeOpacity={0.7}
        >
          <ChevronRight
            size={20}
            color={indiceSeguro === dias.length - 1 ? '#71717a' : isDarkMode ? '#e4e4e7' : '#475569'}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.classList, !isDarkMode && styles.classListLight]}>
        {diaActual.clases.map((clase) => (
          <View
            key={clase.id ?? `${diaActual.dia}-${clase.materia}-${clase.hora_inicio}-${clase.aula ?? ''}`}
            style={[styles.classRow, !isDarkMode && styles.classRowLight]}
          >
            {editandoId === clase.id && borrador ? (
              <View style={styles.editRow}>
                <TextInput
                  value={borrador.materia}
                  onChangeText={(materia) => setBorrador({ ...borrador, materia })}
                  placeholder="Materia"
                  placeholderTextColor="#71717a"
                  style={[styles.input, isDarkMode ? null : styles.inputLight]}
                />
                <View style={styles.editGrid}>
                  {[
                    ['hora_inicio', 'Inicio', borrador.hora_inicio.slice(0, 5)],
                    ['hora_fin', 'Fin', borrador.hora_fin.slice(0, 5)],
                    ['aula', 'Aula', borrador.aula ?? ''],
                    ['grupo', 'Grupo', borrador.grupo ?? ''],
                  ].map(([campo, placeholder, valor]) => (
                    <TextInput
                      key={campo}
                      value={valor as string}
                      onChangeText={(texto) => setBorrador({ ...borrador, [campo]: texto })}
                      placeholder={placeholder as string}
                      placeholderTextColor="#71717a"
                      style={[styles.smallInput, isDarkMode ? null : styles.inputLight]}
                    />
                  ))}
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity
                    disabled={guardandoId === clase.id}
                    onPress={async () => {
                      if (!onActualizarClase) return;
                      try {
                        await onActualizarClase(clase, {
                          ...borrador,
                          materia: borrador.materia.trim().toUpperCase(),
                          hora_inicio: /^\d{1,2}:\d{2}$/.test(borrador.hora_inicio)
                            ? `${borrador.hora_inicio.padStart(5, '0')}:00`
                            : borrador.hora_inicio,
                          hora_fin: /^\d{1,2}:\d{2}$/.test(borrador.hora_fin)
                            ? `${borrador.hora_fin.padStart(5, '0')}:00`
                            : borrador.hora_fin,
                          aula: borrador.aula?.trim().toUpperCase() || null,
                          grupo: borrador.grupo?.trim().toUpperCase() || null,
                        });
                        setEditandoId(null);
                        setBorrador(null);
                      } catch (error: any) {
                        Alert.alert('Error', error?.message ?? 'No se pudo actualizar la clase.');
                      }
                    }}
                  >
                    <Text style={styles.saveText}>{guardandoId === clase.id ? 'GUARDANDO...' : 'GUARDAR'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditandoId(null); setBorrador(null); }}>
                    <Text style={styles.cancelText}>CANCELAR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.classInfo}
                  activeOpacity={onSeleccionarAula ? 0.7 : 1}
                  onPress={() => clase.aula && onSeleccionarAula?.(clase.aula)}
                >
                  <Text style={[styles.className, !isDarkMode && styles.classNameLight]}>
                    {clase.materia || 'Sin materia'}
                  </Text>
                  <View style={styles.classDetails}>
                    <View style={[styles.timeBadge, !isDarkMode && styles.timeBadgeLight]}>
                      <Text style={[styles.timeText, !isDarkMode && styles.timeTextLight]}>
                        {clase.hora_inicio.slice(0, 5)}–{clase.hora_fin.slice(0, 5)}
                      </Text>
                    </View>
                    {clase.aula ? (
                      <View style={styles.aulaRow}>
                        <MapPin size={14} color={isDarkMode ? '#c4b5fd' : '#7c3aed'} />
                        <Text style={[styles.aulaText, !isDarkMode && styles.aulaTextLight]}>
                          {`SALÓN ${clase.aula}`}
                        </Text>
                      </View>
                    ) : null}
                    {clase.grupo ? (
                      <Text style={[styles.classMeta, !isDarkMode && styles.classMetaLight]}>
                        {`Grupo ${clase.grupo}`}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </>
            )}
            {editandoId !== clase.id && clase.id && (
              <View style={styles.rowActions}>
                {onActualizarClase && (
                  <TouchableOpacity onPress={() => { setEditandoId(clase.id!); setBorrador({ ...clase }); }}>
                    <Text style={styles.editText}>EDITAR</Text>
                  </TouchableOpacity>
                )}
                {onEliminarClase && (
                  <TouchableOpacity
                    disabled={eliminandoId === clase.id}
                    onPress={() => onEliminarClase(clase.id!)}
                  >
                    <Text style={[styles.deleteText, eliminandoId === clase.id && { opacity: 0.5 }]}>ELIMINAR</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
        {agregando && borrador ? (
          <View style={[styles.addRow, isDarkMode ? null : styles.classRowLight]}>
            <TextInput
              value={borrador.materia}
              onChangeText={(materia) => setBorrador({ ...borrador, materia })}
              placeholder="Materia"
              placeholderTextColor="#71717a"
              style={[styles.input, isDarkMode ? null : styles.inputLight]}
            />
            <View style={styles.editGrid}>
              {[
                ['hora_inicio', 'Inicio', borrador.hora_inicio],
                ['hora_fin', 'Fin', borrador.hora_fin],
                ['aula', 'Aula', borrador.aula ?? ''],
                ['grupo', 'Grupo', borrador.grupo ?? ''],
              ].map(([campo, placeholder, valor]) => (
                <TextInput
                  key={campo}
                  value={valor as string}
                  onChangeText={(texto) => setBorrador({ ...borrador, [campo]: texto })}
                  placeholder={placeholder as string}
                  placeholderTextColor="#71717a"
                  style={[styles.smallInput, isDarkMode ? null : styles.inputLight]}
                />
              ))}
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                disabled={guardandoId === 'nueva'}
                onPress={async () => {
                  if (!onAgregarClase) return;
                  try {
                    await onAgregarClase(diaActual.dia, {
                      ...borrador,
                      materia: borrador.materia.trim().toUpperCase(),
                      hora_inicio: /^\d{2}:\d{2}$/.test(borrador.hora_inicio) ? `${borrador.hora_inicio}:00` : borrador.hora_inicio,
                      hora_fin: /^\d{2}:\d{2}$/.test(borrador.hora_fin) ? `${borrador.hora_fin}:00` : borrador.hora_fin,
                      aula: borrador.aula?.trim().toUpperCase() || null,
                      grupo: borrador.grupo?.trim().toUpperCase() || null,
                    });
                    setAgregando(false);
                    setBorrador(null);
                  } catch (error: any) {
                    Alert.alert('Error', error?.message ?? 'No se pudo agregar la clase.');
                  }
                }}
              >
                <Text style={styles.saveText}>{guardandoId === 'nueva' ? 'GUARDANDO...' : 'GUARDAR'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAgregando(false); setBorrador(null); }}>
                <Text style={styles.cancelText}>CANCELAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : onAgregarClase ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setAgregando(true);
              setBorrador({ materia: '', dia: diaActual.dia, hora_inicio: '', hora_fin: '', aula: null, grupo: null });
            }}
          >
            <Text style={styles.addButtonText}>+ AGREGAR CLASE</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accordion: { width: '100%', gap: 8 },
  carouselHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#27272a', borderRadius: 6, backgroundColor: '#18181b', paddingHorizontal: 6 },
  carouselHeaderLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  navButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  dayIndicator: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayTitle: { color: '#e4e4e7', fontSize: 13, fontWeight: 'bold' },
  dayTitleLight: { color: '#0f172a' },
  dayCount: { color: '#71717a', fontSize: 9, marginTop: 2, letterSpacing: 1 },
  dayCountLight: { color: '#64748b' },
  classList: { borderWidth: 1, borderColor: '#27272a', borderRadius: 6, overflow: 'hidden', backgroundColor: '#121215' },
  classListLight: { borderColor: '#e2e8f0', backgroundColor: '#ffffff' },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272a' },
  classRowLight: { borderTopColor: '#e2e8f0' },
  classInfo: { flex: 1 },
  className: { color: '#e4e4e7', fontSize: 13, fontWeight: 'bold', marginBottom: 3 },
  classNameLight: { color: '#0f172a' },
  classDetails: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  timeBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: 'rgba(168, 85, 247, 0.18)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.35)', paddingHorizontal: 8, paddingVertical: 4 },
  timeBadgeLight: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  timeText: { color: '#ddd6fe', fontSize: 11, fontWeight: '900', fontFamily: 'monospace' },
  timeTextLight: { color: '#6b21a8' },
  aulaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aulaText: { color: '#f4f4f5', fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  aulaTextLight: { color: '#1e293b' },
  classMeta: { color: '#a1a1aa', fontSize: 11 },
  classMetaLight: { color: '#64748b' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8 },
  editText: { color: '#3b82f6', fontSize: 10, fontWeight: 'bold' },
  deleteText: { color: '#f43f5e', fontSize: 10, fontWeight: 'bold' },
  editRow: { flex: 1, gap: 8 },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 4, color: '#e4e4e7', paddingHorizontal: 8, paddingVertical: 7, fontSize: 12 },
  smallInput: { width: 82, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 4, color: '#e4e4e7', paddingHorizontal: 8, paddingVertical: 7, fontSize: 12 },
  inputLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  editActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  saveText: { color: '#10b981', fontSize: 10, fontWeight: 'bold' },
  cancelText: { color: '#a1a1aa', fontSize: 10, fontWeight: 'bold' },
  addRow: { gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#27272a' },
  addButton: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272a' },
  addButtonText: { color: '#a855f7', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
});
