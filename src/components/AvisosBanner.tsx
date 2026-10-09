import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from "react-native";
import { AlertTriangle, ChevronRight, X } from "lucide-react-native";
import { fetchAvisos, type Aviso } from "../services/avisosService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const formatFecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

/** Renderiza en negrita el texto antes de los dos puntos (ej: "URGENTE: Protocolo de salud") */
const renderSubtitulo = (texto: string, isLight: boolean = false) => {
  const idx = texto.indexOf(":");
  if (idx === -1)
    return (
      <Text style={isLight ? styles.subLight : styles.subDark}>{texto}</Text>
    );

  const label = texto.slice(0, idx);
  const rest = texto.slice(idx);

  return (
    <Text style={isLight ? styles.subLight : styles.subDark}>
      <Text style={styles.textBold}>{label}</Text>
      {rest}
    </Text>
  );
};

export const AvisosBanner = () => {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [selected, setSelected] = useState<Aviso | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cargar datos reales de Supabase
  useEffect(() => {
    const loadAvisos = async () => {
      const data = await fetchAvisos();
      setAvisos(data);
    };
    loadAvisos();
  }, []);

  // Animación del Marquee
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (avisos.length === 0) return;

    animatedValue.setValue(0);
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 28000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [avisos]);

  const tickerItems = avisos.length > 0 ? [...avisos, ...avisos, ...avisos] : [];

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH * 2],
  });

  return (
    <>
      {/* Banner Principal */}
      <View style={styles.bannerContainer}>
        <View style={styles.leftControls}>
          <Text style={styles.badgeText}>AVISOS</Text>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.verTodosBtn}
            onPress={() => setSheetOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.verTodosText}>VER TODOS</Text>
            <ChevronRight size={13} color="#a855f7" />
          </TouchableOpacity>
        </View>

        {/* Marquee en movimiento */}
        <View style={styles.marqueeContainer}>
          {tickerItems.length === 0 ? (
            <Text style={styles.emptyText}>Sin avisos por el momento</Text>
          ) : (
            <Animated.View
              style={[styles.marqueeTrack, { transform: [{ translateX }] }]}
            >
              {tickerItems.map((a, i) => (
                <TouchableOpacity
                  key={`${a.id}-${i}`}
                  style={styles.tickerItem}
                  onPress={() => setSelected(a)}
                  activeOpacity={0.7}
                >
                  {a.es_urgente && (
                    <AlertTriangle size={13} color="#f43f5e" />
                  )}
                  <Text style={styles.tickerText}>
                    {a.subtitulo ? renderSubtitulo(a.subtitulo) : a.titulo}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </View>
      </View>

      {/* Sheet / Historial Lateral Derecho */}
      <Modal
        visible={sheetOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setSheetOpen(false)}
          />
          <View style={styles.sheetPanel}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>HISTORIAL DE AVISOS</Text>
              <TouchableOpacity onPress={() => setSheetOpen(false)}>
                <X size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetList}>
              {avisos.length === 0 && (
                <Text style={styles.emptyText}>No hay avisos disponibles.</Text>
              )}
              {avisos.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.sheetCard,
                    a.es_urgente && styles.sheetCardUrgent,
                  ]}
                  onPress={() => {
                    setSheetOpen(false);
                    setSelected(a);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.sheetCardTop}>
                    <View style={styles.sheetTagRow}>
                      {a.es_urgente && (
                        <AlertTriangle size={13} color="#f43f5e" />
                      )}
                      <Text
                        style={[
                          styles.sheetTagText,
                          a.es_urgente ? styles.tagUrgent : styles.tagNormal,
                        ]}
                      >
                        {a.es_urgente ? "URGENTE" : "AVISO"}
                      </Text>
                    </View>
                    <Text style={styles.sheetDateText}>
                      {formatFecha(a.fecha_publicacion)}
                    </Text>
                  </View>

                  <Text style={styles.sheetCardTitle}>{a.titulo}</Text>

                  {a.subtitulo && (
                    <Text style={styles.sheetCardSub}>
                      {renderSubtitulo(a.subtitulo, true)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Centrado Detalle del Aviso */}
      <Modal
        visible={selected !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity
          style={styles.dialogOverlay}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.dialogBox,
              selected?.es_urgente
                ? styles.dialogUrgentBorder
                : styles.dialogNormalBorder,
            ]}
          >
            {selected && (
              <>
                <View style={styles.dialogHeader}>
                  {selected.es_urgente && (
                    <View style={styles.urgentBadge}>
                      <AlertTriangle size={14} color="#f43f5e" />
                      <Text style={styles.urgentBadgeText}>
                        AVISO URGENTE
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelected(null)}
                  >
                    <X size={16} color="#a1a1aa" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.dialogTitle}>{selected.titulo}</Text>

                {selected.subtitulo && (
                  <View style={styles.dialogSubContainer}>
                    {renderSubtitulo(selected.subtitulo, true)}
                  </View>
                )}

                {selected.contenido && (
                  <ScrollView style={styles.bodyScroll}>
                    <Text style={styles.dialogBody}>{selected.contenido}</Text>
                  </ScrollView>
                )}

                <Text style={styles.dialogDate}>
                  {formatFecha(selected.fecha_publicacion).toUpperCase()}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    overflow: "hidden",
  },
  leftControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 12,
  },
  badgeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    fontWeight: "bold",
    color: "#c084fc",
    letterSpacing: 2,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(168, 85, 247, 0.3)",
    marginHorizontal: 8,
  },
  verTodosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  verTodosText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    fontWeight: "bold",
    color: "#a855f7",
    letterSpacing: 1.5,
  },
  marqueeContainer: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  marqueeTrack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
  },
  tickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tickerText: {
    fontSize: 13,
    color: "#e4e4e7",
  },
  emptyText: {
    fontSize: 12,
    color: "#71717a",
  },
  subDark: { color: "#a1a1aa" },
  subLight: { color: "#d4d4d8" },
  textBold: { fontWeight: "bold", color: "#ffffff" },

  // Sheet Lateral Derecho
  sheetOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetPanel: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0d0d10",
    borderLeftWidth: 1,
    borderLeftColor: "#27272a",
    padding: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e24",
    paddingBottom: 12,
  },
  sheetTitle: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 15,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 2,
  },
  sheetList: {
    gap: 12,
    paddingBottom: 24,
  },
  sheetCard: {
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    padding: 16,
  },
  sheetCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: "#f43f5e",
  },
  sheetCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sheetTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetTagText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  tagUrgent: { color: "#f43f5e" },
  tagNormal: { color: "#a855f7" },
  sheetDateText: {
    fontSize: 11,
    color: "#71717a",
  },
  sheetCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sheetCardSub: {
    fontSize: 13,
    marginTop: 4,
  },

  // Modal Detalle Centrado Exacto
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  dialogBox: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#121215",
    borderRadius: 4,
    borderWidth: 1,
    padding: 24,
    maxHeight: "80%",
  },
  dialogNormalBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#a855f7",
    borderColor: "#27272a",
  },
  dialogUrgentBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#f43f5e",
    borderColor: "#27272a",
  },
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  urgentBadgeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#f43f5e",
    fontWeight: "bold",
    letterSpacing: 2,
  },
  closeBtn: {
    backgroundColor: "#18181c",
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#27272a",
    marginLeft: "auto",
  },
  dialogTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dialogSubContainer: {
    marginTop: 6,
    marginBottom: 12,
  },
  bodyScroll: {
    maxHeight: 180,
    marginVertical: 10,
  },
  dialogBody: {
    fontSize: 14,
    color: "#a1a1aa",
    lineHeight: 22,
  },
  dialogDate: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
    marginTop: 14,
    letterSpacing: 1.5,
  },
});

export default AvisosBanner;
