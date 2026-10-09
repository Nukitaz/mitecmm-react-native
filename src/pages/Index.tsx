import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Search } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Navbar } from "../components/Navbar";
import { AvisosBanner } from "../components/AvisosBanner"; // <-- Asegúrate de tener esta línea

const Index = () => {
  const navigation = useNavigation<any>();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      navigation.navigate("Profesores", { q: searchTerm.trim() });
    }
  };

  return (
    <View style={styles.screen}>
      <Navbar />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.main}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <Text style={styles.buildText}>[ BUILD_V1.0.2 ]</Text>
            <Text style={styles.title}>MiTecmm</Text>
            <Text style={styles.subtitle}>
              Sistema de navegación oficial del Tecnológico de Jalisco.
            </Text>

            {/* Buscador */}
            <View style={styles.searchContainer}>
              <Search size={18} color="#a1a1aa" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Busca un salón, laboratorio u oficina..."
                placeholderTextColor="#71717a"
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Componente Dinámico de Avisos con Marquee + Historial Lateral */}
          <AvisosBanner />

          {/* Módulos */}
          <View style={styles.modulesGrid}>
            <ModuleCard
              onPress={() => navigation.navigate("Mapa")}
              code="MOD_01"
              title="INFRASTRUCTURE_NAV"
              description="Mapa interactivo de edificios, pisos y aulas."
            />
            <ModuleCard
              onPress={() => navigation.navigate("Profesores")}
              code="MOD_02"
              title="DOCENT_LOCATOR"
              description="Directorio, horarios y disponibilidad docente."
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

interface ModuleCardProps {
  onPress: () => void;
  code: string;
  title: string;
  description: string;
}

const ModuleCard = ({ onPress, code, title, description }: ModuleCardProps) => (
  <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.8}>
    <View style={styles.cardHeader}>
      <Text style={styles.codeText}>{code}</Text>
    </View>

    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>

    <View style={styles.cardFooter}>
      <View style={styles.line} />
      <Text style={styles.footerAction}>Iniciar →</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#08080a" },
  container: { flexGrow: 1 },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 28,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },
  heroSection: { alignItems: "center", marginBottom: 24 },
  buildText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 3.5,
    color: "#71717a",
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 420,
  },
  searchContainer: {
    width: "100%",
    maxWidth: 580,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 6,
    paddingHorizontal: 14,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, color: "#ffffff", fontSize: 14 },
  modulesGrid: { gap: 16 },
  card: {
    backgroundColor: "#121215",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 22,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 12,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    letterSpacing: 3.5,
    color: "#71717a",
  },
  cardContent: { marginBottom: 16 },
  cardTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  cardDescription: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 6,
    lineHeight: 20,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  line: { flex: 1, height: 1, backgroundColor: "#27272a" },
  footerAction: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    letterSpacing: 3,
    color: "#a855f7",
    fontWeight: "bold",
  },
});

export default Index;
