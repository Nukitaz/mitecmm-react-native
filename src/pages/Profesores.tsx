import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Search, Book, Calendar, Clock, MapPin, User } from "lucide-react-native";
import { Navbar } from "../components/Navbar";
import { obtenerProfesores, HorarioDocente } from "../services/profesoresService";
import { AULAS_UBICACIONES } from "./Mapa";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";

type Suggestion = {
  id: string;
  type: "aula" | "prof" | "materia";
  label: string;
  detail: string;
  aulaResaltada: string;
};

const ProfesorCard = ({ prof }: { prof: HorarioDocente }) => {
  const { isDarkMode } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  
  const initials = prof.docente
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <View
      style={[
        styles.card,
        !isDarkMode && styles.cardLight,
        isHovered && (isDarkMode ? styles.cardHovered : styles.cardHoveredLight),
      ]}
      {...({
        onPointerEnter: () => setIsHovered(true),
        onPointerLeave: () => setIsHovered(false),
      } as any)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, !isDarkMode && styles.avatarLight]}>
          <Text style={[styles.avatarText, !isDarkMode && styles.avatarTextLight]}>
            {initials}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.docenteName, !isDarkMode && styles.textLight]}>
            {prof.docente}
          </Text>
          <Text style={[styles.grupoText, !isDarkMode && styles.textLightSecondary]}>
            GRUPO {prof.grupo ? prof.grupo : "N/A"}
          </Text>
        </View>
      </View>
      
      <View style={[styles.divider, !isDarkMode && styles.dividerLight]} />
      
      <View style={styles.infoRow}>
        <Book size={16} color={isDarkMode ? "#71717a" : "#64748b"} />
        <Text style={[styles.infoText, !isDarkMode && styles.textLight]}>
          {prof.materia}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Calendar size={16} color={isDarkMode ? "#71717a" : "#64748b"} />
        <Text style={[styles.infoText, !isDarkMode && styles.textLight]}>
          {prof.dia}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Clock size={16} color={isDarkMode ? "#71717a" : "#64748b"} />
        <Text style={[styles.infoText, !isDarkMode && styles.textLight]}>
          {prof.hora_inicio} → {prof.hora_fin}
        </Text>
      </View>
      
      <View style={[styles.aulaContainer, !isDarkMode && styles.aulaContainerLight]}>
        <MapPin size={14} color="#a855f7" />
        <Text style={[styles.aulaText, !isDarkMode && styles.textLight]}>
          AULA {prof.aula}
        </Text>
      </View>
    </View>
  );
};

const Profesores = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();
  
  const queryInicial = route?.params?.q || "";
  
  const [busqueda, setBusqueda] = useState(queryInicial);
  const [profesores, setProfesores] = useState<HorarioDocente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFocused, setIsFocused] = useState(false);
  const [sugerencias, setSugerencias] = useState<Suggestion[]>([]);

  useEffect(() => {
    cargarProfesores(busqueda);
  }, []);

  const cargarProfesores = async (term: string) => {
    setIsLoading(true);
    const data = await obtenerProfesores(term);
    setProfesores(data);
    setIsLoading(false);
  };

  const handleSearch = () => {
    cargarProfesores(busqueda);
    setIsFocused(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (busqueda.trim().length < 2) {
        setSugerencias([]);
        return;
      }
      
      const term = busqueda.toUpperCase();
      let nuevasSugerencias: Suggestion[] = [];

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

      const resultadosDB = await obtenerProfesores(busqueda);
      const docentesAgregados = new Set();
      const materiasAgregadas = new Set();
      const aulasAgregadas = new Set();

      resultadosDB?.forEach((item) => {
        if (item.docente.toUpperCase().includes(term) && !docentesAgregados.has(item.docente)) {
          docentesAgregados.add(item.docente);
          nuevasSugerencias.push({
            id: `prof-${item.id}`,
            type: "prof",
            label: item.docente,
            detail: "PROF",
            aulaResaltada: item.aula,
          });
        }
        if (item.materia.toUpperCase().includes(term) && !materiasAgregadas.has(item.materia)) {
          materiasAgregadas.add(item.materia);
          nuevasSugerencias.push({
            id: `mat-${item.id}`,
            type: "materia",
            label: item.materia,
            detail: "MATERIA",
            aulaResaltada: item.aula,
          });
        }
        if (
          item.aula.toUpperCase().includes(term) &&
          !aulasAgregadas.has(item.aula) &&
          !Object.keys(AULAS_UBICACIONES).includes(item.aula.toUpperCase())
        ) {
          aulasAgregadas.add(item.aula);
          nuevasSugerencias.push({
            id: `aula-db-${item.id}`,
            type: "aula",
            label: `AULA ${item.aula}`,
            detail: "SALÓN",
            aulaResaltada: item.aula,
          });
        }
      });
      
      setSugerencias(nuevasSugerencias.slice(0, 6));
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  const handleSelectSuggestion = (item: Suggestion) => {
    setIsFocused(false);
    
    if (item.type === "aula") {
      const ubicacion = AULAS_UBICACIONES[item.aulaResaltada.toUpperCase()];
      if (ubicacion) {
        navigation.navigate("Edificio", {
          id: ubicacion.edificioId,
          nombre: ubicacion.nombreEdificio,
          plantaInicial: ubicacion.planta,
          aulaResaltada: item.aulaResaltada,
        });
      } else {
        setBusqueda(item.aulaResaltada);
        cargarProfesores(item.aulaResaltada);
      }
    } else {
      setBusqueda(item.label);
      cargarProfesores(item.label);
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
          <View style={styles.headerSection}>
            <Text style={[styles.modCode, !isDarkMode && styles.textLightSecondary]}>
              [ MOD_02 · DOCENT_LOCATOR ]
            </Text>
            <Text style={[styles.title, !isDarkMode && styles.titleLight]}>
              Búsqueda de Profesores
            </Text>
            <Text style={[styles.subtitle, !isDarkMode && styles.subtitleLight]}>
              Encuentra docentes, materias y horarios en tiempo real.
            </Text>
          </View>

          <View style={styles.searchWrapper}>
            <View
              style={[
                styles.searchContainer,
                !isDarkMode && styles.searchContainerLight,
                isFocused && (isDarkMode ? styles.searchContainerActive : styles.searchContainerActiveLight),
              ]}
            >
              <Search
                size={20}
                color={isFocused ? "#a855f7" : isDarkMode ? "#a1a1aa" : "#64748b"}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, !isDarkMode && styles.searchInputLight]}
                placeholder="Busca salón, profesor o materia..."
                placeholderTextColor={isDarkMode ? "#71717a" : "#94a3b8"}
                value={busqueda}
                onChangeText={setBusqueda}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                onSubmitEditing={handleSearch}
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

          <View style={styles.resultsHeader}>
            <Text style={[styles.resultsText, !isDarkMode && styles.textLightSecondary]}>
              {profesores.length} RESULTADOS
            </Text>
            <View style={styles.dot} />
            <Text style={styles.activeText}>EN CLASE AHORA</Text>
          </View>

          <View style={styles.grid}>
            {isLoading ? (
              <Text style={[styles.loadingText, !isDarkMode && styles.textLightSecondary]}>
                Buscando registros...
              </Text>
            ) : profesores.length > 0 ? (
              profesores.map((prof) => <ProfesorCard key={prof.id} prof={prof} />)
            ) : (
              <Text style={[styles.loadingText, !isDarkMode && styles.textLightSecondary]}>
                No se encontraron resultados.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  /* FONDOS Y ESTRUCTURA GENERAL */
  screen: {
    flex: 1,
    backgroundColor: "#08080a",
  },
  screenLight: {
    backgroundColor: "#f8fafc",
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
    zIndex: 1,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 32,
    zIndex: 50,
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
  titleLight: {
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    marginTop: 8,
  },
  subtitleLight: {
    color: "#64748b",
  },

  /* BUSCADOR */
  searchWrapper: {
    width: "100%",
    maxWidth: 600,
    position: "relative",
    zIndex: 100,
    alignSelf: "center",
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    paddingHorizontal: 16,
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
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 16,
    outlineStyle: "none" as any,
  },
  searchInputLight: {
    color: "#0f172a",
  },

  /* DROPDOWN SUGERENCIAS */
  dropdownContainer: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: "#18181c",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 999,
  },
  dropdownContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowOpacity: 0.1,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
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
    fontSize: 14,
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

  /* CABECERA DE RESULTADOS */
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  resultsText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
    letterSpacing: 1.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#a855f7",
  },
  activeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#a855f7",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },

  /* GRID Y TARJETAS */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "center",
  },
  loadingText: {
    color: "#71717a",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1e1e24",
    padding: 20,
    width: "100%",
    maxWidth: 400,
    ...(Platform.OS === "web"
      ? ({
          transitionDuration: "0.25s",
          transitionProperty: "border-color, box-shadow, background-color",
        } as any)
      : {}),
  },
  cardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardHovered: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  cardHoveredLight: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 45,
    height: 45,
    backgroundColor: "#1c142c",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLight: {
    backgroundColor: "#f3e8ff",
  },
  avatarText: {
    color: "#c084fc",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 1,
  },
  avatarTextLight: {
    color: "#9333ea",
  },
  headerInfo: {
    flex: 1,
  },
  docenteName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  grupoText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#71717a",
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#1e1e24",
    marginBottom: 16,
  },
  dividerLight: {
    backgroundColor: "#f1f5f9",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    color: "#e4e4e7",
    fontSize: 14,
    fontWeight: "500",
  },
  aulaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#121215",
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1e1e24",
  },
  aulaContainerLight: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  aulaText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#e4e4e7",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  /* AUXILIARES DE TEXTO CLARO */
  textLight: {
    color: "#0f172a",
  },
  textLightSecondary: {
    color: "#64748b",
  },
});

export default Profesores;