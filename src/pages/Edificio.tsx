import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { Navbar } from "../components/Navbar";
import { getPlanoEdificioUrl } from "../services/mapasService";

const Edificio = ({ route }: any) => {
  const edificioId = route?.params?.id || "p";
  const nombreEdificio =
    route?.params?.nombre || `Edificio ${edificioId.toUpperCase()}`;

  const [planta, setPlanta] = useState<"baja" | "alta">("baja");
  const [isHovered, setIsHovered] = useState(false); // Estado para el resplandor LED
  
  const planoUrl = getPlanoEdificioUrl(edificioId, planta);

  return (
    <View style={styles.screen}>
      <Navbar />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.main}>
          {/* Encabezado */}
          <View style={styles.headerSection}>
            <Text style={styles.modCode}>
              [ MOD_03 · BUILDING_{edificioId.toUpperCase()} ]
            </Text>
            <Text style={styles.title}>{nombreEdificio}</Text>
          </View>

          {/* Tarjeta Principal del Visor con Eventos de Puntero para el Hover */}
          <View
            style={[styles.mapCard, isHovered && styles.mapCardHovered]}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            {/* Cabecera del visor */}
            <View style={styles.mapHeader}>
              <Text style={styles.mapTag}>
                // PLANTA_{planta.toUpperCase()}_EDIFICIO_{edificioId.toUpperCase()}.SVG
              </Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            {/* Contenido (Barra Lateral + Mapa) */}
            <View style={styles.mapContent}>
              {/* Barra Lateral Izquierda para Selección de Piso */}
              <View style={styles.sidebar}>
                <Text style={styles.sidebarTitle}>PISO</Text>

                <View style={styles.floorToggleGroup}>
                  <TouchableOpacity
                    style={[
                      styles.floorBtn,
                      planta === "alta" && styles.floorBtnActive,
                    ]}
                    onPress={() => setPlanta("alta")}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.floorBtnText,
                        planta === "alta" && styles.floorBtnTextActive,
                      ]}
                    >
                      PA
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <TouchableOpacity
                    style={[
                      styles.floorBtn,
                      planta === "baja" && styles.floorBtnActive,
                    ]}
                    onPress={() => setPlanta("baja")}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.floorBtnText,
                        planta === "baja" && styles.floorBtnTextActive,
                      ]}
                    >
                      PB
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.floorLabel}>
                  {planta === "alta" ? "↑ ALTA" : "↓ BAJA"}
                </Text>
              </View>

              {/* Contenedor de la Imagen SVG */}
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: planoUrl }}
                  style={styles.mapImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#08080a",
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
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 24,
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
  mapCard: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
    width: "100%",
    // Transición suave nativa para web
    ...Platform.select({
      web: {
        transitionDuration: "0.3s",
        transitionProperty: "border-color, box-shadow",
      } as any,
    }),
  },
  /* --- ESTILOS DE EFECTO HOVER LED --- */
  mapCardHovered: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  /* ---------------------------------- */
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e24",
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
  floorBtnText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
    fontWeight: "bold",
    color: "#71717a",
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
  imageContainer: {
    flex: 1,
    backgroundColor: "#08080a",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  mapImage: {
    width: "100%",
    height: "100%",
    minHeight: 400,
  },
});

export default Edificio;
