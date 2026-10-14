import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";

interface FloorSelectorProps {
  planta: "baja" | "alta";
  setPlanta: (planta: "baja" | "alta") => void;
  isDarkMode: boolean;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  planta,
  setPlanta,
  isDarkMode,
}) => {
  return (
    <View style={[styles.sidebar, !isDarkMode && styles.sidebarLight]}>
      <Text style={[styles.sidebarTitle, !isDarkMode && styles.textLightSecondary]}>
        PISO
      </Text>
      <View style={[styles.floorToggleGroup, !isDarkMode && styles.floorToggleGroupLight]}>
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
  );
};

const styles = StyleSheet.create({
  sidebar: { width: 60, borderRightWidth: 1, borderRightColor: "#1e1e24", alignItems: "center", paddingVertical: 14 },
  sidebarLight: { borderRightColor: "#e2e8f0" },
  sidebarTitle: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 9, color: "#71717a", marginBottom: 10 },
  floorToggleGroup: { borderWidth: 1, borderColor: "#27272a", borderRadius: 4, width: 40, backgroundColor: "#121215", overflow: "hidden" },
  floorToggleGroupLight: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  floorBtn: { height: 40, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },
  floorBtnActive: { backgroundColor: "#a855f7" },
  divider: { height: 1, backgroundColor: "#27272a" },
  dividerLight: { backgroundColor: "#e2e8f0" },
  floorBtnText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 13, fontWeight: "bold", color: "#71717a" },
  floorBtnTextLight: { color: "#64748b" },
  floorBtnTextActive: { color: "#ffffff" },
  floorLabel: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 9, color: "#71717a", marginTop: 10 },
  textLightSecondary: { color: "#64748b" },
});