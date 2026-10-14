import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { MapPin, Users, Search, User, Book } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Navbar } from "../components/Navbar";
import { AvisosBanner } from "../components/AvisosBanner";
import { ModuleCard } from "../components/index/ModuleCard";
import { useTheme } from "../context/ThemeContext";
import { AULAS_UBICACIONES, Suggestion } from "./Mapa";
import { obtenerProfesores } from "../services/profesoresService";

export const Index = () => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 768 || Platform.OS === "web";

  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sugerencias, setSugerencias] = useState<Suggestion[]>([]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length < 2) {
        setSugerencias([]);
        return;
      }

      const term = searchTerm.toUpperCase().trim();
      let nuevasSugerencias: Suggestion[] = [];

      // 1. Filtrar Aulas estáticas
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

      // 2. Consulta a Supabase (horarios_docentes)
      try {
        const resultadosDB = await obtenerProfesores(searchTerm);

        const profesoresMap = new Map<string, { totalMaterias: Set<string>; aula: string }>();
        const materiasAgregadas = new Set<string>();

        resultadosDB?.forEach((item: any) => {
          const doc = item.docente?.trim();
          const mat = item.materia?.trim();
          const aulaClass = item.aula?.trim();

          // Filtrar por Docente
          if (doc && doc.toUpperCase().includes(term)) {
            if (!profesoresMap.has(doc)) {
              profesoresMap.set(doc, { totalMaterias: new Set(), aula: aulaClass });
            }
            if (mat) profesoresMap.get(doc)!.totalMaterias.add(mat);
          }

          // Filtrar por Materia
          if (mat && mat.toUpperCase().includes(term) && !materiasAgregadas.has(mat)) {
            materiasAgregadas.add(mat);
            nuevasSugerencias.push({
              id: `mat-${item.id || mat}`,
              type: "materia",
              label: mat,
              detail: "MATERIA",
              aulaResaltada: aulaClass,
            });
          }
        });

        // Formatear resultados de Profesores
        profesoresMap.forEach((val, docente) => {
          const count = val.totalMaterias.size;
          nuevasSugerencias.push({
            id: `prof-${docente}`,
            type: "prof",
            label: docente,
            detail: count > 0 ? `PROF · ${count} MATS` : "PROFESOR",
            aulaResaltada: val.aula,
            profesorQuery: docente,
          });
        });
      } catch (err) {
        console.error("Error al consultar Supabase:", err);
      }

      setSugerencias(nuevasSugerencias.slice(0, 6));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSelectSuggestion = (item: Suggestion) => {
    setSearchTerm(item.label);
    setIsFocused(false);

    // Redirección si es Profesor
    if (item.type === "prof") {
      navigation.navigate("Profesores", { q: item.profesorQuery || item.label });
      return;
    }

    // Redirección si es Materia o Aula
    let aulaObjetivo = item.aulaResaltada ? item.aulaResaltada.toUpperCase() : "";
    let ubicacion = AULAS_UBICACIONES[aulaObjetivo];

    if (!ubicacion && aulaObjetivo) {
      const letraEdificio = aulaObjetivo.charAt(0).toLowerCase();
      const edificiosValidos = ["a", "b", "c", "f", "g", "i", "l", "o", "p", "e"];

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
        aulaResaltada: aulaObjetivo,
      });
    } else {
      navigation.navigate("Profesores", { q: item.label });
    }
  };

  const handleSearchSubmit = () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    if (sugerencias.length > 0) {
      handleSelectSuggestion(sugerencias[0]);
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

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.main}>
          <View style={styles.heroSection}>
            <Text style={[styles.buildText, !isDarkMode && styles.textLightSecondary]}>
              [ BUILD_V1.0.2 ]
            </Text>
            <Text style={[styles.title, !isDarkMode && styles.titleLight]}>MiTecmm</Text>
            <Text style={[styles.subtitle, !isDarkMode && styles.subtitleLight]}>
              Sistema de navegación oficial del Tecnológico de Jalisco.
            </Text>

            {/* BUSCADOR INTEGRADO */}
            <View style={styles.searchWrapper}>
              <View
                style={[
                  styles.searchContainer,
                  !isDarkMode && styles.searchContainerLight,
                  isFocused && styles.searchContainerActive,
                ]}
              >
                <Search
                  size={18}
                  color={isFocused ? "#a855f7" : isDarkMode ? "#a1a1aa" : "#64748b"}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, !isDarkMode && styles.searchInputLight]}
                  placeholder="Busca un salón, profesor o materia..."
                  placeholderTextColor={isDarkMode ? "#71717a" : "#94a3b8"}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 250)}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                />
              </View>

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
                          (isDarkMode ? styles.dropdownItemBorder : styles.dropdownItemBorderLight),
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSuggestion(sug)}
                      {...(Platform.OS === "web"
                        ? {
                            onMouseDown: (e: any) => {
                              e.preventDefault();
                              handleSelectSuggestion(sug);
                            },
                          }
                        : {})}
                    >
                      <View style={styles.dropdownLeft}>
                        <IconoTipo type={sug.type} />
                        <Text
                          style={[styles.dropdownLabel, !isDarkMode && styles.dropdownLabelLight]}
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

          <AvisosBanner />

          <View style={[styles.modulesGrid, isDesktop && styles.modulesGridDesktop]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  screenLight: { backgroundColor: "transparent" },
  container: { flexGrow: 1 },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 28,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
    zIndex: 9999,
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
  titleLight: { color: "#0f172a" },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 420,
  },
  subtitleLight: { color: "#64748b" },
  searchWrapper: {
    width: "100%",
    maxWidth: 600,
    marginTop: 20,
    position: "relative",
    zIndex: 10000,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    paddingHorizontal: 14,
  },
  searchContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  searchContainerActive: {
    borderColor: "#a855f7",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 15,
    outlineStyle: "none" as any,
  },
  searchInputLight: {
    color: "#0f172a",
  },
  dropdownContainer: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: "#121118",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    borderRadius: 6,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 25,
    zIndex: 10001,
  },
  dropdownContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
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
    borderBottomColor: "#1e1e24",
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
    color: "#c084fc",
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  modulesGrid: {
    flexDirection: "column",
    gap: 16,
    zIndex: 1,
    width: "100%",
  },
  modulesGridDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  textLightSecondary: { color: "#64748b" },
});

export default Index;