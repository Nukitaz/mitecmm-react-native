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
import { useNavigation } from "@react-navigation/native";
import { Navbar } from "../components/Navbar";
import { getMapaGeneralUrl } from "../services/mapasService";

const EDIFICIOS_MAPEADOS = [
  { id: "g", nombre: "Edificio G", top: "18%", left: "4.5%", width: "13.5%", height: "10%" },
  { id: "dg", nombre: "Edificio DG", top: "14%", left: "31%", width: "11%", height: "10%" },
  { id: "o", nombre: "Edificio O", top: "23.5%", left: "52%", width: "10%", height: "5%" },
  { id: "p", nombre: "Edificio P", top: "46%", left: "19%", width: "13.5%", height: "10%" },
  { id: "l", nombre: "Edificio L", top: "46%", left: "38%", width: "9.5%", height: "10%" },
  { id: "a", nombre: "Edificio A", top: "43.5%", left: "55.5%", width: "13.5%", height: "10%" },
  { id: "i", nombre: "Edificio I", top: "69%", left: "44.5%", width: "13.5%", height: "10%" },
  { id: "em", nombre: "Edificio EM", top: "63.5%", left: "67.5%", width: "13.5%", height: "11%" },
  { id: "b", nombre: "Edificio B", top: "84.5%", left: "62%", width: "13.5%", height: "11%" },
];

const Mapa = () => {
  const navigation = useNavigation<any>();
  const mapaGeneralUrl = getMapaGeneralUrl();
  const [activeBuilding, setActiveBuilding] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false); // Estado para la luz LED

  return (
    <View style={styles.screen}>
      <Navbar />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.main}>
          <View style={styles.headerSection}>
            <Text style={styles.modCode}>[ MOD_03 · CAMPUS_MAP ]</Text>
            <Text style={styles.title}>Mapa del Campus</Text>
            <Text style={styles.subtitle}>
              Selecciona un edificio para explorar sus plantas y distribución.
            </Text>
          </View>

          {/* Contenedor con eventos de hover para el efecto LED */}
          <View 
            style={[styles.mapCard, isHovered && styles.mapCardHovered]}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            <View style={styles.mapHeader}>
              <Text style={styles.mapTag}>// MAPA_GENERAL.SVG</Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {activeBuilding
                    ? `EDIFICIO ${activeBuilding.toUpperCase()}`
                    : "LIVE"}
                </Text>
              </View>
            </View>

            <View style={styles.canvasContainer}>
              <View style={styles.mapWrapper}>
                <Image
                  source={{ uri: mapaGeneralUrl }}
                  style={styles.mapSvgImage}
                  resizeMode="contain"
                />

                {EDIFICIOS_MAPEADOS.map((edificio) => {
                  const isSelected = activeBuilding === edificio.id;
                  return (
                    <TouchableOpacity
                      key={edificio.id}
                      style={[
                        styles.buildingHotspot,
                        {
                          top: edificio.top as any,
                          left: edificio.left as any,
                          width: edificio.width as any,
                          height: edificio.height as any,
                        },
                        isSelected && styles.buildingHotspotActive,
                      ]}
                      activeOpacity={0.7}
                      onPressIn={() => setActiveBuilding(edificio.id)}
                      onPressOut={() => setActiveBuilding(null)}
                      onPress={() =>
                        navigation.navigate("Edificio", {
                          id: edificio.id,
                          nombre: edificio.nombre,
                        })
                      }
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.mapFooter}>
              <Text style={styles.footerInfoText}>
                {EDIFICIOS_MAPEADOS.length} EDIFICIOS DISPONIBLES
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#08080a" },
  container: { flexGrow: 1 },
  main: { flex: 1, paddingHorizontal: 16, paddingVertical: 20, maxWidth: 1100, width: "100%", alignSelf: "center" },
  headerSection: { alignItems: "center", marginBottom: 16 },
  modCode: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11, color: "#71717a" },
  title: { fontSize: 36, fontWeight: "900", color: "#ffffff", marginTop: 4 },
  subtitle: { fontSize: 14, color: "#a1a1aa", marginTop: 4 },
  
  mapCard: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 16,
    width: "100%",
    ...Platform.select({
      web: { transitionDuration: "0.3s", transitionProperty: "border-color, box-shadow" } as any,
    }),
  },
  /* EFECTO LED AL PASAR EL CURSOR */
  mapCardHovered: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  
  mapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  mapTag: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11, color: "#71717a" },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#a855f7" },
  liveText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 10, color: "#a855f7", fontWeight: "bold" },
  canvasContainer: { width: "100%", backgroundColor: "#08080a", borderRadius: 4, borderWidth: 1, borderColor: "#1e1e24", alignItems: "center", justifyContent: "center" },
  mapWrapper: { position: "relative", width: "100%", aspectRatio: 1.43 },
  mapSvgImage: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  buildingHotspot: { position: "absolute", backgroundColor: "transparent", borderRadius: 4, zIndex: 10 },
  buildingHotspotActive: { backgroundColor: "rgba(168, 85, 247, 0.35)", borderWidth: 2, borderColor: "#c084fc", shadowColor: "#a855f7", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 },
  mapFooter: { marginTop: 12, alignItems: "center" },
  footerInfoText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 10, color: "#71717a", letterSpacing: 2 },
});

export default Mapa;
