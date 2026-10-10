import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Search, User, Book, MapPin, Users } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Navbar } from "../components/Navbar";
import { AvisosBanner } from "../components/AvisosBanner";
import { useTheme } from "../context/ThemeContext";
import { AULAS_UBICACIONES } from "./Mapa";
import { obtenerProfesores } from "../services/profesoresService";

type Suggestion = {
  id: string;
  type: "aula" | "prof" | "materia";
  label: string;
  detail: string;
  aulaResaltada: string;
};

export const Index = () => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();

  // Estados del Buscador
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sugerencias, setSugerencias] = useState<Suggestion[]>([]);

  // Lógica del autocompletado en vivo (Debounce 300ms)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length < 2) {
        setSugerencias([]);
        return;
      }

      const term = searchTerm.toUpperCase();
      let nuevasSugerencias: Suggestion[] = [];

      // 1. Filtrar Aulas mapeadas
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

      // 2. Búsqueda en Supabase para Profesores y Materias
      const resultadosDB = await obtenerProfesores(searchTerm);
      const docentesAgregados = new Set();
      const materiasAgregadas = new Set();

      resultadosDB?.forEach((item) => {
        if (
          item.docente.toUpperCase().includes(term) &&
          !docentesAgregados.has(item.docente)
        ) {
          docentesAgregados.add(item.docente);
          nuevasSugerencias.push({
            id: `prof-${item.id}`,
            type: "prof",
            label: item.docente,
            detail: "PROF",
            aulaResaltada: item.aula,
          });
        }
        if (
          item.materia.toUpperCase().includes(term) &&
          !materiasAgregadas.has(item.materia)
        ) {
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
  }, [searchTerm]);

  const handleSelectSuggestion = (item: Suggestion) => {
    setSearchTerm(item.label);
    setIsFocused(false);

    let ubicacion = AULAS_UBICACIONES[item.aulaResaltada.toUpperCase()];

    if (!ubicacion) {
      const letraEdificio = item.aulaResaltada.charAt(0).toLowerCase();
      const edificiosValidos = [
        "a",
        "b",
        "c",
        "f",
        "g",
        "i",
        "l",
        "o",
        "p",
        "e",
      ];

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
      navigation.navigate("Edificio", {
        id: ubicacion.edificioId,
        nombre: ubicacion.nombreEdificio,
        plantaInicial: ubicacion.planta,
        aulaResaltada: item.aulaResaltada,
      });
    } else {
      navigation.navigate("Profesores", { q: item.label });
    }
  };

  const handleSearchSubmit = () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    const aulaEncontrada = Object.keys(AULAS_UBICACIONES).find(
      (aula) => aula === term || term.includes(aula)
    );

    if (aulaEncontrada) {
      const ubicacion = AULAS_UBICACIONES[aulaEncontrada];
      navigation.navigate("Edificio", {
        id: ubicacion.edificioId,
        nombre: ubicacion.nombreEdificio,
        plantaInicial: ubicacion.planta,
        aulaResaltada: aulaEncontrada,
      });
    } else {
      navigation.navigate("Profesores", { q: searchTerm.trim() });
    }
  };

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

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.main}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <Text
              style={[
                styles.buildText,
                !isDarkMode && styles.textLightSecondary,
              ]}
            >
              [ BUILD_V1.0.2 ]
            </Text>
            <Text style={[styles.title, !isDarkMode && styles.titleLight]}>
              MiTecmm
            </Text>
            <Text
              style={[
                styles.subtitle,
                !isDarkMode && styles.subtitleLight,
              ]}
            >
              Sistema de navegación oficial del Tecnológico de Jalisco.
            </Text>

            {/* Buscador */}
            <View style={styles.searchWrapper}>
              <View
                style={[
                  styles.searchContainer,
                  !isDarkMode && styles.searchContainerLight,
                  isFocused &&
                    (isDarkMode
                      ? styles.searchContainerActive
                      : styles.searchContainerActiveLight),
                ]}
              >
                <Search
                  size={18}
                  color={
                    isFocused
                      ? "#a855f7"
                      : isDarkMode
                      ? "#a1a1aa"
                      : "#64748b"
                  }
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    !isDarkMode && styles.searchInputLight,
                  ]}
                  placeholder="Busca un salón, laboratorio u oficina..."
                  placeholderTextColor={isDarkMode ? "#71717a" : "#94a3b8"}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                />
              </View>

              {/* Menú Flotante de Sugerencias */}
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
                          (isDarkMode
                            ? styles.dropdownItemBorder
                            : styles.dropdownItemBorderLight),
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSuggestion(sug)}
                    >
                      <View style={styles.dropdownLeft}>
                        <IconoTipo type={sug.type} />
                        <Text
                          style={[
                            styles.dropdownLabel,
                            !isDarkMode && styles.dropdownLabelLight,
                          ]}
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

          {/* Banner de Avisos con Marquee + Historial */}
          <AvisosBanner />

          {/* Módulos en 2 Columnas Horizontales */}
          <View style={styles.modulesGrid}>
            <ModuleCard
              onPress={() => navigation.navigate("Mapa")}
              code="MOD_01"
              title="INFRASTRUCTURE_NAV"
              description="Mapa interactivo de edificios, pisos y aulas."
              icon={<MapPin size={20} color="#a855f7" />}
              isDarkMode={isDarkMode}
            />
            <ModuleCard
              onPress={() => navigation.navigate("Profesores")}
              code="MOD_02"
              title="DOCENT_LOCATOR"
              description="Directorio, horarios y disponibilidad docente."
              icon={<Users size={20} color="#a855f7" />}
              isDarkMode={isDarkMode}
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
  icon: React.ReactNode;
  isDarkMode: boolean;
}

const ModuleCard = ({
  onPress,
  code,
  title,
  description,
  icon,
  isDarkMode,
}: ModuleCardProps) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.card, !isDarkMode && styles.cardLight]}
    activeOpacity={0.8}
  >
    <View style={styles.cardTopRow}>
      <View style={[styles.iconBox, !isDarkMode && styles.iconBoxLight]}>
        {icon}
      </View>
      <Text style={[styles.codeText, !isDarkMode && styles.textLightSecondary]}>
        {code}
      </Text>
    </View>

    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, !isDarkMode && styles.cardTitleLight]}>
        {title}
      </Text>
      <Text
        style={[
          styles.cardDescription,
          !isDarkMode && styles.cardDescriptionLight,
        ]}
      >
        {description}
      </Text>
    </View>

    <View style={[styles.cardBottomLine, !isDarkMode && styles.lineLight]} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  /* PANTALLA Y ESTRUCTURA GENERAL */
  screen: {
    flex: 1,
    backgroundColor: "#08080a",
  },
  screenLight: {
    backgroundColor: "#f8fafc",
  },
  container: { flexGrow: 1 },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 28,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },

  /* HERO */
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
    zIndex: 1000,
    position: "relative",
  },
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
  titleLight: {
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 420,
  },
  subtitleLight: {
    color: "#64748b",
  },

  /* BUSCADOR Y DROPDOWN */
  searchWrapper: {
    width: "100%",
    maxWidth: 580,
    marginTop: 20,
    position: "relative",
    zIndex: 9999,
  },
  searchContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 6,
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
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14,
    outlineStyle: "none" as any,
  },
  searchInputLight: { color: "#0f172a" },

  dropdownContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#18181c",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
    zIndex: 10000,
  },
  dropdownContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
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
    fontSize: 13,
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

  /* MÓDULOS EN 2 COLUMNAS HORIZONTALES */
  modulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    zIndex: 1,
  },
  card: {
    flex: 1,
    minWidth: 320,
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 24,
    justifyContent: "space-between",
  },
  cardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#121215",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBoxLight: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    letterSpacing: 3,
    color: "#71717a",
  },
  cardContent: {
    marginTop: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cardTitleLight: {
    color: "#0f172a",
  },
  cardDescription: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 8,
    lineHeight: 20,
  },
  cardDescriptionLight: {
    color: "#64748b",
  },
  cardBottomLine: {
    height: 1,
    backgroundColor: "#1e1e24",
    width: "100%",
  },
  lineLight: {
    backgroundColor: "#e2e8f0",
  },

  /* TEXTO SECUNDARIO CLARO */
  textLightSecondary: {
    color: "#64748b",
  },
});

export default Index;