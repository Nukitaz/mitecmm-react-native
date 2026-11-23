import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface SelectorFechaRangoProps {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const MESES_COMPLETOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function diaClave(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

function crearClave(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatearRangoFecha(inicio: Date | string, fin?: Date | string | null): string {
  const parse = (valor: Date | string) => valor instanceof Date
    ? new Date(valor.getFullYear(), valor.getMonth(), valor.getDate())
    : new Date(`${String(valor).trim()}T00:00:00`);

  const a = parse(inicio);
  if (Number.isNaN(a.getTime())) return '';
  if (!fin) return `${a.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;

  const b = parse(fin);
  if (Number.isNaN(b.getTime())) return `${a.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;

  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()} - ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${MESES[a.getMonth()]} - ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  }
  if (a.getDate() === b.getDate()) {
    return `${a.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;
  }
  return `${a.getDate()} - ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
}

export function SelectorFechaRango({
  value,
  onChange,
  placeholder = 'Seleccionar fecha...',
}: SelectorFechaRangoProps) {
  const { isDarkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const hoy = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);

  useEffect(() => {
    if (visible) {
      setFechaInicio(null);
      setFechaFin(null);
    }
  }, [visible]);

  const dias = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    const inicioSemana = primero.getDay();
    const total = inicioSemana + ultimo.getDate();
    const filas = Math.ceil(total / 7) * 7;
    return Array.from({ length: filas }, (_, indice) => {
      const dia = indice - inicioSemana + 1;
      return dia >= 1 && dia <= ultimo.getDate()
        ? new Date(mes.getFullYear(), mes.getMonth(), dia)
        : null;
    });
  }, [mes]);

  const seleccionarDia = (dia: Date) => {
    if (!fechaInicio || fechaFin) {
      setFechaInicio(dia);
      setFechaFin(null);
      return;
    }
    if (diaClave(dia) <= diaClave(fechaInicio)) {
      setFechaInicio(dia);
      setFechaFin(null);
      return;
    }
    setFechaFin(dia);
  };

  const aplicar = () => {
    if (!fechaInicio) {
      setVisible(false);
      return;
    }
    onChange(formatearRangoFecha(fechaInicio, fechaFin));
    setVisible(false);
  };

  const limpiar = () => {
    setFechaInicio(null);
    setFechaFin(null);
    onChange('');
  };

  const cambiarMes = (cantidad: number) => {
    setMes((actual) => new Date(actual.getFullYear(), actual.getMonth() + cantidad, 1));
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.field, isDarkMode ? styles.fieldDark : styles.fieldLight]}
        activeOpacity={0.7}
      >
        <Calendar size={17} color={isDarkMode ? '#c4b5fd' : '#7c3aed'} />
        <Text style={[styles.fieldText, isDarkMode ? styles.fieldTextDark : styles.fieldTextLight, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.calendar, isDarkMode ? styles.calendarDark : styles.calendarLight]}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.monthArrow} onPress={() => cambiarMes(-1)}>
                <ChevronLeft size={20} color={isDarkMode ? '#e4e4e7' : '#475569'} />
              </TouchableOpacity>
              <Text style={[styles.monthTitle, isDarkMode ? styles.fieldTextDark : styles.fieldTextLight]}>
                {`${MESES_COMPLETOS[mes.getMonth()]} ${mes.getFullYear()}`}
              </Text>
              <TouchableOpacity style={styles.monthArrow} onPress={() => cambiarMes(1)}>
                <ChevronRight size={20} color={isDarkMode ? '#e4e4e7' : '#475569'} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((dia) => (
                <Text
                  key={dia}
                  style={[styles.weekDay, isDarkMode ? styles.weekDayDark : styles.weekDayLight]}
                >
                  {dia}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {dias.map((dia, indice) => {
                if (!dia) return <View key={`vacio-${indice}`} style={styles.dayCell} />;
                const clave = diaClave(dia);
                const inicio = fechaInicio ? diaClave(fechaInicio) : null;
                const fin = fechaFin ? diaClave(fechaFin) : null;
                const esInicio = inicio === clave;
                const esFin = fin === clave;
                const esIntermedio = inicio !== null && fin !== null && clave > inicio && clave < fin;

                return (
                  <TouchableOpacity
                    key={crearClave(dia)}
                    onPress={() => seleccionarDia(dia)}
                    style={[
                      styles.dayCell,
                      esIntermedio && (isDarkMode ? styles.dayIntermediateDark : styles.dayIntermediateLight),
                      (esInicio || esFin) && styles.dayEndpoint,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isDarkMode ? styles.dayTextDark : styles.dayTextLight,
                        esIntermedio && styles.dayIntermediateText,
                        (esInicio || esFin) && styles.dayEndpointText,
                      ]}
                    >
                      {dia.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.calendarFooter, isDarkMode ? styles.calendarFooterDark : styles.calendarFooterLight]}>
              <TouchableOpacity onPress={limpiar} style={styles.footerButton}>
                <Text style={[styles.clearText, isDarkMode ? styles.dayTextDark : styles.dayTextLight]}>
                  Limpiar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={aplicar} style={styles.applyButton}>
                <Text style={styles.applyText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  fieldDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  fieldLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
  },
  fieldTextDark: {
    color: '#f8fafc',
  },
  fieldTextLight: {
    color: '#0f172a',
  },
  placeholder: {
    color: '#94a3b8',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  calendar: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 420 : 360,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  calendarDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  calendarLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  calendarHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  monthArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  weekDayDark: {
    color: '#71717a',
  },
  weekDayLight: {
    color: '#64748b',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayText: {
    fontSize: 13,
  },
  dayTextDark: {
    color: '#e4e4e7',
  },
  dayTextLight: {
    color: '#334155',
  },
  dayIntermediateDark: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
  },
  dayIntermediateLight: {
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
  },
  dayIntermediateText: {
    color: '#a855f7',
  },
  dayEndpoint: {
    backgroundColor: '#a855f7',
  },
  dayEndpointText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  calendarFooter: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 12,
  },
  calendarFooterDark: {
    borderTopColor: '#27272a',
  },
  calendarFooterLight: {
    borderTopColor: '#e2e8f0',
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
  },
  applyButton: {
    borderRadius: 6,
    backgroundColor: '#7c3aed',
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  applyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
