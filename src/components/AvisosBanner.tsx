import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ChevronRight, X } from "lucide-react-native";
import { fetchAvisos, type Aviso } from "../services/avisosService";
import { useTheme } from "../context/ThemeContext";

export const AvisosBanner = () => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [selected, setSelected] = useState<Aviso | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Ancho medido de un bloque para animación continua en Android
  const [singleWidth, setSingleWidth] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Cargar datos reales de Supabase
  useEffect(() => {
    const loadAvisos = async () => {
      const data = await fetchAvisos();
      setAvisos(data);
    };
    loadAvisos();
  }, []);

  // Controlamos la animación según la cantidad de avisos
  const isAnimated = avisos.length >= 3;
  const baseList = useMemo(() => {
    if (avisos.length === 0) return [];
    if (!isAnimated) return avisos; // Si son pocos, mostramos la lista normal
    return [...avisos, ...avisos, ...avisos, ...avisos];
  }, [avisos, isAnimated]);

  // Animación continua y fluida para Android / iOS (solo si hay más de 2 avisos)
  useEffect(() => {
    if (Platform.OS === "web" || singleWidth === 0 || baseList.length === 0 || !isAnimated) return;

    animatedValue.setValue(0);
    const duration = Math.max(12000, (singleWidth / 42) * 1000);

    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: -singleWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [singleWidth, baseList, isAnimated]);

  const esUrgente = (categoria: string) => categoria.toLowerCase() === "urgente";

  const renderTickerItem = (a: Aviso, key: string) => (
    <TouchableOpacity
      key={key}
      style={styles.tickerItem}
      onPress={() => setSelected(a)}
      activeOpacity={0.7}
    >
      {esUrgente(a.categoria) && (
        <AlertTriangle
          size={13}
          color="#f43f5e"
          style={styles.urgentIcon}
        />
      )}
      <Text
        numberOfLines={1}
        style={[
          styles.tickerText,
          !isDarkMode && styles.tickerTextLight,
          esUrgente(a.categoria) && styles.tickerTextUrgent,
          Platform.OS === "web" && ({ whiteSpace: "nowrap" } as any),
        ]}
      >
        {a.titulo}
      </Text>
    </TouchableOpacity>
  );

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

        {/* Contenedor del texto de los avisos */}
        <View style={styles.marqueeContainer}>
          {baseList.length === 0 ? (
            <Text
              style={[
                styles.emptyText,
                !isDarkMode && styles.textLightSecondary,
              ]}
            >
              Sin avisos por el momento
            </Text>
          ) : !isAnimated ? (
             /* Mostrar avisos estáticos si son muy pocos (sin animación y sin repetición) */
             <View style={styles.trackGroup}>
                {avisos.map((a, i) => renderTickerItem(a, `static-${a.id}-${i}`))}
             </View>
          ) : Platform.OS === "web" ? (
            /* Versión Web animada */
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                width: "100%",
                position: "relative",
              }}
            >
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes marqueeLoopWeb {
                      0% { transform: translate3d(0, 0, 0); }
                      100% { transform: translate3d(-50%, 0, 0); }
                    }
                    .marquee-track-web {
                      display: flex !important;
                      flex-direction: row !important;
                      align-items: center !important;
                      width: max-content !important;
                      animation: marqueeLoopWeb 32s linear infinite;
                      will-change: transform;
                    }
                    .marquee-track-web:hover {
                      animation-play-state: paused;
                    }
                    .marquee-group-web {
                      display: flex !important;
                      flex-direction: row !important;
                      align-items: center !important;
                      flex-shrink: 0 !important;
                    }
                  `,
                }}
              />
              <div className="marquee-track-web">
                <div className="marquee-group-web">
                  {baseList.map((a, i) => renderTickerItem(a, `w1-${a.id}-${i}`))}
                </div>
                <div className="marquee-group-web">
                  {baseList.map((a, i) => renderTickerItem(a, `w2-${a.id}-${i}`))}
                </div>
              </div>
            </div>
          ) : (
            /* Versión Móvil Animada */
            <Animated.View
              style={[
                styles.marqueeTrack,
                {
                  width: singleWidth > 0 ? singleWidth * 2 : 10000,
                  transform: [{ translateX: animatedValue }],
                },
              ]}
            >
              <View
                style={styles.trackGroup}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && Math.abs(w - singleWidth) > 1) {
                    setSingleWidth(w);
                  }
                }}
              >
                {baseList.map((a, i) => renderTickerItem(a, `m1-${a.id}-${i}`))}
              </View>
              <View style={styles.trackGroup}>
                {baseList.map((a, i) => renderTickerItem(a, `m2-${a.id}-${i}`))}
              </View>
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
              { paddingTop: Math.max(insets.top + 12, 20) },
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
                    esUrgente(a.categoria) && styles.sheetCardUrgent,
                  ]}
                  onPress={() => {
                    setSheetOpen(false);
                    setSelected(a);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.sheetCardTop}>
                    <View style={styles.sheetTagRow}>
                      {esUrgente(a.categoria) && (
                        <AlertTriangle size={13} color="#f43f5e" />
                      )}
                      <Text
                        style={[
                          styles.sheetTagText,
                          esUrgente(a.categoria) ? styles.tagUrgent : styles.tagNormal,
                        ]}
                      >
                        {a.categoria.toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.sheetDateText,
                        !isDarkMode && styles.textLightSecondary,
                      ]}
                    >
                      {a.fecha}
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
              selected && esUrgente(selected.categoria)
                ? styles.dialogUrgentBorder
                : isDarkMode
                ? styles.dialogNormalBorder
                : styles.dialogNormalBorderLight,
            ]}
          >
            {selected && (
              <>
                <View style={styles.dialogHeader}>
                  <View style={styles.urgentBadge}>
                    {esUrgente(selected.categoria) && (
                        <AlertTriangle size={14} color="#f43f5e" />
                    )}
                    <Text style={[styles.urgentBadgeText, esUrgente(selected.categoria) ? {color: '#f43f5e'} : {color: '#a855f7'}]}>
                      {selected.categoria.toUpperCase()}
                    </Text>
                  </View>
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

                <ScrollView style={styles.bodyScroll}>
                  <Text
                    style={[
                      styles.dialogBody,
                      !isDarkMode && styles.dialogBodyLight,
                    ]}
                  >
                    {selected.descripcion}
                  </Text>
                </ScrollView>

                <Text
                  style={[
                    styles.dialogDate,
                    !isDarkMode && styles.textLightSecondary,
                  ]}
                >
                  {selected.fecha}
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
    zIndex: 2,
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
    flexWrap: "nowrap",
  },
  trackGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  tickerItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 32,
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({
          whiteSpace: "nowrap",
          display: "inline-flex",
        } as any)
      : {}),
  },
  urgentIcon: {
    marginRight: 6,
  },
  tickerText: {
    fontSize: 13,
    color: "#e4e4e7",
    flexShrink: 0,
    ...(Platform.OS === "web" ? ({ whiteSpace: "nowrap" } as any) : {}),
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
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    borderLeftColor: "#ff0000",
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
  tagUrgent: { color: "#ff0000" },
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
    borderLeftColor: "#ff0000",
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