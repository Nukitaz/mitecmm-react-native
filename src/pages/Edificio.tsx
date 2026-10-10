import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, User, Book, MapPin } from "lucide-react-native";
import { Navbar } from "../components/Navbar";
import { getPlanoEdificioUrl } from "../services/mapasService";
import { obtenerProfesores } from "../services/profesoresService";
import { AULAS_UBICACIONES } from "./Mapa";
import { useTheme } from "../context/ThemeContext";

type Suggestion = {
  id: string;
  type: "aula" | "prof" | "materia";
  label: string;
  detail: string;
  aulaResaltada: string;
};

const Edificio = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();

  const edificioId = route?.params?.id || "p";
  const nombreEdificio = route?.params?.nombre || `Edificio ${edificioId.toUpperCase()}`;
  const plantaInicial = route?.params?.plantaInicial || "baja";

  // Estados del mapa
  const [aulaResaltada, setAulaResaltada] = useState<string | null>(
    route?.params?.aulaResaltada || null
  );
  const [planta, setPlanta] = useState<"baja" | "alta">(plantaInicial);
  const [isMapHovered, setIsMapHovered] = useState(false);

  // XMLs individuales para superposición
  const [svgBaja, setSvgBaja] = useState<string | null>(null);
  const [svgAlta, setSvgAlta] = useState<string | null>(null);

  // Estados del Buscador
  const [busqueda, setBusqueda] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sugerencias, setSugerencias] = useState<Suggestion[]>([]);

  const planoBajaUrl = getPlanoEdificioUrl(edificioId, "baja");
  const planoAltaUrl = getPlanoEdificioUrl(edificioId, "alta");

  const handleQuitarResaltado = () => {
    setAulaResaltada(null);
    // Limpia el parámetro de la URL
    navigation.setParams({
      aulaResaltada: undefined,
    });
  };

  // 1. Escuchar cambios de parámetros
  useEffect(() => {
    if (route?.params?.aulaResaltada !== undefined) {
      setAulaResaltada(route.params.aulaResaltada);
    }
  }, [route?.params?.aulaResaltada]);

  // 2. Cargar ambos SVGs al montar o cambiar de edificio
  useEffect(() => {
    fetch(planoBajaUrl)
      .then((res) => res.text())
      .then((text) => setSvgBaja(text))
      .catch((err) => console.error("Error al cargar Planta Baja:", err));

    fetch(planoAltaUrl)
      .then((res) => res.text())
      .then((text) => setSvgAlta(text))
      .catch((err) => console.error("Error al cargar Planta Alta:", err));
  }, [edificioId]);

  // 3. Autocompletado del buscador
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (busqueda.trim().length < 2) {
        setSugerencias([]);
        return;
      }

      const term = busqueda.toUpperCase();
      let nuevasSugerencias: Suggestion[] = [];

      Object.keys(AULAS_UBICACIONES).forEach((aula) => {
        if (aula.includes(term)) {
          nuevasSugerencias.push({
            id: `aula-${aula}`,
            type: "aula",
            label: `AULA ${aula}`,
            detail: "SALÓN",
            aulaResaltada: aula,
          });
        }
      });

      const resultadosDB = await obtenerProfesores(busqueda);
      const docentesAgregados = new Set();
      const materiasAgregadas = new Set();

      resultadosDB?.forEach((item) => {
        if (item.docente.toUpperCase().includes(term) && !docentesAgregados.has(item.docente)) {
          docentesAgregados.add(item.docente);
          nuevasSugerencias.push({
            id: `prof-${item.id}`,
            type: "prof",
            label: item.docente,
            detail: "PROF",
            aulaResaltada: item.aula,
          });
        }
        if (item.materia.toUpperCase().includes(term) && !materiasAgregadas.has(item.materia)) {
          materiasAgregadas.add(item.materia);
          nuevasSugerencias.push({
            id: `mat-${item.id}`,
            type: "materia",
            label: item.materia,
            detail: "MATERIA",
            aulaResaltada: item.aula,
          });
        }
      });

      setSugerencias(nuevasSugerencias.slice(0, 6));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  const handleSelectSuggestion = (item: Suggestion) => {
    setBusqueda(item.label);
    setIsFocused(false);

    let ubicacion = AULAS_UBICACIONES[item.aulaResaltada.toUpperCase()];

    if (!ubicacion) {
      const letraEdificio = item.aulaResaltada.charAt(0).toLowerCase();
      const edificiosValidos = ["a", "b", "c", "f", "g", "i", "l", "o", "p", "e"];

      if (edificiosValidos.includes(letraEdificio)) {
        ubicacion = {
          edificioId: letraEdificio === "e" ? "em" : letraEdificio,
          nombreEdificio: `Edificio ${letraEdificio.toUpperCase()}`,
          planta: "alta",
          svgId: "",
        };
      }
    }

    if (ubicacion) {
      if (ubicacion.edificioId === edificioId) {
        setPlanta(ubicacion.planta);
        setAulaResaltada(item.aulaResaltada);
        // Sincroniza la URL con el nuevo salón resaltado
        navigation.setParams({
          aulaResaltada: item.aulaResaltada,
          plantaInicial: ubicacion.planta,
        });
      } else {
        navigation.navigate("Edificio", {
          id: ubicacion.edificioId,
          nombre: ubicacion.nombreEdificio,
          plantaInicial: ubicacion.planta,
          aulaResaltada: item.aulaResaltada,
        });
      }
    }
  };

  // Inyección de CSS y animación para el resaltado del salón seleccionado
  const processSvgContent = (rawSvg: string | null, isAltaLayer: boolean) => {
    if (!rawSvg) return null;

    let modifiedXml = rawSvg.replace(/<svg/, '<svg width="100%" height="100%"');

    if (aulaResaltada) {
      const ubicacion = AULAS_UBICACIONES[aulaResaltada.toUpperCase()];
      const esEnEstaPlanta =
        ubicacion &&
        ubicacion.edificioId === edificioId &&
        ubicacion.planta === (isAltaLayer ? "alta" : "baja");

      if (esEnEstaPlanta && ubicacion.svgId) {
        const cssStyle = `
          <style>
            #${ubicacion.svgId} {
              display: inline !important;
              fill: #a855f7 !important;
              fill-opacity: 0.75 !important;
              stroke: #e9d5ff !important;
              stroke-width: 4px !important;
              filter: drop-shadow(0px 0px 18px #a855f7);
              animation: parpadeoSalon 1s infinite alternate;
            }
            @keyframes parpadeoSalon {
              0% { fill-opacity: 0.3; stroke-opacity: 0.4; }
              100% { fill-opacity: 0.95; stroke-opacity: 1; }
            }
          </style>
        `;
        modifiedXml = modifiedXml.replace(/<svg[^>]*>/, (match) => `${match}${cssStyle}`);
      }
    }

    return modifiedXml;
  };

  const processedBaja = useMemo(() => processSvgContent(svgBaja, false), [svgBaja, aulaResaltada, edificioId]);
  const processedAlta = useMemo(() => processSvgContent(svgAlta, true), [svgAlta, aulaResaltada, edificioId]);

  const IconoTipo = ({ type }: { type: string }) => {
    switch (type) {
      case "prof":
        return <User size={16} color="#a855f7" />;
      case "materia":
        return <Book size={16} color="#a855f7" />;
      default:
        return <MapPin size={16} color="#a855f7" />;
    }
  };

  return (
    <View style={[styles.screen, !isDarkMode && styles.screenLight]}>
      <Navbar />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.main}>
          <View style={styles.headerSection}>
            <Text style={[styles.modCode, !isDarkMode && styles.textLightSecondary]}>
              [ MOD_03 · BUILDING_{edificioId.toUpperCase()} ]
            </Text>
            <Text style={[styles.title, !isDarkMode && styles.titleLight]}>
              {nombreEdificio}
            </Text>

            {/* BUSCADOR */}
            <View style={styles.searchWrapper}>
              <View
                style={[
                  styles.searchContainer,
                  !isDarkMode && styles.searchContainerLight,
                  isFocused && (isDarkMode ? styles.searchContainerActive : styles.searchContainerActiveLight),
                ]}
              >
                <Search
                  size={18}
                  color={isFocused ? "#a855f7" : isDarkMode ? "#a1a1aa" : "#64748b"}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, !isDarkMode && styles.searchInputLight]}
                  placeholder="Busca un salón, profesor o materia..."
                  placeholderTextColor={isDarkMode ? "#71717a" : "#94a3b8"}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                  returnKeyType="search"
                />
              </View>

              {isFocused && sugerencias.length > 0 && (
                <View
                  style={[
                    styles.dropdownContainer,
                    !isDarkMode && styles.dropdownContainerLight,
                  ]}
                >
                  {sugerencias.map((sug, index) => (
                    <TouchableOpacity
                      key={sug.id}
                      style={[
                        styles.dropdownItem,
                        index !== sugerencias.length - 1 &&
                          (isDarkMode ? styles.dropdownItemBorder : styles.dropdownItemBorderLight),
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSuggestion(sug)}
                    >
                      <View style={styles.dropdownLeft}>
                        <IconoTipo type={sug.type} />
                        <Text
                          style={[styles.dropdownLabel, !isDarkMode && styles.dropdownLabelLight]}
                          numberOfLines={1}
                        >
                          {sug.label}
                        </Text>
                      </View>
                      <Text style={styles.dropdownDetail}>{sug.detail}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          

          {/* BANNER DE RESALTADO */}
          {aulaResaltada && (
            <View
              style={[
                styles.resaltadoBanner,
                !isDarkMode && styles.resaltadoBannerLight,
              ]}
            >
              <View style={styles.resaltadoLeft}>
                <View style={styles.resaltadoDot} />
                <Text style={styles.resaltadoText}>
                  RESALTADO: {aulaResaltada.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={handleQuitarResaltado} activeOpacity={0.7}>
                <Text style={[styles.quitarText, !isDarkMode && styles.quitarTextLight]}>
                  quitar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TARJETA DEL PLANO */}
          <View
            style={[
              styles.mapCard,
              !isDarkMode && styles.mapCardLight,
              isMapHovered && (isDarkMode ? styles.mapCardHovered : styles.mapCardHoveredLight),
            ]}
            {...({
              onPointerEnter: () => setIsMapHovered(true),
              onPointerLeave: () => setIsMapHovered(false),
            } as any)}
          >
            <View style={[styles.mapHeader, !isDarkMode && styles.mapHeaderLight]}>
              <Text style={[styles.mapTag, !isDarkMode && styles.textLightSecondary]}>
                // PLANTA_{planta.toUpperCase()}_EDIFICIO_{edificioId.toUpperCase()}.SVG
              </Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {planta === "alta" ? "STACK 3D ACTIVE" : "LIVE"}
                </Text>
              </View>
            </View>

            <View style={styles.mapContent}>
              {/* SELECTOR DE PISO (PA / PB) */}
              <View style={[styles.sidebar, !isDarkMode && styles.sidebarLight]}>
                <Text style={[styles.sidebarTitle, !isDarkMode && styles.textLightSecondary]}>
                  PISO
                </Text>
                <View
                  style={[
                    styles.floorToggleGroup,
                    !isDarkMode && styles.floorToggleGroupLight,
                  ]}
                >
                  <TouchableOpacity
                    style={[styles.floorBtn, planta === "alta" && styles.floorBtnActive]}
                    onPress={() => setPlanta("alta")}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.floorBtnText,
                        !isDarkMode && styles.floorBtnTextLight,
                        planta === "alta" && styles.floorBtnTextActive,
                      ]}
                    >
                      PA
                    </Text>
                  </TouchableOpacity>
                  <View style={[styles.divider, !isDarkMode && styles.dividerLight]} />
                  <TouchableOpacity
                    style={[styles.floorBtn, planta === "baja" && styles.floorBtnActive]}
                    onPress={() => setPlanta("baja")}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.floorBtnText,
                        !isDarkMode && styles.floorBtnTextLight,
                        planta === "baja" && styles.floorBtnTextActive,
                      ]}
                    >
                      PB
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.floorLabel, !isDarkMode && styles.textLightSecondary]}>
                  {planta === "alta" ? "↑ ALTA" : "↓ BAJA"}
                </Text>
              </View>

              {/* CONTENEDOR MULTICAPA PARA EL MAPA SVG (3D OVERLAY) */}
              <View style={styles.imageContainer}>
                <View style={styles.mapWrapper}>
                  {/* CAPA 1: PLANTA BAJA */}
                  {processedBaja ? (
                    <View
                      style={[
                        styles.svgLayer,
                        planta === "alta" && styles.svgBajaUnderlay,
                      ]}
                    >
                      {Platform.OS === "web" ? (
                        <div
                          style={{ width: "100%", height: "100%" }}
                          dangerouslySetInnerHTML={{ __html: processedBaja }}
                        />
                      ) : (
                        <Text style={{ color: "#71717a" }}>
                          Planta Baja Nativa
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={{ color: "#71717a" }}>
                      Cargando Planta Baja...
                    </Text>
                  )}

                  {/* CAPA 2: PLANTA ALTA SUPERPUESTA CON ANIMACIÓN ELEGANTE */}
                  {processedAlta && (
                    <View
                      style={[
                        styles.svgLayer,
                        styles.svgAltaOverlay,
                        planta === "alta" ? styles.svgAltaVisible : styles.svgAltaHidden,
                      ]}
                    >
                      {Platform.OS === "web" ? (
                        <div
                          style={{ width: "100%", height: "100%" }}
                          dangerouslySetInnerHTML={{ __html: processedAlta }}
                        />
                      ) : (
                        <Text style={{ color: "#71717a" }}>
                          Planta Alta Nativa
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  /* PANTALLA Y ESTRUCTURA GENERAL */
  screen: {
    flex: 1,
    backgroundColor: "#08080a",
  },
  screenLight: {
    backgroundColor: "#f8fafc",
  },
  container: {
    flexGrow: 1,
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
    zIndex: 1,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 24,
    zIndex: 50,
  },
  modCode: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
    letterSpacing: 2,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 8,
  },
  titleLight: {
    color: "#0f172a",
  },

  /* BUSCADOR Y DROPDOWN */
  searchWrapper: {
    width: "100%",
    maxWidth: 600,
    marginTop: 16,
    position: "relative",
    zIndex: 100,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    paddingHorizontal: 14,
  },
  searchContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  searchContainerActive: {
    borderColor: "#a855f7",
    backgroundColor: "#18181b",
  },
  searchContainerActiveLight: {
    borderColor: "#a855f7",
    backgroundColor: "#ffffff",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 15,
    outlineStyle: "none" as any,
  },
  searchInputLight: {
    color: "#0f172a",
  },
  dropdownContainer: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: "#18181c",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 999,
  },
  dropdownContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowOpacity: 0.1,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  dropdownItemBorderLight: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  dropdownLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  dropdownLabelLight: {
    color: "#0f172a",
  },
  dropdownDetail: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#a855f7",
    letterSpacing: 2,
  },

  /* BANNER RESALTADO */
  resaltadoBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(30, 20, 50, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },
  resaltadoBannerLight: {
    backgroundColor: "#f3e8ff",
    borderColor: "#d8b4fe",
  },
  resaltadoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resaltadoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a855f7",
  },
  resaltadoText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#c084fc",
    fontWeight: "bold",
    letterSpacing: 2,
  },
  quitarText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
    letterSpacing: 1.5,
    textDecorationLine: "underline",
  },
  quitarTextLight: {
    color: "#6b21a8",
  },

  /* PLANO Y TARJETA */
  mapCard: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
    width: "100%",
    ...(Platform.OS === "web"
      ? ({
          transitionDuration: "0.3s",
          transitionProperty: "border-color, box-shadow, background-color",
        } as any)
      : {}),
  },
  mapCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  mapCardHovered: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  mapCardHoveredLight: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e24",
  },
  mapHeaderLight: {
    borderBottomColor: "#e2e8f0",
  },
  mapTag: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
    letterSpacing: 1.5,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a855f7",
  },
  liveText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#a855f7",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  mapContent: {
    flexDirection: "row",
    minHeight: 500,
  },
  sidebar: {
    width: 80,
    borderRightWidth: 1,
    borderRightColor: "#1e1e24",
    alignItems: "center",
    paddingVertical: 24,
  },
  sidebarLight: {
    borderRightColor: "#e2e8f0",
  },
  sidebarTitle: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#71717a",
    marginBottom: 16,
    letterSpacing: 1.5,
  },
  floorToggleGroup: {
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    width: 50,
    backgroundColor: "#121215",
    overflow: "hidden",
  },
  floorToggleGroupLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  floorBtn: {
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  floorBtnActive: {
    backgroundColor: "#a855f7",
  },
  divider: {
    height: 1,
    backgroundColor: "#27272a",
  },
  dividerLight: {
    backgroundColor: "#e2e8f0",
  },
  floorBtnText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
    fontWeight: "bold",
    color: "#71717a",
  },
  floorBtnTextLight: {
    color: "#64748b",
  },
  floorBtnTextActive: {
    color: "#ffffff",
  },
  floorLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#71717a",
    marginTop: 16,
    letterSpacing: 1,
  },

  /* CONTENEDOR MULTICAPA SVG (FONDO OSCURO PERMANENTE) */
  imageContainer: {
    flex: 1,
    backgroundColor: "#08080a",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  mapWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.5,
  },
  svgLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    ...(Platform.OS === "web"
      ? ({
          transitionDuration: "0.45s",
          transitionProperty: "opacity, transform, filter",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        } as any)
      : {}),
  },

  /* ESTILOS DE TRANSICIÓN PARA PLANTA BAJA (UNDERLAY MÁS OSCURO Y TENUE) */
  svgBajaUnderlay: {
    opacity: 0.12,
    filter: "contrast(0.6) brightness(0.4) blur(1.5px)",
  },

  /* ESTILOS DE TRANSICIÓN PARA PLANTA ALTA (OVERLAY FLOATING) */
  svgAltaOverlay: {
    zIndex: 10,
  },
  svgAltaVisible: {
    opacity: 1,
    transform: [{ translateY: 0 }, { scale: 1 }],
    filter: "drop-shadow(0px 12px 20px rgba(168, 85, 247, 0.3))",
  },
  svgAltaHidden: {
    opacity: 0,
    transform: [{ translateY: 24 }, { scale: 0.98 }],
    pointerEvents: "none",
  },

  /* TEXTO SECUNDARIO CLARO */
  textLightSecondary: {
    color: "#64748b",
  },
});

export default Edificio;