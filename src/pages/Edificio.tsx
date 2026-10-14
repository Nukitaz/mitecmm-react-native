import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Navbar } from "../components/Navbar";
import { EdificioHeader } from "../components/edificio/EdificioHeader";
import { FloorSelector } from "../components/edificio/FloorSelector";
import { MapaWebView } from "../components/edificio/MapaWebView";
import { getPlanoEdificioUrl } from "../services/mapasService";
import { AULAS_UBICACIONES } from "./Mapa";
import { useTheme } from "../context/ThemeContext";

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

  const [aulaResaltada, setAulaResaltada] = useState<string | null>(
    route?.params?.aulaResaltada || null
  );
  const [planta, setPlanta] = useState<"baja" | "alta">(plantaInicial);

  const [svgBaja, setSvgBaja] = useState<string | null>(null);
  const [svgAlta, setSvgAlta] = useState<string | null>(null);

  const planoBajaUrl = getPlanoEdificioUrl(edificioId, "baja");
  const planoAltaUrl = getPlanoEdificioUrl(edificioId, "alta");

  useEffect(() => {
    if (route?.params?.aulaResaltada !== undefined) {
      const nuevaAula = route.params.aulaResaltada;
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
      .then(setSvgBaja)
      .catch(console.error);

    fetch(planoAltaUrl)
      .then((r) => r.text())
      .then(setSvgAlta)
      .catch(console.error);
  }, [edificioId]);

  const targetSvgId = useMemo(() => {
    if (!aulaResaltada) return null;
    const claveUpper = aulaResaltada.toUpperCase();
    const ubicacion = AULAS_UBICACIONES[claveUpper];

    if (ubicacion?.svgId) {
      return ubicacion.svgId;
    }

    const limpia = aulaResaltada.toLowerCase().trim();
    return `aula_${limpia}`;
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

  return (
    <View style={[styles.screen, !isDarkMode && styles.screenLight]}>
      <Navbar />
      <View style={styles.main}>
        <EdificioHeader
          edificioId={edificioId}
          nombreEdificio={nombreEdificio}
          isDarkMode={isDarkMode}
        />

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
                <MapaWebView
                  ref={webViewRef}
                  svgBaja={processedBaja}
                  svgAlta={processedAlta}
                  planta={planta}
                  targetSvgId={targetSvgId}
                  onAulaClick={(id) => setAulaResaltada(id.toUpperCase())}
                  isDarkMode={isDarkMode}
                />
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
    borderColor: "#27272a", // Borde visible en oscuro
    overflow: "hidden",
  },
  mapCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0", // Borde sutil visible en claro
    borderWidth: 1, // Restaura explícitamente el borde que se había perdido
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  mapContent: { flex: 1, flexDirection: "row" },
  
  /* ÁREA ESPECÍFICA DONDE SE DIBUJA EL SVG */
  imageContainer: { 
    flex: 1, 
    backgroundColor: "#08080a", 
    padding: 6 
  },
  imageContainerLight: { 
    backgroundColor: "#ffffff" // Asegura fondo blanco uniforme con mapCard
  },
  mapWrapper: { width: "100%", height: "100%", position: "relative" },
});

export default Edificio;