import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

interface EstadoPlanoProps {
  tipo: "cargando" | "error";
  mensaje: string;
  detalle?: string;
  isDarkMode: boolean;
  onReintentar?: () => void;
}

/** Estado de carga o de error de un plano, con opción de reintentar. */
export const EstadoPlano: React.FC<EstadoPlanoProps> = ({ tipo, mensaje, detalle, isDarkMode, onReintentar }) => {
  const colorTexto = isDarkMode ? "#e4e4e7" : "#0f172a";
  const colorDetalle = isDarkMode ? "#a1a1aa" : "#64748b";

  return (
    <View style={styles.contenedor} accessibilityRole={tipo === "error" ? "alert" : "progressbar"}>
      {tipo === "cargando" ? (
        <ActivityIndicator size="large" color="#a855f7" />
      ) : (
        <Text style={styles.icono} accessibilityElementsHidden importantForAccessibility="no">
          ⚠
        </Text>
      )}
      <Text style={[styles.mensaje, { color: colorTexto }]}>{mensaje}</Text>
      {!!detalle && <Text style={[styles.detalle, { color: colorDetalle }]}>{detalle}</Text>}
      {tipo === "error" && onReintentar && (
        <TouchableOpacity
          onPress={onReintentar}
          style={styles.boton}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
        >
          <Text style={styles.botonTexto}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    width: "100%",
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  icono: { fontSize: 28, color: "#f59e0b" },
  mensaje: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  detalle: { fontSize: 13, textAlign: "center", maxWidth: 420 },
  boton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: "#7c3aed",
  },
  botonTexto: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
});
