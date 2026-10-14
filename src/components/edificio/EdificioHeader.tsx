import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

export type Suggestion = {
  id: string;
  type: "aula" | "prof" | "materia";
  label: string;
  detail: string;
  aulaResaltada: string;
};

// Mantenemos todas las props intactas para no romper Edificio.tsx,
// aunque la barra de búsqueda ya no se renderice visualmente.
interface EdificioHeaderProps {
  edificioId: string;
  nombreEdificio: string;
  isDarkMode: boolean;
  busqueda?: string;
  setBusqueda?: (text: string) => void;
  isFocused?: boolean;
  setIsFocused?: (focused: boolean) => void;
  sugerencias?: Suggestion[];
  onSelectSuggestion?: (sug: Suggestion) => void;
}

export const EdificioHeader: React.FC<EdificioHeaderProps> = ({
  edificioId,
  nombreEdificio,
  isDarkMode,
}) => {
  return (
    <View style={styles.headerSection}>
      <Text style={[styles.modCode, !isDarkMode && styles.textLightSecondary]}>
        [ MOD_03 · BUILDING_{edificioId.toUpperCase()} ]
      </Text>
      <Text style={[styles.title, !isDarkMode && styles.titleLight]}>
        {nombreEdificio}
      </Text>
      {/* 
        La barra de búsqueda y el contenedor del dropdown han sido eliminados.
        Solo se renderiza el encabezado y el título del edificio. 
      */}
    </View>
  );
};

const styles = StyleSheet.create({
  headerSection: {
    alignItems: "center",
    marginBottom: 14, // Un poco más de margen inferior ya que quitamos la barra
  },
  modCode: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#71717a",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 4,
  },
  titleLight: {
    color: "#0f172a",
  },
  textLightSecondary: {
    color: "#64748b",
  },
});

export default EdificioHeader;