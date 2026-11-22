import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
import { UploadCloud, CheckCircle, AlertTriangle, XCircle, Save, GraduationCap, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Trash2, Pencil, Search, RefreshCw, FileText, ExternalLink, X, Square, CheckSquare } from 'lucide-react-native';
import { cacheBorradorHorarios, guardarEstadoBorradorHorarios, useProcesadorHorarios, DocenteProcesado } from '../hooks/useProcesadorHorarios';
import { limpiarNombre, normalizarAula, normalizarDia, parseHora } from '../hooks/procesadorHorarios/normalizar';
import { supabase } from '../integrations/supabase/client';
import { useTheme } from '../context/ThemeContext';
import { HorarioSemanal, ClaseSemanal } from './HorarioSemanal';

export interface Carrera {
  id: string;
  nombre: string;
  siglas: string;
}

interface ConteoCarrera {
  clases: number;
  docentes: number;
}

interface HorarioGuardado {
  id: string;
  materia: string;
  grupo: string | null;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
  created_at?: string | null;
}

interface ProfesorConHorarios {
  id: string;
  nombre: string;
  nomina: string | null;
  urlHorario?: string | null;
  nombreArchivo?: string | null;
  carreraId: string | null;
  carreraNombre: string | null;
  horarios: HorarioGuardado[];
}

// ---------------------------------------------------------------------------
// Campo de texto que solo "confirma" el cambio al salir del campo (así la lista no se reordena mientras escribes)
// ---------------------------------------------------------------------------
const CampoEditable = ({ valor, onCommit, normalizar, placeholder, ancho, isDarkMode }: {
  valor: string;
  onCommit: (nuevo: string) => void;
  normalizar?: (t: string) => string;
  placeholder?: string;
  ancho?: number;
  isDarkMode: boolean;
}) => {
  const [txt, setTxt] = useState(valor);
  useEffect(() => setTxt(valor), [valor]);
  const confirmar = () => {
    const limpio = normalizar ? normalizar(txt) : txt.trim();
    if (limpio !== valor) onCommit(limpio);
    else setTxt(valor);
  };
  return (
    <TextInput
      value={txt}
      onChangeText={setTxt}
      onBlur={confirmar}
      onSubmitEditing={confirmar}
      placeholder={placeholder}
      placeholderTextColor="#71717a"
      style={[styles.input, !isDarkMode && styles.inputLight, ancho ? { width: ancho } : { flex: 1 }]}
    />
  );
};

const FilaAulaPendiente = ({ aula, veces, sugerencia, onConfirmar, onCorregir, isDarkMode }: {
  aula: string; veces: number; sugerencia: string | null;
  onConfirmar: () => void; onCorregir: (a: string) => void; isDarkMode: boolean;
}) => {
  const [otra, setOtra] = useState('');
  return (
    <View style={styles.aulaRow}>
      <Text style={[styles.aulaNombre, !isDarkMode && styles.textLight]}>{aula} <Text style={styles.aulaVeces}>×{veces}</Text></Text>
      <View style={styles.aulaAcciones}>
        <TextInput
          value={otra}
          onChangeText={setOtra}
          placeholder="corregir a..."
          placeholderTextColor="#71717a"
          autoCapitalize="characters"
          style={[styles.input, !isDarkMode && styles.inputLight, { width: 110 }]}
        />
        <TouchableOpacity disabled={!normalizarAula(otra)} onPress={() => { const a = normalizarAula(otra); if (a) onCorregir(a); }}>
          <Text style={[styles.actionTextBlue, !normalizarAula(otra) && { opacity: 0.4 }]}>CAMBIAR</Text>
        </TouchableOpacity>
        {sugerencia && (
          <TouchableOpacity onPress={() => onCorregir(sugerencia)}>
            <Text style={styles.actionTextBlue}>→ {sugerencia}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onConfirmar}>
          <Text style={styles.actionTextGreen}>ES CORRECTA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

type Acciones = Pick<ReturnType<typeof useProcesadorHorarios>,
  'actualizarDocente' | 'actualizarClase' | 'agregarClase' | 'eliminarClase' | 'descartarDocente'>;

const ORIGEN_TEXTO: Record<DocenteProcesado['origen'], string> = {
  'pdf-digital': 'PDF digital',
  'pdf-escaneado': 'PDF escaneado',
  excel: 'Excel/CSV',
};

const TarjetaDocente = ({ doc, acciones, isDarkMode, colorEstado, iconoEstado }: {
  doc: DocenteProcesado; acciones: Acciones; isDarkMode: boolean; colorEstado: string; iconoEstado: React.ReactNode;
}) => {
  const [abierto, setAbierto] = useState(doc.estado === 'ROJO');
  const horasTexto = doc.horasEsperadas != null ? `${doc.horasTotales}/${doc.horasEsperadas}` : `${doc.horasTotales}`;
  const quitarSegundos = (h: string) => (/^\d{2}:\d{2}:\d{2}$/.test(h) ? h.slice(0, 5) : h);

  return (
    <View style={[styles.row, !isDarkMode && styles.rowLight, { borderLeftColor: colorEstado, flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={styles.rowCabecera}>
        <TouchableOpacity style={styles.rowInfo} onPress={() => setAbierto(!abierto)}>
          {doc.docente ? (
            <Text style={[styles.docenteText, !isDarkMode && styles.textLight]}>{doc.docente}</Text>
          ) : (
            <Text style={[styles.docenteText, { color: '#f43f5e', fontStyle: 'italic' }]}>SIN NOMBRE (escríbelo al abrir)</Text>
          )}
          <Text style={styles.archivoText}>{doc.nombreArchivo} • Nómina: {doc.nomina} • {ORIGEN_TEXTO[doc.origen]}</Text>
        </TouchableOpacity>
        <View style={styles.rowStatus}>
          <Text style={[styles.horasText, { color: colorEstado }]}>{horasTexto} HRS</Text>
          {iconoEstado}
          <TouchableOpacity onPress={() => setAbierto(!abierto)}>
            {abierto ? <ChevronUp size={18} color="#a1a1aa" /> : <ChevronDown size={18} color="#a1a1aa" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => acciones.descartarDocente(doc.id)}>
            <Trash2 size={16} color="#71717a" />
          </TouchableOpacity>
        </View>
      </View>

      {doc.estado !== 'VERDE' && doc.advertencias.map((a, i) => (
        <Text key={i} style={[styles.advertenciaText, { color: colorEstado }]}>• {a}</Text>
      ))}
      {doc.errorGuardado && <Text style={[styles.advertenciaText, { color: '#f43f5e' }]}>• No se guardó: {doc.errorGuardado}</Text>}

      {abierto && (
        <View style={styles.detalle}>
          <View style={styles.detalleFila}>
            <Text style={styles.etiqueta}>DOCENTE</Text>
            <CampoEditable valor={doc.docente} isDarkMode={isDarkMode} placeholder="Nombre completo"
              normalizar={(t) => limpiarNombre(t) ?? ''} onCommit={(v) => acciones.actualizarDocente(doc.id, { docente: v })} />
          </View>
          <View style={styles.detalleFila}>
            <Text style={styles.etiqueta}>NÓMINA</Text>
            <CampoEditable valor={doc.nomina === 'S/N' ? '' : doc.nomina} isDarkMode={isDarkMode} placeholder="S/N" ancho={140}
              normalizar={(t) => t.trim().toUpperCase().replace(/\s/g, '')} onCommit={(v) => acciones.actualizarDocente(doc.id, { nomina: v })} />
          </View>

          <View style={styles.claseEncabezado}>
            <Text style={[styles.etiqueta, { flex: 1 }]}>MATERIA</Text>
            <Text style={[styles.etiqueta, { width: 92 }]}>DÍA</Text>
            <Text style={[styles.etiqueta, { width: 78 }]}>INICIO</Text>
            <Text style={[styles.etiqueta, { width: 78 }]}>FIN</Text>
            <Text style={[styles.etiqueta, { width: 92 }]}>AULA</Text>
            <Text style={[styles.etiqueta, { width: 48 }]}>GPO</Text>
            <View style={{ width: 22 }} />
          </View>

          {doc.clases.map((c, i) => {
            const color = c.problemas && c.problemas.length ? '#f43f5e' : c.avisos && c.avisos.length ? '#eab308' : 'transparent';
            return (
              <View key={i} style={[styles.claseBloque, { borderLeftColor: color }]}>
                <View style={styles.claseFila}>
                  <CampoEditable valor={c.materia} isDarkMode={isDarkMode} placeholder="Materia"
                    normalizar={(t) => limpiarNombre(t) ?? ''} onCommit={(v) => acciones.actualizarClase(doc.id, i, { materia: v })} />
                  <CampoEditable valor={c.dia} isDarkMode={isDarkMode} placeholder="Día" ancho={92}
                    normalizar={(t) => normalizarDia(t) ?? t.trim()} onCommit={(v) => acciones.actualizarClase(doc.id, i, { dia: v })} />
                  <CampoEditable valor={quitarSegundos(c.hora_inicio)} isDarkMode={isDarkMode} placeholder="hh:mm" ancho={78}
                    normalizar={(t) => parseHora(t) ?? t.trim()} onCommit={(v) => acciones.actualizarClase(doc.id, i, { hora_inicio: v })} />
                  <CampoEditable valor={quitarSegundos(c.hora_fin)} isDarkMode={isDarkMode} placeholder="hh:mm" ancho={78}
                    normalizar={(t) => parseHora(t) ?? t.trim()} onCommit={(v) => acciones.actualizarClase(doc.id, i, { hora_fin: v })} />
                  <CampoEditable valor={c.aula ?? ''} isDarkMode={isDarkMode} placeholder="Aula" ancho={92}
                    normalizar={(t) => normalizarAula(t, false) ?? ''} onCommit={(v) => acciones.actualizarClase(doc.id, i, { aula: v || null })} />
                  <CampoEditable valor={c.grupo ?? ''} isDarkMode={isDarkMode} placeholder="Gpo" ancho={48}
                    normalizar={(t) => t.trim().toUpperCase()} onCommit={(v) => acciones.actualizarClase(doc.id, i, { grupo: v || null })} />
                  <TouchableOpacity onPress={() => acciones.eliminarClase(doc.id, i)}>
                    <Trash2 size={16} color="#71717a" />
                  </TouchableOpacity>
                </View>
                {c.problemas && c.problemas.map((p, k) => <Text key={`p${k}`} style={[styles.advertenciaText, { color: '#f43f5e' }]}>{p}</Text>)}
                {c.avisos && c.avisos.map((a, k) => <Text key={`a${k}`} style={[styles.advertenciaText, { color: '#eab308' }]}>{a}</Text>)}
              </View>
            );
          })}

          <TouchableOpacity style={styles.agregarBtn} onPress={() => acciones.agregarClase(doc.id)}>
            <Plus size={14} color="#a855f7" />
            <Text style={styles.agregarText}>AGREGAR CLASE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export interface PanelHorariosProps {
  modo?: 'DOCENTES' | 'HORARIOS';
}

export const PanelHorarios = ({ modo = 'DOCENTES' }: PanelHorariosProps) => {
  const { isDarkMode } = useTheme();
  
  // AQUÍ ESTÁN LAS NUEVAS FUNCIONES Y ESTADOS DE GUARDADO
  const {
    procesarLote, guardarEnBaseDeDatos, cancelar, limpiar, isProcessing, isSaving, progreso, resultados,
    erroresArchivos, aulasPendientes, confirmarAula, corregirAula,
    actualizarDocente, actualizarClase, agregarClase, eliminarClase, descartarDocente,
  } = useProcesadorHorarios();
  const acciones = { actualizarDocente, actualizarClase, agregarClase, eliminarClase, descartarDocente };
  const guardables = resultados.filter((d) => {
    const tienePdf = !!d.archivoOriginal &&
      (d.archivoOriginal.type === 'application/pdf' || d.archivoOriginal.name.toLowerCase().endsWith('.pdf'));
    const tieneNombre = !!d.docente?.trim();
    const tieneClase = d.clases.some((c) =>
        !!c.materia?.trim() &&
        !!c.dia?.trim() &&
        !!c.hora_inicio?.trim() &&
        !!c.hora_fin?.trim(),
      );
    return (tieneNombre || tienePdf) && (tieneClase || tienePdf);
  }).length;
  
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [conteosCarreras, setConteosCarreras] = useState<Record<string, ConteoCarrera>>({});
  const [loadingCarreras, setLoadingCarreras] = useState(true);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState<Carrera | null>(null);
  const [vistaCarrera, setVistaCarrera] = useState<Carrera | null>(null);
  const [profesoresGuardados, setProfesoresGuardados] = useState<ProfesorConHorarios[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCarreraId, setFiltroCarreraId] = useState('TODAS');
  const [editandoProfesorId, setEditandoProfesorId] = useState<string | null>(null);
  const [nombreProfesorBorrador, setNombreProfesorBorrador] = useState('');
  const [nominaProfesorBorrador, setNominaProfesorBorrador] = useState('');
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [busquedaDocumentos, setBusquedaDocumentos] = useState('');
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [visorPdf, setVisorPdf] = useState<{ nombre: string; url: string } | null>(null);
  const [visorVisible, setVisorVisible] = useState(false);
  const actualizacionIndividualRef = useRef<ProfesorConHorarios | null>(null);
  const scrollCarrerasRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollCarrerasOffsetRef = useRef(0);

  const desplazarCarreras = (direccion: 'izquierda' | 'derecha') => {
    const nuevoOffset = direccion === 'izquierda'
      ? Math.max(0, scrollCarrerasOffsetRef.current - 240)
      : scrollCarrerasOffsetRef.current + 240;
    scrollCarrerasRef.current?.scrollTo({ x: nuevoOffset, animated: true });
    scrollCarrerasOffsetRef.current = nuevoOffset;
  };

  const cargarCarrerasConConteos = async () => {
    setLoadingCarreras(true);
    try {
      const { data: carrerasData, error: errorCarreras } = await supabase
        .from('carreras')
        .select('id, nombre, siglas')
        .order('nombre');
      if (errorCarreras) throw errorCarreras;

      const carrerasOrdenadas = (carrerasData ?? []) as Carrera[];
      setCarreras(carrerasOrdenadas);
      if (cacheBorradorHorarios.carreraSeleccionadaId) {
        const carreraCacheada = carrerasOrdenadas.find(
          (carrera) => carrera.id === cacheBorradorHorarios.carreraSeleccionadaId,
        );
        if (carreraCacheada) {
          setCarreraSeleccionada(carreraCacheada);
          if (cacheBorradorHorarios.vistaActual === 'DOCUMENTOS') {
            setVistaCarrera(carreraCacheada);
            void cargarHorariosGuardados(carreraCacheada);
          }
        }
      }

      const conteos: Record<string, ConteoCarrera> = {};
      const docentesPorCarrera: Record<string, Set<string>> = {};
      const { data: horariosData, error: errorHorarios } = await (supabase as any)
        .from('horarios')
        .select('profesor_id, profesores(carrera_id)');

      if (!errorHorarios) {
        for (const fila of horariosData ?? []) {
          const carreraId = fila.profesores?.carrera_id;
          const profesorId = fila.profesor_id;
          if (!carreraId) continue;
          const clave = String(carreraId);
          const actual = conteos[clave] ?? { clases: 0, docentes: 0 };
          actual.clases += 1;
          conteos[clave] = actual;
          const docentes = docentesPorCarrera[clave] ?? new Set<string>();
          if (profesorId) docentes.add(String(profesorId));
          docentesPorCarrera[clave] = docentes;
        }
        for (const clave of Object.keys(conteos)) {
          conteos[clave].docentes = docentesPorCarrera[clave]?.size ?? 0;
        }
      } else {
        const { data: profesoresData, error: errorProfesores } = await (supabase as any)
          .from('profesores')
          .select('id, carrera_id, horarios(id)');
        if (errorProfesores) throw errorProfesores;
        for (const profesor of profesoresData ?? []) {
          const carreraId = profesor.carrera_id ? String(profesor.carrera_id) : null;
          if (!carreraId) continue;
          const clases = Array.isArray(profesor.horarios) ? profesor.horarios.length : 0;
          if (!clases) continue;
          const actual = conteos[carreraId] ?? { clases: 0, docentes: 0 };
          actual.clases += clases;
          actual.docentes += 1;
          conteos[carreraId] = actual;
        }
      }

      setConteosCarreras(conteos);
    } catch (error) {
      console.error('Error al cargar conteos de carreras:', error);
    } finally {
      setLoadingCarreras(false);
    }
  };

  useEffect(() => {
    void cargarCarrerasConConteos();
  }, []);

  useEffect(() => {
    if (modo === 'DOCENTES') void cargarTodosLosProfesores();
  }, [modo]);

  useEffect(() => {
    if (modo !== 'DOCENTES' || isProcessing || !actualizacionIndividualRef.current) return;
    const profesor = actualizacionIndividualRef.current;
    actualizacionIndividualRef.current = null;
    if (!resultados.length) {
      Alert.alert('Archivo sin horarios', 'No se encontró un horario válido en el archivo seleccionado.');
      return;
    }
    const coincidente = resultados.find((item) =>
      (profesor.nomina && item.nomina !== 'S/N' && item.nomina === profesor.nomina) ||
      limpiarNombre(item.docente) === limpiarNombre(profesor.nombre),
    ) ?? resultados[0];
    if (!profesor.carreraId) {
      Alert.alert('Carrera requerida', 'Este docente no tiene una carrera asignada.');
      return;
    }
    setGuardandoId(profesor.id);
    void (async () => {
      try {
        const { error } = await (supabase as any).rpc('guardar_horario_docente', {
          p_carrera_id: profesor.carreraId,
          p_nombre: profesor.nombre,
          p_nomina: profesor.nomina,
          p_clases: coincidente.clases.map((clase) => ({
            materia: clase.materia,
            grupo: clase.grupo,
            dia: clase.dia,
            hora_inicio: clase.hora_inicio,
            hora_fin: clase.hora_fin,
            aula: clase.aula,
          })),
          p_url_horario: null,
        });
        if (error) throw error;
        await cargarTodosLosProfesores();
        Alert.alert('Horario actualizado', `Se reemplazó el horario de ${profesor.nombre}.`);
      } catch (error: any) {
        console.error('Error al reemplazar horario:', error);
        Alert.alert('Error', error?.message ?? 'No se pudo actualizar el horario.');
      } finally {
        setGuardandoId(null);
      }
    })();
  }, [isProcessing, resultados, modo]);

  const handleFileUpload = (event: any) => {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      procesarLote(files);
    }
    event.target.value = ''; // permite elegir de nuevo los mismos archivos
  };

  const handleFileUploadIndividual = (profesor: ProfesorConHorarios, event: any) => {
    const files = Array.from(event.target.files ?? []) as File[];
    if (!files.length) return;
    actualizacionIndividualRef.current = profesor;
    procesarLote(files);
    event.target.value = '';
  };

  const cargarTodosLosProfesores = async () => {
    setLoadingHorarios(true);
    try {
      let respuesta = await (supabase as any)
        .from('profesores')
        .select(`
          id,
          nombre,
          nomina,
          carrera_id,
          carreras (id, nombre, siglas),
          horarios (
            id, materia, grupo, dia, hora_inicio, hora_fin, aula
          )
        `)
        .order('nombre');

      if (respuesta.error) {
        respuesta = await (supabase as any)
          .from('profesores')
          .select(`
            id,
            nombre,
            carrera_id,
            carreras (id, nombre, siglas),
            horarios (
              id, materia, grupo, dia, hora_inicio, hora_fin, aula
            )
          `)
          .order('nombre');
      }
      if (respuesta.error) throw respuesta.error;

      setProfesoresGuardados((respuesta.data ?? []).map((profesor: any) => ({
        id: String(profesor.id),
        nombre: String(profesor.nombre ?? 'SIN NOMBRE'),
        nomina: profesor.nomina ? String(profesor.nomina) : null,
        carreraId: profesor.carrera_id ? String(profesor.carrera_id) : null,
        carreraNombre: profesor.carreras?.nombre ? String(profesor.carreras.nombre) : null,
        horarios: (profesor.horarios ?? []).map((horario: any) => ({
          id: String(horario.id),
          materia: String(horario.materia ?? ''),
          grupo: horario.grupo ?? null,
          dia: String(horario.dia ?? ''),
          hora_inicio: String(horario.hora_inicio ?? ''),
          hora_fin: String(horario.hora_fin ?? ''),
          aula: horario.aula ?? null,
        })),
      })));
    } catch (error: any) {
      console.error('Error al cargar docentes:', error);
      Alert.alert('Error', error?.message ?? 'No se pudieron cargar los docentes.');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const cargarHorariosGuardados = async (carrera: Carrera) => {
    setVistaCarrera(carrera);
    setSeleccionados([]);
    guardarEstadoBorradorHorarios('DOCUMENTOS', carrera.id);
    setLoadingHorarios(true);
    setProfesoresGuardados([]);
    try {
      const { data, error } = await (supabase as any)
        .from('profesores')
        .select(`
          id,
          nombre,
          nomina,
          url_horario,
          nombre_archivo,
          horarios (
            id,
            materia,
            grupo,
            dia,
            hora_inicio,
            hora_fin,
            aula,
            created_at
          )
        `)
        .eq('carrera_id', carrera.id)
        .order('nombre');

      if (error) throw error;
      setProfesoresGuardados((data ?? []).map((profesor: any) => ({
        id: String(profesor.id),
        nombre: String(profesor.nombre ?? 'SIN NOMBRE'),
        nomina: profesor.nomina ? String(profesor.nomina) : null,
        urlHorario: profesor.url_horario ? String(profesor.url_horario) : null,
        nombreArchivo: profesor.nombre_archivo ? String(profesor.nombre_archivo) : null,
        carreraId: carrera.id,
        carreraNombre: carrera.nombre,
        horarios: (profesor.horarios ?? []).map((horario: any) => ({
          id: String(horario.id),
          materia: String(horario.materia ?? ''),
          grupo: horario.grupo ?? null,
          dia: String(horario.dia ?? ''),
          hora_inicio: String(horario.hora_inicio ?? ''),
          hora_fin: String(horario.hora_fin ?? ''),
          aula: horario.aula ?? null,
          created_at: horario.created_at ?? null,
        })),
      })).filter((profesor: ProfesorConHorarios) => profesor.horarios.length > 0));
    } catch (error: any) {
      console.error('Error al cargar horarios guardados:', error);
      setProfesoresGuardados([]);
      Alert.alert('Error', error?.message ?? 'No se pudieron cargar los horarios.');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const confirmarEliminacion = (mensaje: string, eliminar: () => Promise<void>) => {
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) void eliminar();
      return;
    }
    Alert.alert('Eliminar horario', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void eliminar() },
    ]);
  };

  const toggleSeleccionado = (id: string) => {
    setSeleccionados((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const eliminarSeleccionados = () => {
    if (!seleccionados.length) return;
    const ids = [...seleccionados];
    confirmarEliminacion(
      `¿Eliminar ${ids.length} horario${ids.length === 1 ? '' : 's'} seleccionado${ids.length === 1 ? '' : 's'} y sus respaldos PDF?`,
      async () => {
        setEliminandoId('masivo');
        try {
          const seleccionadosData = profesoresGuardados.filter((profesor) => ids.includes(profesor.id));
          const rutasPdf = seleccionadosData
            .map((profesor) => profesor.urlHorario)
            .filter((ruta): ruta is string => !!ruta);

          const { error: errorHorarios } = await (supabase as any)
            .from('horarios')
            .delete()
            .in('profesor_id', ids);
          if (errorHorarios) throw errorHorarios;

          if (rutasPdf.length) {
            const { error: errorStorage } = await (supabase as any)
              .storage
              .from('horarios-pdfs')
              .remove(rutasPdf);
            if (errorStorage) throw errorStorage;
          }

          const { error: errorProfesores } = await (supabase as any)
            .from('profesores')
            .update({ url_horario: null, nombre_archivo: null })
            .in('id', ids);
          if (errorProfesores) {
            const fallback = await (supabase as any)
              .from('profesores')
              .update({ url_horario: null })
              .in('id', ids);
            if (fallback.error) throw fallback.error;
          }

          setSeleccionados([]);
          if (vistaCarrera) await cargarHorariosGuardados(vistaCarrera);
          await cargarCarrerasConConteos();
        } catch (error: any) {
          console.error('Error al eliminar horarios seleccionados:', error);
          Alert.alert('Error', error?.message ?? 'No se pudieron eliminar los horarios seleccionados.');
        } finally {
          setEliminandoId(null);
        }
      },
    );
  };

  const abrirPdfPublicado = async (profesor: ProfesorConHorarios) => {
    if (!profesor.urlHorario) return;
    try {
      const { data, error } = await (supabase as any)
        .storage
        .from('horarios-pdfs')
        .createSignedUrl(profesor.urlHorario, 300);
      if (error) throw error;
      const url = data?.signedUrl;
      if (!url) throw new Error('No se pudo generar el enlace temporal.');
      setVisorPdf({
        nombre: profesor.nombreArchivo || `${profesor.nombre}.pdf`,
        url,
      });
      setVisorVisible(true);
    } catch (error: any) {
      console.error('Error al abrir PDF:', error);
      Alert.alert('Error', error?.message ?? 'No se pudo abrir el PDF.');
    }
  };

  const subirPdfIndividual = async (profesor: ProfesorConHorarios, event: any) => {
    const archivo = (Array.from(event.target.files ?? []) as File[])[0];
    if (!archivo) return;
    event.target.value = '';
    if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf') {
      Alert.alert('Archivo inválido', 'Selecciona un archivo PDF.');
      return;
    }
    setGuardandoId(profesor.id);
    try {
      const carreraId = profesor.carreraId;
      if (!carreraId) throw new Error('El docente no tiene carrera asignada.');
      const nomina = (profesor.nomina || profesor.id).replace(/[^A-Za-z0-9_-]/g, '_');
      const path = `${carreraId}/${nomina}_${Date.now()}.pdf`;
      const { data, error } = await (supabase as any)
        .storage
        .from('horarios-pdfs')
        .upload(path, archivo, { upsert: true, contentType: 'application/pdf' });
      if (error) throw error;
      const urlHorario = data?.path ?? path;
      const { error: errorActualizacion } = await (supabase as any)
        .from('profesores')
        .update({ url_horario: urlHorario, nombre_archivo: archivo.name })
        .eq('id', profesor.id);
      if (errorActualizacion) throw errorActualizacion;
      setProfesoresGuardados((prev) => prev.map((item) =>
        item.id === profesor.id
          ? { ...item, urlHorario, nombreArchivo: archivo.name }
          : item,
      ));
    } catch (error: any) {
      console.error('Error al subir PDF:', error);
      Alert.alert('Error', error?.message ?? 'No se pudo subir el PDF.');
    } finally {
      setGuardandoId(null);
    }
  };

  const actualizarProfesor = async (profesorId: string) => {
    const nombre = limpiarNombre(nombreProfesorBorrador) ?? '';
    const nomina = nominaProfesorBorrador.trim().toUpperCase().replace(/\s/g, '') || null;
    if (!nombre) {
      Alert.alert('Datos incompletos', 'El nombre del docente no puede estar vacío.');
      return;
    }
    setGuardandoId(profesorId);
    try {
      let respuesta = await (supabase as any)
        .from('profesores')
        .update({ nombre, nomina })
        .eq('id', profesorId);
      if (respuesta.error) {
        respuesta = await (supabase as any)
          .from('profesores')
          .update({ nombre })
          .eq('id', profesorId);
      }
      if (respuesta.error) throw respuesta.error;
      setProfesoresGuardados((prev) => prev.map((profesor) =>
        profesor.id === profesorId ? { ...profesor, nombre, nomina } : profesor,
      ));
      setEditandoProfesorId(null);
    } catch (error: any) {
      console.error('Error al actualizar docente:', error);
      Alert.alert('Error', error?.message ?? 'No se pudo actualizar el docente.');
    } finally {
      setGuardandoId(null);
    }
  };

  const actualizarClaseGuardada = async (profesorId: string, clase: HorarioGuardado, cambios: ClaseSemanal) => {
    setGuardandoId(clase.id ?? null);
    try {
      const horaInicio = parseHora(cambios.hora_inicio) ?? cambios.hora_inicio;
      const horaFin = parseHora(cambios.hora_fin) ?? cambios.hora_fin;
      const materia = limpiarNombre(cambios.materia) ?? '';
      if (!materia || !horaInicio || !horaFin) throw new Error('Materia y horas son obligatorias.');
      const { error } = await (supabase as any)
        .from('horarios')
        .update({
          materia,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          aula: cambios.aula || null,
          grupo: cambios.grupo || null,
        })
        .eq('id', clase.id);
      if (error) throw error;
      setProfesoresGuardados((prev) => prev.map((profesor) =>
        profesor.id === profesorId
          ? {
              ...profesor,
              horarios: profesor.horarios.map((item) => item.id === clase.id
                ? { ...item, materia, hora_inicio: horaInicio, hora_fin: horaFin, aula: cambios.aula || null, grupo: cambios.grupo || null }
                : item),
            }
          : profesor,
      ));
    } finally {
      setGuardandoId(null);
    }
  };

  const agregarClaseGuardada = async (profesor: ProfesorConHorarios, dia: string, cambios: ClaseSemanal) => {
    setGuardandoId('nueva');
    try {
      const horaInicio = parseHora(cambios.hora_inicio) ?? cambios.hora_inicio;
      const horaFin = parseHora(cambios.hora_fin) ?? cambios.hora_fin;
      const materia = limpiarNombre(cambios.materia) ?? '';
      if (!materia || !horaInicio || !horaFin) throw new Error('Materia y horas son obligatorias.');
      const { data, error } = await (supabase as any)
        .from('horarios')
        .insert({
          profesor_id: profesor.id,
          materia,
          grupo: cambios.grupo || '',
          dia,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          aula: cambios.aula || '',
        })
        .select('id, materia, grupo, dia, hora_inicio, hora_fin, aula')
        .single();
      if (error) throw error;
      const nueva: HorarioGuardado = {
        id: String(data.id),
        materia: String(data.materia),
        grupo: data.grupo ?? null,
        dia: String(data.dia),
        hora_inicio: String(data.hora_inicio),
        hora_fin: String(data.hora_fin),
        aula: data.aula ?? null,
      };
      setProfesoresGuardados((prev) => prev.map((item) =>
        item.id === profesor.id ? { ...item, horarios: [...item.horarios, nueva] } : item,
      ));
    } finally {
      setGuardandoId(null);
    }
  };

  const eliminarClaseGuardada = (profesorId: string, horarioId: string) => {
    confirmarEliminacion('¿Eliminar esta clase del horario guardado?', async () => {
      setEliminandoId(horarioId);
      try {
        const { error } = await (supabase as any).from('horarios').delete().eq('id', horarioId);
        if (error) throw error;
        setProfesoresGuardados((prev) => prev
          .map((profesor) => profesor.id === profesorId
            ? { ...profesor, horarios: profesor.horarios.filter((horario) => horario.id !== horarioId) }
            : profesor)
          .filter((profesor) => profesor.horarios.length > 0));
      } catch (error: any) {
        console.error('Error al eliminar la clase:', error);
        Alert.alert('Error', error?.message ?? 'No se pudo eliminar la clase.');
      } finally {
        setEliminandoId(null);
      }
    });
  };

  const eliminarHorarioDocente = (profesor: ProfesorConHorarios) => {
    confirmarEliminacion(`¿Eliminar todo el horario de ${profesor.nombre}?`, async () => {
      setEliminandoId(profesor.id);
      try {
        const { error } = await (supabase as any).from('horarios').delete().eq('profesor_id', profesor.id);
        if (error) throw error;
        setProfesoresGuardados((prev) => prev.filter((item) => item.id !== profesor.id));
        setSeleccionados((prev) => prev.filter((id) => id !== profesor.id));
        await cargarCarrerasConConteos();
      } catch (error: any) {
        console.error('Error al eliminar el horario:', error);
        Alert.alert('Error', error?.message ?? 'No se pudo eliminar el horario.');
      } finally {
        setEliminandoId(null);
      }
    });
  };

  const getSemaforoColor = (estado: string) => {
    if (estado === 'VERDE') return '#10b981';
    if (estado === 'AMARILLO') return '#eab308';
    return '#f43f5e';
  };

  const getSemaforoIcon = (estado: string, color: string) => {
    if (estado === 'VERDE') return <CheckCircle size={16} color={color} />;
    if (estado === 'AMARILLO') return <AlertTriangle size={16} color={color} />;
    return <XCircle size={16} color={color} />;
  };

  const profesoresFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return profesoresGuardados.filter((profesor) =>
      (!termino || profesor.nombre.toLowerCase().includes(termino)) &&
      (filtroCarreraId === 'TODAS' || profesor.carreraId === filtroCarreraId),
    );
  }, [busqueda, filtroCarreraId, profesoresGuardados]);

  if (loadingCarreras) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', paddingTop: 50 }]}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>CARGANDO CARRERAS...</Text>
      </View>
    );
  }

  if (modo === 'HORARIOS' && vistaCarrera) {
    const documentosFiltrados = profesoresGuardados.filter((profesor) => {
      const termino = busquedaDocumentos.trim().toLowerCase();
      if (!termino) return true;
      return profesor.nombre.toLowerCase().includes(termino) ||
        (profesor.nombreArchivo ?? '').toLowerCase().includes(termino);
    });
    const idsFiltrados = documentosFiltrados.map((profesor) => profesor.id);
    const todosFiltradosSeleccionados = idsFiltrados.length > 0 && idsFiltrados.every((id) => seleccionados.includes(id));

    const toggleTodosFiltrados = () => {
      setSeleccionados((prev) => todosFiltradosSeleccionados
        ? prev.filter((id) => !idsFiltrados.includes(id))
        : Array.from(new Set([...prev, ...idsFiltrados])));
    };

    return (
      <View style={styles.container}>
        <View style={styles.documentosToolbar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              limpiar();
              setBusquedaDocumentos('');
              setSeleccionados([]);
              setVistaCarrera(null);
              setProfesoresGuardados([]);
              void cargarCarrerasConConteos();
            }}
          >
            <ChevronLeft size={20} color="#a855f7" />
            <Text style={styles.backText}>Volver a Carreras</Text>
          </TouchableOpacity>
          <View style={[styles.documentosSearch, !isDarkMode && styles.documentosSearchLight]}>
            <Search size={15} color="#71717a" />
            <TextInput
              value={busquedaDocumentos}
              onChangeText={setBusquedaDocumentos}
              placeholder="Buscar archivo o docente..."
              placeholderTextColor="#71717a"
              style={[styles.documentosSearchInput, !isDarkMode && styles.textLight]}
            />
          </View>
          <Text style={[styles.documentosCount, !isDarkMode && styles.documentosCountLight]}>
            {profesoresGuardados.length} documento{profesoresGuardados.length === 1 ? '' : 's'}
          </Text>
          <TouchableOpacity
            style={styles.subirMasivoBtn}
            onPress={() => {
              limpiar();
              setSeleccionados([]);
              if (vistaCarrera) {
                guardarEstadoBorradorHorarios('CARGA', vistaCarrera.id);
              }
              setCarreraSeleccionada(vistaCarrera);
              setVistaCarrera(null);
            }}
          >
            <Plus size={15} color="#ffffff" />
            <Text style={styles.subirMasivoText}>SUBIR ARCHIVOS</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.seleccionToolbar, !isDarkMode && styles.seleccionToolbarLight]}>
          <TouchableOpacity
            style={styles.seleccionarTodos}
            onPress={toggleTodosFiltrados}
            disabled={idsFiltrados.length === 0}
          >
            {todosFiltradosSeleccionados
              ? <CheckSquare size={17} color="#a855f7" />
              : <Square size={17} color={isDarkMode ? '#a1a1aa' : '#64748b'} />}
            <Text style={[styles.seleccionarTodosText, !isDarkMode && styles.textLight]}>
              {todosFiltradosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </Text>
          </TouchableOpacity>
          {seleccionados.length > 0 && (
            <TouchableOpacity
              style={styles.eliminarMasivoBtn}
              disabled={eliminandoId === 'masivo'}
              onPress={eliminarSeleccionados}
            >
              <Trash2 size={14} color="#ffffff" />
              <Text style={styles.eliminarMasivoText}>
                {eliminandoId === 'masivo'
                  ? 'ELIMINANDO...'
                  : `ELIMINAR SELECCIONADOS (${seleccionados.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingHorarios ? (
          <View style={[styles.loadingCard, !isDarkMode && styles.loadingCardLight]}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={[styles.loadingText, !isDarkMode && styles.textLight]}>CARGANDO DOCUMENTOS...</Text>
          </View>
        ) : documentosFiltrados.length === 0 ? (
          <Text style={[styles.emptyText, !isDarkMode && styles.emptyTextLight]}>
            No hay documentos que coincidan.
          </Text>
        ) : (
          <ScrollView style={styles.listaScroll}>
            {documentosFiltrados.map((profesor) => (
              <View key={profesor.id} style={[styles.documentoRow, !isDarkMode && styles.documentoRowLight]}>
                <TouchableOpacity
                  style={styles.documentoCheckbox}
                  onPress={() => toggleSeleccionado(profesor.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: seleccionados.includes(profesor.id) }}
                >
                  {seleccionados.includes(profesor.id)
                    ? <CheckSquare size={18} color="#a855f7" />
                    : <Square size={18} color={isDarkMode ? '#a1a1aa' : '#64748b'} />}
                </TouchableOpacity>
                <View style={[styles.documentoIcono, !isDarkMode && styles.documentoIconoLight]}>
                  <FileText size={20} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  {profesor.urlHorario ? (
                    <TouchableOpacity onPress={() => void abrirPdfPublicado(profesor)}>
                      <Text style={[styles.documentoTituloEnlace, !isDarkMode && styles.documentoTituloEnlaceLight]}>
                        {profesor.nombreArchivo || `${profesor.nombre}.pdf`}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.documentoTitulo, !isDarkMode && styles.textLight]}>
                      {profesor.nombreArchivo || `${profesor.nombre}.pdf`}
                    </Text>
                  )}
                  <Text style={[styles.documentoMeta, !isDarkMode && styles.documentoMetaLight]}>
                    {profesor.nombre} · {profesor.horarios.length} CLASE{profesor.horarios.length === 1 ? '' : 'S'}
                  </Text>
                </View>
                <View style={[styles.estadoBadge, profesor.urlHorario ? styles.estadoPublicado : styles.estadoSinPdf]}>
                  <Text style={[styles.estadoBadgeText, profesor.urlHorario ? styles.estadoPublicadoText : styles.estadoSinPdfText]}>
                    {profesor.urlHorario ? 'Publicado' : 'Sin respaldo PDF'}
                  </Text>
                </View>
                {!profesor.urlHorario && Platform.OS === 'web' && (
                  <label style={{ cursor: 'pointer' }}>
                    <View style={styles.documentoSubir}><UploadCloud size={14} color="#a855f7" /></View>
                    <input
                      type="file"
                      accept=".pdf"
                      style={{ display: 'none' }}
                      onChange={(event) => void subirPdfIndividual(profesor, event)}
                      disabled={guardandoId === profesor.id}
                    />
                  </label>
                )}
                <TouchableOpacity
                  disabled={eliminandoId === profesor.id}
                  onPress={() => eliminarHorarioDocente(profesor)}
                  style={styles.documentoEliminar}
                >
                  <Trash2 size={16} color="#f43f5e" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <Modal
          visible={visorVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVisorVisible(false)}
        >
          <View style={styles.visorOverlay}>
            <View style={[styles.visorModal, !isDarkMode && styles.visorModalLight]}>
              <View style={styles.visorHeader}>
                <Text numberOfLines={1} style={[styles.visorTitulo, !isDarkMode && styles.textLight]}>
                  {visorPdf?.nombre ?? 'PDF'}
                </Text>
                <View style={styles.visorAcciones}>
                  {Platform.OS === 'web' && visorPdf?.url && (
                    <TouchableOpacity
                      style={styles.visorAbrir}
                      onPress={() => window.open(visorPdf.url, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink size={14} color="#a855f7" />
                      <Text style={styles.actionTextPurple}>Abrir en pestaña nueva</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setVisorVisible(false)} style={styles.visorCerrar}>
                    <X size={18} color={isDarkMode ? '#e4e4e7' : '#475569'} />
                  </TouchableOpacity>
                </View>
              </View>
              {Platform.OS === 'web' && visorPdf?.url ? (
                <iframe
                  src={visorPdf.url}
                  title={visorPdf.nombre}
                  style={{ width: '100%', height: '100%', border: 0, background: '#52525b' }}
                />
              ) : (
                <View style={styles.visorVacio}>
                  <Text style={styles.emptyText}>Vista previa disponible solo en web.</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (modo === 'HORARIOS' && !carreraSeleccionada) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, !isDarkMode && styles.textLight]}>SELECCIONA UNA CARRERA</Text>
        {carreras.length === 0 ? (
          <Text style={[styles.emptyText, !isDarkMode && styles.emptyTextLight]}>
            No hay carreras registradas en la base de datos.
          </Text>
        ) : (
          <ScrollView style={styles.listaScroll}>
            {carreras.map((carrera) => (
              (() => {
                const conteo = conteosCarreras[carrera.id];
                const docentes = conteo?.docentes ?? 0;
                const clases = conteo?.clases ?? 0;
                return (
              <View key={carrera.id} style={[styles.cardAviso, !isDarkMode && styles.cardAvisoLight]}>
                <View style={styles.cardHeader}>
                  <GraduationCap size={20} color="#a1a1aa" style={styles.cardIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, !isDarkMode && styles.cardTitleLight]}>{carrera.nombre}</Text>
                    <Text style={[styles.cardSubtitle, !isDarkMode && styles.cardSubtitleLight]}>
                      CARRERA | Siglas: {carrera.siglas || 'N/A'}
                    </Text>
                  </View>
                  <View style={[
                    styles.conteoCarreraBadge,
                    docentes > 0 ? styles.conteoCarreraConDatos : styles.conteoCarreraSinDatos,
                    !isDarkMode && (docentes > 0 ? styles.conteoCarreraConDatosLight : styles.conteoCarreraSinDatosLight),
                  ]}>
                    <Text style={[
                      styles.conteoCarreraText,
                      docentes > 0 ? styles.conteoCarreraTextConDatos : styles.conteoCarreraTextSinDatos,
                      !isDarkMode && docentes > 0 ? styles.conteoCarreraTextConDatosLight : undefined,
                    ]}>
                      {docentes > 0 ? `${docentes} docente${docentes === 1 ? '' : 's'} · ${clases} clase${clases === 1 ? '' : 's'}` : 'Sin horarios'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.cardActions, !isDarkMode && styles.cardActionsLight]}>
                  <TouchableOpacity onPress={() => void cargarHorariosGuardados(carrera)}>
                    <Text style={styles.actionTextGreen}>VER HORARIOS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    guardarEstadoBorradorHorarios('CARGA', carrera.id);
                    setCarreraSeleccionada(carrera);
                  }}>
                    <Text style={styles.actionTextBlue}>CARGAR HORARIOS</Text>
                  </TouchableOpacity>
                </View>
              </View>
                );
              })()
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  if (modo === 'DOCENTES' && !carreraSeleccionada) {
    return (
      <View style={styles.container}>
        <View style={styles.filtersRow}>
          <View style={[styles.searchBox, !isDarkMode && styles.searchBoxLight]}>
            <Search size={16} color="#71717a" />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar docente..."
              placeholderTextColor="#71717a"
              style={[styles.searchInput, !isDarkMode && styles.textLight]}
            />
          </View>
          <TouchableOpacity onPress={() => void cargarTodosLosProfesores()} style={styles.refreshButton}>
            <RefreshCw size={15} color="#a855f7" />
          </TouchableOpacity>
        </View>

        <View style={styles.carreraFiltersContainer}>
          <TouchableOpacity
            style={[styles.carreraArrowBtn, !isDarkMode && styles.carreraArrowBtnLight]}
            onPress={() => desplazarCarreras('izquierda')}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color={isDarkMode ? '#a1a1aa' : '#64748b'} />
          </TouchableOpacity>

          <ScrollView
            ref={scrollCarrerasRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              scrollCarrerasOffsetRef.current = event.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
            style={styles.carreraFilters}
            contentContainerStyle={styles.carreraFiltersContent}
          >
            {[
              { id: 'TODAS', nombre: 'Todas' },
              ...carreras,
            ].map((carrera) => (
              <TouchableOpacity
                key={carrera.id}
                onPress={() => setFiltroCarreraId(carrera.id)}
                style={[
                  styles.carreraChip,
                  filtroCarreraId === carrera.id && styles.carreraChipActive,
                  !isDarkMode && styles.carreraChipLight,
                  !isDarkMode && filtroCarreraId === carrera.id && styles.carreraChipActiveLight,
                ]}
              >
                <Text style={[
                  styles.carreraChipText,
                  filtroCarreraId === carrera.id && styles.carreraChipTextActive,
                  !isDarkMode && filtroCarreraId === carrera.id && styles.carreraChipTextActiveLight,
                ]}>{carrera.nombre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.carreraArrowBtn, !isDarkMode && styles.carreraArrowBtnLight]}
            onPress={() => desplazarCarreras('derecha')}
            activeOpacity={0.7}
          >
            <ChevronRight size={18} color={isDarkMode ? '#a1a1aa' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {loadingHorarios ? (
          <View style={[styles.loadingCard, !isDarkMode && styles.loadingCardLight]}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={[styles.loadingText, !isDarkMode && styles.textLight]}>CARGANDO DOCENTES...</Text>
          </View>
        ) : profesoresFiltrados.length === 0 ? (
          <Text style={[styles.emptyText, !isDarkMode && styles.emptyTextLight]}>
            No hay docentes que coincidan con los filtros.
          </Text>
        ) : (
          <ScrollView style={styles.listaScroll}>
            {profesoresFiltrados.map((profesor) => (
              <View key={profesor.id} style={[styles.cardAviso, !isDarkMode && styles.cardAvisoLight]}>
                <View style={styles.cardHeader}>
                  {editandoProfesorId === profesor.id ? (
                    <View style={{ flex: 1, gap: 8 }}>
                      <TextInput
                        value={nombreProfesorBorrador}
                        onChangeText={setNombreProfesorBorrador}
                        placeholder="Nombre del docente"
                        placeholderTextColor="#71717a"
                        style={[styles.input, isDarkMode ? null : styles.inputLight]}
                      />
                      <TextInput
                        value={nominaProfesorBorrador}
                        onChangeText={setNominaProfesorBorrador}
                        placeholder="Nómina"
                        placeholderTextColor="#71717a"
                        autoCapitalize="characters"
                        style={[styles.input, isDarkMode ? null : styles.inputLight, { maxWidth: 180 }]}
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity disabled={guardandoId === profesor.id} onPress={() => void actualizarProfesor(profesor.id)}>
                          <Text style={styles.saveText}>{guardandoId === profesor.id ? 'GUARDANDO...' : 'GUARDAR'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditandoProfesorId(null)}>
                          <Text style={styles.cancelText}>CANCELAR</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, !isDarkMode && styles.cardTitleLight]}>{profesor.nombre}</Text>
                    <Text style={[styles.cardSubtitle, !isDarkMode && styles.cardSubtitleLight]}>
                        {profesor.horarios.length} CLASE{profesor.horarios.length === 1 ? '' : 'S'}
                        {profesor.nomina ? ` · Nómina: ${profesor.nomina}` : ''}
                        {profesor.carreraNombre ? ` · ${profesor.carreraNombre}` : ''}
                    </Text>
                  </View>
                  )}
                  {editandoProfesorId !== profesor.id && (
                    <View style={styles.docenteActions}>
                      <TouchableOpacity onPress={() => {
                        setEditandoProfesorId(profesor.id);
                        setNombreProfesorBorrador(profesor.nombre);
                        setNominaProfesorBorrador(profesor.nomina ?? '');
                      }}>
                        <View style={styles.docenteActionRow}><Pencil size={13} color="#3b82f6" /><Text style={styles.actionTextBlue}>EDITAR DOCENTE</Text></View>
                      </TouchableOpacity>
                      {Platform.OS === 'web' && (
                        <label style={{ cursor: 'pointer', marginTop: 8 }}>
                          <View style={styles.docenteActionRow}><UploadCloud size={13} color="#a855f7" /><Text style={styles.actionTextPurple}>ACTUALIZAR ARCHIVO</Text></View>
                          <input
                            type="file"
                            accept=".pdf,.xlsx,.xls,.csv"
                            style={{ display: 'none' }}
                            onChange={(event) => handleFileUploadIndividual(profesor, event)}
                            disabled={isProcessing || isSaving}
                          />
                        </label>
                      )}
                      <TouchableOpacity
                        style={{ marginTop: 8 }}
                        disabled={eliminandoId === profesor.id}
                        onPress={() => eliminarHorarioDocente(profesor)}
                      >
                        <Text style={[styles.actionTextRed, eliminandoId === profesor.id && { opacity: 0.5 }]}>ELIMINAR HORARIO</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={{ padding: 12 }}>
                  <HorarioSemanal
                    clases={profesor.horarios}
                    isDarkMode={isDarkMode}
                    eliminandoId={eliminandoId}
                    guardandoId={guardandoId}
                    onEliminarClase={(horarioId) => eliminarClaseGuardada(profesor.id, horarioId)}
                    onActualizarClase={(clase, cambios) => actualizarClaseGuardada(profesor.id, clase as HorarioGuardado, cambios)}
                    onAgregarClase={(dia, cambios) => agregarClaseGuardada(profesor, dia, cambios)}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => {
          limpiar();
          setCarreraSeleccionada(null);
          void cargarCarrerasConConteos();
        }}
        disabled={isProcessing || isSaving}
      >
        <ChevronLeft size={20} color="#a855f7" />
        <Text style={styles.backText}>Volver a Carreras</Text>
      </TouchableOpacity>

      <View style={styles.headerCarrera}>
        <Text style={styles.headerCarreraTitle}>Cargando horarios para:</Text>
        <Text style={[styles.headerCarreraName, !isDarkMode && styles.textLight]}>{carreraSeleccionada?.nombre}</Text>
      </View>
      
      <View style={[styles.dropZone, !isDarkMode && styles.dropZoneLight, isProcessing && { opacity: 0.5 }]}>
        <UploadCloud size={40} color="#a855f7" style={{ marginBottom: 12 }} />
        <Text style={[styles.dropTitle, !isDarkMode && styles.textLight]}>Carga Masiva de Horarios</Text>
        <Text style={styles.dropSubtitle}>Sube tus archivos Excel, CSV o lote de PDFs</Text>
        
        {Platform.OS === 'web' && (
          <div style={{ marginTop: 20 }}>
            <input 
              type="file" 
              multiple 
              accept=".pdf, .xlsx, .csv" 
              onChange={handleFileUpload} 
              disabled={isProcessing || isSaving}
              style={{ color: isDarkMode ? '#e4e4e7' : '#0f172a', fontFamily: 'monospace', cursor: (isProcessing || isSaving) ? 'not-allowed' : 'pointer' }}
            />
          </div>
        )}
      </View>

      {isProcessing && (
        <View style={[styles.progressCard, !isDarkMode && styles.progressCardLight]}>
          <Text style={styles.progressWarning}>Procesando lote: los escaneos tomarán varios minutos. Puedes seguir usando el panel.</Text>
          <View style={[styles.progressBarBg, !isDarkMode && styles.progressBarBgLight]}>
            <View style={[styles.progressBarFill, { width: `${progreso.porcentaje}%` }]} />
          </View>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressText}>{progreso.mensaje}</Text>
            <Text style={styles.progressPercentage}>{progreso.porcentaje}%</Text>
          </View>
          <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 10 }} onPress={cancelar}>
            <Text style={styles.actionTextRed}>CANCELAR</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isProcessing && !!progreso.mensaje && (isSaving || progreso.mensaje.startsWith('Guardados')) && (
        <Text style={[styles.mensajeFinal, !isDarkMode && styles.textLight]}>{progreso.mensaje}</Text>
      )}

      {erroresArchivos.length > 0 && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitulo}>ARCHIVOS QUE NO SE PUDIERON LEER ({erroresArchivos.length})</Text>
          {erroresArchivos.map((e, i) => (
            <Text key={i} style={styles.errorTexto}>• {e.mensaje.startsWith(e.archivo) ? e.mensaje : `${e.archivo}: ${e.mensaje}`}</Text>
          ))}
        </View>
      )}

      {aulasPendientes.length > 0 && (
        <View style={[styles.avisoCard, !isDarkMode && styles.avisoCardLight]}>
          <Text style={styles.avisoTitulo}>AULAS POR CONFIRMAR ({aulasPendientes.length})</Text>
          <Text style={styles.avisoTexto}>
            Estas aulas salieron de un escaneo y el sistema aún no las conoce. Si una está mal leída, corrígela aquí y se cambia en todo el lote.
          </Text>
          {aulasPendientes.slice(0, 15).map((a) => (
            <FilaAulaPendiente key={a.aula} aula={a.aula} veces={a.veces} sugerencia={a.sugerencia} isDarkMode={isDarkMode}
              onConfirmar={() => confirmarAula(a.aula)} onCorregir={(nueva) => corregirAula(a.aula, nueva)} />
          ))}
          {aulasPendientes.length > 15 && <Text style={styles.avisoTexto}>... y {aulasPendientes.length - 15} más.</Text>}
        </View>
      )}

      {resultados.length > 0 && (
        <View style={[styles.tableCard, !isDarkMode && styles.tableCardLight]}>
          <View style={[styles.tableHeader, !isDarkMode && styles.tableHeaderLight]}>
            <Text style={[styles.tableTitle, !isDarkMode && styles.tableTitleLight]}>VISTA PREVIA DE CARGA</Text>
            
            {/* AQUÍ ESTÁ EL BOTÓN CONECTADO AL EVENTO ONPRESS */}
            <TouchableOpacity 
              style={[styles.saveBtn, (isProcessing || isSaving || guardables === 0) && { opacity: 0.5 }]} 
              disabled={isProcessing || isSaving || guardables === 0 || !carreraSeleccionada}
              onPress={() => {
                if (carreraSeleccionada && !isProcessing && !isSaving && guardables > 0) {
                  void guardarEnBaseDeDatos(carreraSeleccionada.id);
                }
              }}
            >
              <Save size={16} color="#fff" />
              <Text style={styles.saveBtnText}>{isSaving ? 'GUARDANDO...' : `GUARDAR (${guardables})`}</Text>
            </TouchableOpacity>

          </View>

          <ScrollView style={styles.tableScroll}>
            {resultados.map((doc) => {
              const conObservaciones = doc.estado !== 'VERDE' ||
                doc.clases.some((clase) => !!clase.dudosa || !clase.aula);
              return (
                <View key={doc.id} style={[styles.previewRow, !isDarkMode && styles.previewRowLight]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewArchivo, !isDarkMode && styles.textLight]}>
                      {doc.nombreArchivo}
                    </Text>
                    <Text style={[styles.previewDocente, !isDarkMode && styles.previewDocenteLight]}>
                      {doc.docente || 'SIN NOMBRE'} · Nómina: {doc.nomina === 'S/N' ? 'S/N' : doc.nomina}
                    </Text>
                  </View>
                  <Text style={[styles.previewClases, !isDarkMode && styles.previewClasesLight]}>
                    {doc.clases.length} CLASE{doc.clases.length === 1 ? '' : 'S'}
                  </Text>
                  <View style={[styles.previewBadge, conObservaciones ? styles.previewBadgeObservacion : styles.previewBadgeListo]}>
                    <Text style={[styles.previewBadgeText, conObservaciones ? styles.previewBadgeObservacionText : styles.previewBadgeListoText]}>
                      {conObservaciones ? 'Con observaciones' : 'Listo'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.previewRemove}
                    onPress={() => acciones.descartarDocente(doc.id)}
                    accessibilityLabel={`Quitar ${doc.nombreArchivo} de la cola`}
                  >
                    <XCircle size={17} color="#71717a" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingVertical: 20, gap: 20 },
  sectionTitle: { color: '#e4e4e7', fontSize: 14, fontWeight: 'bold', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 10 },
  textLight: { color: '#0f172a' },
  emptyText: { color: '#a1a1aa', fontSize: 14, fontStyle: 'italic' },
  emptyTextLight: { color: '#64748b' },
  listaScroll: { maxHeight: '100%' },
  
  cardAviso: { backgroundColor: '#121215', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#a855f7', marginBottom: 16 },
  cardAvisoLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardHeader: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 12, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 6 },
  searchBoxLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  searchInput: { flex: 1, color: '#e4e4e7', fontSize: 13, paddingVertical: 8 },
  refreshButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272a', borderRadius: 6 },
  carreraFiltersContainer: { width: '100%', maxWidth: 800, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', overflow: 'visible' },
  carreraArrowBtn: { width: 32, height: 32, flexShrink: 0, borderRadius: 16, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, zIndex: 10 },
  carreraArrowBtnLight: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  carreraFilters: { flex: 1, minWidth: 0, maxHeight: 44 },
  carreraFiltersContent: { alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingRight: 8 },
  carreraChip: { height: 36, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#27272a', borderRadius: 18, backgroundColor: '#18181b' },
  carreraChipLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  carreraChipActive: { backgroundColor: '#7e22ce', borderColor: '#a855f7' },
  carreraChipActiveLight: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  carreraChipText: { color: '#a1a1aa', fontSize: 11, fontWeight: 'bold' },
  carreraChipTextActive: { color: '#ffffff' },
  carreraChipTextActiveLight: { color: '#6b21a8' },
  documentosToolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  documentosSearch: { flex: 1, minWidth: 220, height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 6 },
  documentosSearchLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  documentosSearchInput: { flex: 1, color: '#e4e4e7', fontSize: 12, paddingVertical: 8 },
  documentosCount: { color: '#a1a1aa', fontSize: 11, fontWeight: 'bold' },
  documentosCountLight: { color: '#64748b' },
  subirMasivoBtn: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#a855f7', borderRadius: 6, paddingHorizontal: 12 },
  subirMasivoText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  seleccionToolbar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#27272a', borderRadius: 6, backgroundColor: '#18181b' },
  seleccionToolbarLight: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  seleccionarTodos: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  seleccionarTodosText: { color: '#a1a1aa', fontSize: 11, fontWeight: 'bold' },
  eliminarMasivoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 8 },
  eliminarMasivoText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  documentoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#121215', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, padding: 14, marginBottom: 10 },
  documentoRowLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  documentoCheckbox: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  documentoIcono: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#27272a' },
  documentoIconoLight: { backgroundColor: '#f1f5f9' },
  documentoTitulo: { color: '#e4e4e7', fontSize: 14, fontWeight: 'bold' },
  documentoTituloEnlace: { color: '#e4e4e7', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' },
  documentoTituloEnlaceLight: { color: '#6d28d9' },
  documentoMeta: { color: '#a1a1aa', fontSize: 11, marginTop: 4 },
  documentoMetaLight: { color: '#64748b' },
  documentoClases: { color: '#a855f7', fontSize: 10, fontWeight: 'bold', marginTop: 6, letterSpacing: 0.8 },
  estadoBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  estadoPublicado: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' },
  estadoSinPdf: { backgroundColor: '#27272a', borderColor: '#3f3f46' },
  estadoBadgeText: { fontSize: 9, fontWeight: 'bold' },
  estadoPublicadoText: { color: '#10b981' },
  estadoSinPdfText: { color: '#a1a1aa' },
  documentoSubir: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  documentoEliminar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  visorOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)', padding: 20 },
  visorModal: { width: '92%', maxWidth: 1000, height: '82%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46' },
  visorModalLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  visorHeader: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  visorTitulo: { flex: 1, color: '#e4e4e7', fontSize: 13, fontWeight: 'bold' },
  visorAcciones: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visorAbrir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visorCerrar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  visorVacio: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  docenteActions: { alignItems: 'flex-end', marginLeft: 12 },
  docenteActionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionTextPurple: { color: '#a855f7', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
  editActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  saveText: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },
  cancelText: { color: '#a1a1aa', fontSize: 11, fontWeight: 'bold' },
  cardIcon: { marginRight: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  cardTitleLight: { color: '#0f172a' },
  cardSubtitle: { fontSize: 12, color: '#a1a1aa' },
  cardSubtitleLight: { color: '#64748b' },
  conteoCarreraBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 12 },
  conteoCarreraConDatos: { backgroundColor: 'rgba(168, 85, 247, 0.14)', borderColor: 'rgba(168, 85, 247, 0.38)' },
  conteoCarreraConDatosLight: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  conteoCarreraSinDatos: { backgroundColor: '#27272a', borderColor: '#3f3f46' },
  conteoCarreraSinDatosLight: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  conteoCarreraText: { fontSize: 10, fontWeight: 'bold' },
  conteoCarreraTextConDatos: { color: '#c084fc' },
  conteoCarreraTextConDatosLight: { color: '#7e22ce' },
  conteoCarreraTextSinDatos: { color: '#a1a1aa' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#27272a' },
  cardActionsLight: { borderTopColor: '#f1f5f9' },
  actionTextBlue: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  loadingCard: { alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180, backgroundColor: '#121215', borderWidth: 1, borderColor: '#27272a', borderRadius: 8 },
  loadingCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  loadingText: { color: '#a1a1aa', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  horarioGuardadoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#27272a' },
  horarioGuardadoRowLight: { borderTopColor: '#e2e8f0' },
  horarioMateria: { color: '#e4e4e7', fontSize: 13, fontWeight: 'bold', marginBottom: 3 },
  horarioDetalle: { color: '#a1a1aa', fontSize: 12 },

  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  backText: { color: '#a855f7', fontSize: 14, fontWeight: '600' },
  headerCarrera: { marginBottom: 10 },
  headerCarreraTitle: { color: '#a1a1aa', fontSize: 14 },
  headerCarreraName: { color: '#e4e4e7', fontSize: 24, fontWeight: 'bold' },
  
  dropZone: { backgroundColor: '#121215', borderWidth: 2, borderColor: '#27272a', borderStyle: 'dashed', borderRadius: 8, padding: 40, alignItems: 'center', justifyContent: 'center' },
  dropZoneLight: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  dropTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  dropSubtitle: { color: '#a1a1aa', fontSize: 14 },
  
  progressCard: { backgroundColor: 'rgba(168, 85, 247, 0.1)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', borderRadius: 8, padding: 16 },
  progressCardLight: { backgroundColor: 'rgba(168, 85, 247, 0.05)', borderColor: 'rgba(168, 85, 247, 0.2)' },
  progressWarning: { color: '#c084fc', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  progressBarBg: { height: 8, backgroundColor: '#27272a', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarBgLight: { backgroundColor: '#e2e8f0' },
  progressBarFill: { height: '100%', backgroundColor: '#a855f7' },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: '#a1a1aa', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  progressPercentage: { color: '#a855f7', fontSize: 12, fontWeight: 'bold' },
  
  tableCard: { backgroundColor: '#121215', borderWidth: 1, borderColor: '#27272a', borderRadius: 8, overflow: 'hidden' },
  tableCardLight: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#27272a', backgroundColor: '#18181b' },
  tableHeaderLight: { borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  tableTitle: { color: '#e4e4e7', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  tableTitleLight: { color: '#475569' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#a855f7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, gap: 8 },
  saveBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  tableScroll: { maxHeight: 560 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  previewRowLight: { borderBottomColor: '#e2e8f0' },
  previewArchivo: { color: '#e4e4e7', fontSize: 13, fontWeight: 'bold' },
  previewDocente: { color: '#a1a1aa', fontSize: 11, marginTop: 3 },
  previewDocenteLight: { color: '#64748b' },
  previewClases: { color: '#c4b5fd', fontSize: 10, fontWeight: 'bold', minWidth: 70, textAlign: 'center' },
  previewClasesLight: { color: '#7e22ce' },
  previewBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  previewBadgeListo: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' },
  previewBadgeObservacion: { backgroundColor: 'rgba(234, 179, 8, 0.12)', borderColor: 'rgba(234, 179, 8, 0.35)' },
  previewBadgeText: { fontSize: 9, fontWeight: 'bold' },
  previewBadgeListoText: { color: '#10b981' },
  previewBadgeObservacionText: { color: '#eab308' },
  previewRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#27272a', borderLeftWidth: 4 },
  rowLight: { borderBottomColor: '#e2e8f0' },
  rowInfo: { flex: 1 },
  docenteText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  archivoText: { color: '#71717a', fontSize: 12 },
  rowStatus: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  horasText: { fontSize: 14, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  rowCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  advertenciaText: { fontSize: 12, marginTop: 4 },
  detalle: { marginTop: 12, gap: 8 },
  detalleFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  etiqueta: { color: '#71717a', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, width: 70, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  claseEncabezado: { flexDirection: 'row', gap: 6, marginTop: 8 },
  claseBloque: { borderLeftWidth: 3, paddingLeft: 6, marginTop: 6 },
  claseFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 4, color: '#e4e4e7', paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  inputLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  agregarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  agregarText: { color: '#a855f7', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  actionTextGreen: { color: '#10b981', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  actionTextRed: { color: '#f43f5e', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  mensajeFinal: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  errorCard: { backgroundColor: 'rgba(244, 63, 94, 0.08)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.35)', borderRadius: 8, padding: 14, gap: 6 },
  errorTitulo: { color: '#f43f5e', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  errorTexto: { color: '#f43f5e', fontSize: 12 },
  avisoCard: { backgroundColor: 'rgba(234, 179, 8, 0.08)', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.35)', borderRadius: 8, padding: 14, gap: 8 },
  avisoCardLight: { backgroundColor: 'rgba(234, 179, 8, 0.06)' },
  avisoTitulo: { color: '#eab308', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  avisoTexto: { color: '#a1a1aa', fontSize: 12 },
  avisoRojo: { color: '#f43f5e', fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
  aulaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  aulaNombre: { color: '#e4e4e7', fontSize: 14, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  aulaVeces: { color: '#71717a', fontSize: 12, fontWeight: 'normal' },
  aulaAcciones: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
});
