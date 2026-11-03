import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Navbar } from "../components/Navbar";
import { EdificioHeader } from "../components/edificio/EdificioHeader";
import { FloorSelector } from "../components/edificio/FloorSelector";
import { MapaWebView } from "../components/edificio/MapaWebView";
import { Mapa3DView } from "../components/mapa3d/Mapa3DView";
import { getPlanoEdificioUrl } from "../services/mapasService";
import { AULAS_UBICACIONES } from "./Mapa";
import { useTheme } from "../context/ThemeContext";
import { esIdSvgValido, normalizarAulaParam } from "../utils/sanitize";
import { sanitizarSvg } from "../utils/svgSanitizer";
import { Box, Layers } from "lucide-react-native";

const formatearNombreEdificio = (id: string, nombreOriginal?: string) => {
  if (
    nombreOriginal &&
    !nombreOriginal.toLowerCase().includes("edificio edificio") &&
    !nombreOriginal.toLowerCase().startsWith("edificio _")
  ) {
    return nombreOriginal;
  }
  if (!id) return "Edificio";

  let limpio = id
    .toLowerCase()
    .replace(/^edificio_?/, "")
    .replace(/_copy$/, "")
    .replace(/^_+/, "")
    .trim();

  const lugaresEspeciales: Record<string, string> = {
    estacionamiento: "Estacionamiento",
    cafeteria: "Cafetería",
    canchas: "Canchas Deportivas",
    domo: "Domo Cultural",
    "1_2": "Edificio 1 y 2",
    em: "Edificio EM",
    e: "Edificio EM",
  };

  return lugaresEspeciales[limpio] || `Edificio ${limpio.toUpperCase()}`;
};

const Edificio = ({ route }: any) => {
  const { isDarkMode } = useTheme();

  const edificioId = route?.params?.id || "p";
  const nombreEdificio = formatearNombreEdificio(
    edificioId,
    route?.params?.nombre
  );
  const plantaInicial = route?.params?.plantaInicial || "baja";

  const webViewRef = useRef<any>(null);

  const [modoVista, setModoVista] = useState<"2d" | "3d">("3d");
  const [aulaResaltada, setAulaResaltada] = useState<string | null>(
    normalizarAulaParam(route?.params?.aulaResaltada)
  );
  const [planta, setPlanta] = useState<"baja" | "alta">(plantaInicial);

  const [svgBaja, setSvgBaja] = useState<string | null>(null);
  const [svgAlta, setSvgAlta] = useState<string | null>(null);

  const planoBajaUrl = getPlanoEdificioUrl(edificioId, "baja");
  const planoAltaUrl = getPlanoEdificioUrl(edificioId, "alta");

  useEffect(() => {
    if (route?.params?.aulaResaltada !== undefined) {
      const nuevaAula = normalizarAulaParam(route.params.aulaResaltada);
      setAulaResaltada(nuevaAula);

      if (nuevaAula) {
        const ubicacion = AULAS_UBICACIONES[nuevaAula.toUpperCase()];
        if (ubicacion?.planta) {
          setPlanta(ubicacion.planta);
        }
      }
    }
  }, [route?.params?.aulaResaltada]);

  useEffect(() => {
    fetch(planoBajaUrl)
      .then((r) => r.text())
      .then((t) => setSvgBaja(sanitizarSvg(t)))
      .catch(console.error);

    fetch(planoAltaUrl)
      .then((r) => r.text())
      .then((t) => setSvgAlta(sanitizarSvg(t)))
      .catch(console.error);
  }, [edificioId]);

  const targetSvgId = useMemo(() => {
    if (!aulaResaltada) return null;
    const claveUpper = aulaResaltada.toUpperCase().trim();
    const ubicacion = AULAS_UBICACIONES[claveUpper];

    if (ubicacion?.svgId) {
      return esIdSvgValido(ubicacion.svgId) ? ubicacion.svgId : null;
    }

    const limpia = aulaResaltada.toLowerCase().trim().replace(/[\s-]+/g, "_");
    let candidato: string;
    if (
      limpia.startsWith("aula_") ||
      limpia.startsWith("edificio_") ||
      limpia.startsWith("laboratorio_") ||
      limpia.startsWith("consultorio_") ||
      limpia.startsWith("sala_") ||
      limpia.startsWith("area_") ||
      limpia.startsWith("almacen_") ||
      limpia.startsWith("jefatura_") ||
      limpia.startsWith("servicio_") ||
      limpia.startsWith("paqueteria_") ||
      limpia.startsWith("centro_")
    ) {
      candidato = limpia;
    } else {
      candidato = `aula_${limpia}`;
    }
    // Lista blanca: cualquier ID que no sea [a-z0-9_] se descarta.
    return esIdSvgValido(candidato) ? candidato : null;
  }, [aulaResaltada]);

  const processedBaja = useMemo(
    () =>
      svgBaja?.replace(
        /<svg/,
        '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
      ),
    [svgBaja]
  );
  const processedAlta = useMemo(
    () =>
      svgAlta?.replace(
        /<svg/,
        '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
      ),
    [svgAlta]
  );

  const currentSvgFor3D = planta === "baja" ? svgBaja : svgAlta;

  return (
    <View style={[styles.screen, !isDarkMode && styles.screenLight]}>
      <Navbar />
      <View style={styles.main}>
        <View style={styles.headerRow}>
          <EdificioHeader
            edificioId={edificioId}
            nombreEdificio={nombreEdificio}
            isDarkMode={isDarkMode}
          />
          {/* Selector de Modo 2D / 3D */}
          <View style={[styles.modeToggleContainer, !isDarkMode && styles.modeToggleContainerLight]}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                modoVista === "2d" && (isDarkMode ? styles.modeBtnActiveDark : styles.modeBtnActiveLight),
              ]}
              onPress={() => setModoVista("2d")}
              activeOpacity={0.7}
            >
              <Layers size={14} color={modoVista === "2d" ? (isDarkMode ? "#ffffff" : "#0f172a") : (isDarkMode ? "#71717a" : "#64748b")} />
              <Text
                style={[
                  styles.modeBtnText,
                  !isDarkMode && styles.modeBtnTextLight,
                  modoVista === "2d" && (isDarkMode ? styles.modeBtnTextActiveDark : styles.modeBtnTextActiveLight),
                ]}
              >
                2D Plano
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeBtn,
                modoVista === "3d" && (isDarkMode ? styles.modeBtnActiveDark : styles.modeBtnActiveLight),
              ]}
              onPress={() => setModoVista("3d")}
              activeOpacity={0.7}
            >
              <Box size={14} color={modoVista === "3d" ? (isDarkMode ? "#ffffff" : "#0f172a") : (isDarkMode ? "#71717a" : "#64748b")} />
              <Text
                style={[
                  styles.modeBtnText,
                  !isDarkMode && styles.modeBtnTextLight,
                  modoVista === "3d" && (isDarkMode ? styles.modeBtnTextActiveDark : styles.modeBtnTextActiveLight),
                ]}
              >
                3D Quiosco
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {aulaResaltada && (
          <View
            style={[
              styles.resaltadoBanner,
              !isDarkMode && styles.resaltadoBannerLight,
            ]}
          >
            <Text style={styles.resaltadoText}>
              RESALTADO: {aulaResaltada.toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => setAulaResaltada(null)}>
              <Text style={styles.quitarText}>quitar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.mapCard, !isDarkMode && styles.mapCardLight]}>
          <View style={styles.mapContent}>
            <FloorSelector
              planta={planta}
              setPlanta={setPlanta}
              isDarkMode={isDarkMode}
            />
            <View
              style={[
                styles.imageContainer,
                !isDarkMode && styles.imageContainerLight,
              ]}
            >
              <View style={styles.mapWrapper}>
                {modoVista === "3d" ? (
                  <Mapa3DView
                    svgXml={currentSvgFor3D}
                    edificioId={edificioId}
                    planta={planta}
                    selectedRoomId={targetSvgId}
                    isDarkMode={isDarkMode}
                    onRoomClick={(id) => setAulaResaltada(normalizarAulaParam(id)?.toUpperCase() ?? null)}
                  />
                ) : (
                  <MapaWebView
                    ref={webViewRef}
                    svgBaja={processedBaja}
                    svgAlta={processedAlta}
                    planta={planta}
                    targetSvgId={targetSvgId}
                    onAulaClick={(id) => setAulaResaltada(normalizarAulaParam(id)?.toUpperCase() ?? null)}
                    isDarkMode={isDarkMode}
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  screenLight: { backgroundColor: "transparent" },
  main: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  modeToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  modeToggleContainerLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeBtnActiveDark: {
    backgroundColor: "#27272a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnActiveLight: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  modeBtnTextLight: {
    color: "#64748b",
  },
  modeBtnTextActiveDark: {
    color: "#ffffff",
  },
  modeBtnTextActiveLight: {
    color: "#0f172a",
  },
  resaltadoBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(30, 20, 50, 0.6)",
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  resaltadoBannerLight: { backgroundColor: "#f3e8ff" },
  resaltadoText: { color: "#c084fc", fontWeight: "bold" },
  quitarText: { color: "#71717a", textDecorationLine: "underline" },
  
  /* CONTENEDOR PRINCIPAL DEL MAPA Y BOTONES LATERALES */
  mapCard: {
    flex: 1,
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
  },
  mapCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  mapContent: { flex: 1, flexDirection: "row" },
  
  /* ÁREA ESPECÍFICA DONDE SE DIBUJA EL SVG / 3D */
  imageContainer: { 
    flex: 1, 
    backgroundColor: "#08080a", 
    padding: 0,
  },
  imageContainerLight: { 
    backgroundColor: "#f1f4f8",
  },
  mapWrapper: { width: "100%", height: "100%", position: "relative" },
});

export default Edificio;
