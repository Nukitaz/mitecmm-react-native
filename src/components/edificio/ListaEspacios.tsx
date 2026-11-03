import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import type { Espacio } from "../../utils/espacios";

interface ListaEspaciosProps {
  espacios: Espacio[];
  seleccionado: string | null;
  isDarkMode: boolean;
  onSeleccionar: (id: string) => void;
}

/*
 * Nota: se usan las props `role` y `aria-*` (React Native 0.71+): react-native-web 0.21 ya no
 * traduce accessibilityState/accessibilityLabel a atributos ARIA en la web.
 */
/**
 * Lista de los espacios de la planta: alternativa accesible al mapa 2D/3D
 * (lector de pantalla, teclado, o simplemente encontrar un aula por su nombre).
 */
export const ListaEspacios: React.FC<ListaEspaciosProps> = ({ espacios, seleccionado, isDarkMode, onSeleccionar }) => {
  const [abierta, setAbierta] = useState(false);
  if (!espacios.length) return null;

  return (
    <View style={[styles.contenedor, !isDarkMode && styles.contenedorClaro]}>
      <TouchableOpacity
        onPress={() => setAbierta((v) => !v)}
        style={styles.cabecera}
        role="button"
        aria-expanded={abierta}
        aria-label={`Lista de espacios de esta planta, ${espacios.length} espacios`}
      >
        <Text style={[styles.titulo, !isDarkMode && styles.tituloClaro]}>
          {abierta ? "▾" : "▸"} Lista de espacios ({espacios.length})
        </Text>
      </TouchableOpacity>
      {abierta && (
        <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
          {espacios.map((e) => {
            const activo = seleccionado === e.id;
            return (
              <TouchableOpacity
                key={e.id}
                onPress={() => onSeleccionar(e.id)}
                style={[styles.chip, !isDarkMode && styles.chipClaro, activo && styles.chipActivo]}
                role="button"
                aria-selected={activo}
                aria-label={`${e.nombre}${activo ? ", resaltado" : ""}`}
              >
                <Text style={[styles.chipTexto, !isDarkMode && styles.chipTextoClaro, activo && styles.chipTextoActivo]}>
                  {e.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#0d0d10",
    borderRadius: 6,
  },
  contenedorClaro: { borderColor: "#e2e8f0", backgroundColor: "#ffffff" },
  cabecera: { paddingHorizontal: 12, paddingVertical: 10 },
  titulo: { color: "#e4e4e7", fontWeight: "700", fontSize: 13 },
  tituloClaro: { color: "#0f172a" },
  lista: { maxHeight: 180 },
  listaContenido: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
  },
  chipClaro: { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" },
  chipActivo: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipTexto: { color: "#d4d4d8", fontSize: 12 },
  chipTextoClaro: { color: "#334155" },
  chipTextoActivo: { color: "#ffffff", fontWeight: "700" },
});
