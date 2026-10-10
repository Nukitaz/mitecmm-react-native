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
import { useTheme } from "../context/ThemeContext";

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

/** Renderiza el subtítulo destacando los textos urgentes en ROJO */
const renderSubtitulo = (
  texto: string,
  isDarkMode: boolean,
  esUrgente?: boolean
) => {
  const idx = texto.indexOf(":");
  if (idx === -1) {
    return (
      <Text
        style={
          esUrgente
            ? styles.textUrgent
            : isDarkMode
            ? styles.subDark
            : styles.subLight
        }
      >
        {texto}
      </Text>
    );
  }

  const label = texto.slice(0, idx);
  const rest = texto.slice(idx);

  return (
    <Text
      style={
        esUrgente
          ? styles.textUrgent
          : isDarkMode
          ? styles.subDark
          : styles.subLight
      }
    >
      <Text
        style={[
          styles.textBold,
          esUrgente ? styles.textUrgentBold : !isDarkMode && styles.textBoldLight,
        ]}
      >
        {label}
      </Text>
      {rest}
    </Text>
  );
};

export const AvisosBanner = () => {
  const { isDarkMode } = useTheme();
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
        useNativeDriver: Platform.OS !== "web", // 👈 Desactiva en Web y mantiene en iOS/Android
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
      <View
        style={[
          styles.bannerContainer,
          !isDarkMode && styles.bannerContainerLight,
        ]}
      >
        <View
          style={[
            styles.leftControls,
            !isDarkMode && styles.leftControlsLight,
          ]}
        >
          <Text style={styles.badgeText}>AVISOS</Text>
          <View
            style={[
              styles.divider,
              !isDarkMode && styles.dividerLight,
            ]}
          />
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
            <Text
              style={[
                styles.emptyText,
                !isDarkMode && styles.textLightSecondary,
              ]}
            >
              Sin avisos por el momento
            </Text>
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
                  {a.es_urgente && <AlertTriangle size={13} color="#f43f5e" />}
                  <Text
                    style={[
                      styles.tickerText,
                      !isDarkMode && styles.tickerTextLight,
                      a.es_urgente && styles.tickerTextUrgent,
                    ]}
                  >
                    {a.subtitulo
                      ? renderSubtitulo(a.subtitulo, isDarkMode, a.es_urgente)
                      : a.titulo}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </View>
      </View>

      {/* Historial Lateral */}
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
          <View
            style={[
              styles.sheetPanel,
              !isDarkMode && styles.sheetPanelLight,
            ]}
          >
            <View
              style={[
                styles.sheetHeader,
                !isDarkMode && styles.sheetHeaderLight,
              ]}
            >
              <Text
                style={[
                  styles.sheetTitle,
                  !isDarkMode && styles.sheetTitleLight,
                ]}
              >
                HISTORIAL DE AVISOS
              </Text>
              <TouchableOpacity onPress={() => setSheetOpen(false)}>
                <X size={18} color={isDarkMode ? "#a1a1aa" : "#64748b"} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetList}>
              {avisos.length === 0 && (
                <Text
                  style={[
                    styles.emptyText,
                    !isDarkMode && styles.textLightSecondary,
                  ]}
                >
                  No hay avisos disponibles.
                </Text>
              )}
              {avisos.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.sheetCard,
                    !isDarkMode && styles.sheetCardLight,
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
                    <Text
                      style={[
                        styles.sheetDateText,
                        !isDarkMode && styles.textLightSecondary,
                      ]}
                    >
                      {formatFecha(a.fecha_publicacion)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.sheetCardTitle,
                      !isDarkMode && styles.sheetCardTitleLight,
                    ]}
                  >
                    {a.titulo}
                  </Text>

                  {a.subtitulo && (
                    <Text style={styles.sheetCardSub}>
                      {renderSubtitulo(a.subtitulo, isDarkMode, a.es_urgente)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Detalle */}
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
              !isDarkMode && styles.dialogBoxLight,
              selected?.es_urgente
                ? styles.dialogUrgentBorder
                : isDarkMode
                ? styles.dialogNormalBorder
                : styles.dialogNormalBorderLight,
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
                    style={[
                      styles.closeBtn,
                      !isDarkMode && styles.closeBtnLight,
                    ]}
                    onPress={() => setSelected(null)}
                  >
                    <X size={16} color={isDarkMode ? "#a1a1aa" : "#64748b"} />
                  </TouchableOpacity>
                </View>

                <Text
                  style={[
                    styles.dialogTitle,
                    !isDarkMode && styles.dialogTitleLight,
                  ]}
                >
                  {selected.titulo}
                </Text>

                {selected.subtitulo && (
                  <View style={styles.dialogSubContainer}>
                    {renderSubtitulo(
                      selected.subtitulo,
                      isDarkMode,
                      selected.es_urgente
                    )}
                  </View>
                )}

                {selected.contenido && (
                  <ScrollView style={styles.bodyScroll}>
                    <Text
                      style={[
                        styles.dialogBody,
                        !isDarkMode && styles.dialogBodyLight,
                      ]}
                    >
                      {selected.contenido}
                    </Text>
                  </ScrollView>
                )}

                <Text
                  style={[
                    styles.dialogDate,
                    !isDarkMode && styles.textLightSecondary,
                  ]}
                >
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
  bannerContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
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
  leftControlsLight: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
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
  dividerLight: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
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
  tickerTextLight: {
    color: "#0f172a",
  },
  tickerTextUrgent: {
    color: "#f43f5e",
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 12,
    color: "#71717a",
  },

  /* COLORES Y ESTILOS DE TEXTO URGENTE EN ROJO */
  subDark: { color: "#a1a1aa" },
  subLight: { color: "#64748b" },
  textBold: { fontWeight: "bold", color: "#ffffff" },
  textBoldLight: { color: "#0f172a" },
  textUrgent: { color: "#f43f5e" },
  textUrgentBold: { fontWeight: "bold", color: "#f43f5e" },

  sheetOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  sheetBackdrop: { flex: 1 },
  sheetPanel: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0d0d10",
    borderLeftWidth: 1,
    borderLeftColor: "#27272a",
    padding: 20,
  },
  sheetPanelLight: {
    backgroundColor: "#ffffff",
    borderLeftColor: "#e2e8f0",
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
  sheetHeaderLight: { borderBottomColor: "#e2e8f0" },
  sheetTitle: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 15,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 2,
  },
  sheetTitleLight: { color: "#0f172a" },
  sheetList: { gap: 12, paddingBottom: 24 },
  sheetCard: {
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    padding: 16,
  },
  sheetCardLight: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
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
  sheetDateText: { fontSize: 11, color: "#71717a" },
  sheetCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sheetCardTitleLight: { color: "#0f172a" },
  sheetCardSub: { fontSize: 13, marginTop: 4 },

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
  dialogBoxLight: { backgroundColor: "#ffffff" },
  dialogNormalBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#a855f7",
    borderColor: "#27272a",
  },
  dialogNormalBorderLight: {
    borderLeftWidth: 4,
    borderLeftColor: "#a855f7",
    borderColor: "#e2e8f0",
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
  closeBtnLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  dialogTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dialogTitleLight: { color: "#0f172a" },
  dialogSubContainer: { marginTop: 6, marginBottom: 12 },
  bodyScroll: { maxHeight: 180, marginVertical: 10 },
  dialogBody: { fontSize: 14, color: "#a1a1aa", lineHeight: 22 },
  dialogBodyLight: { color: "#475569" },
  dialogDate: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
    marginTop: 14,
    letterSpacing: 1.5,
  },
  textLightSecondary: { color: "#64748b" },
});

export default AvisosBanner;