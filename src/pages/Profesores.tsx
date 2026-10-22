import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
  aulaResaltada?: string;
  profesorQuery?: string;
};

// Nuevo tipo para agrupar las clases por docente
type ProfesorAgrupado = {
  docente: string;
  clases: HorarioDocente[];
};

// Tarjeta modificada para iterar sobre las múltiples clases de un solo profesor
const ProfesorCard = React.memo(({ prof }: { prof: ProfesorAgrupado }) => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const [isHovered, setIsHovered] = useState(false);
  
  const initials = useMemo(() => {
    if (!prof.docente) return "P";
    return prof.docente
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }, [prof.docente]);

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
            {prof.clases.length} CLASE{prof.clases.length !== 1 ? 'S' : ''} PROGRAMADA{prof.clases.length !== 1 ? 'S' : ''}
          </Text>
        </View>
      </View>
      
      {/* Mapeo de todas las clases del profesor dentro de la misma tarjeta */}
      {prof.clases.map((clase, index) => {
        const aulaObjetivo = clase.aula ? clase.aula.trim().toUpperCase() : "";
        const ubicacionValida = AULAS_UBICACIONES[aulaObjetivo];

        const handlePressAula = () => {
          if (!ubicacionValida) return;
          navigation.navigate("Edificio", {
            id: ubicacionValida.edificioId,
            nombre: ubicacionValida.nombreEdificio,
            plantaInicial: ubicacionValida.planta,
            aulaResaltada: aulaObjetivo,
          });
        };

        return (
          <View key={clase.id || index} style={{ marginTop: index > 0 ? 16 : 0 }}>
            <View style={[styles.divider, !isDarkMode && styles.dividerLight]} />
            
            <View style={styles.infoRow}>
              <Book size={16} color={isDarkMode ? "#71717a" : "#64748b"} />
              <Text style={[styles.infoText, !isDarkMode && styles.textLight]}>
                {clase.materia} {clase.grupo ? `(Gpo. ${clase.grupo})` : ""}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Calendar size={16} color={isDarkMode ? "#71717a" : "#64748b"} />
              <Text style={[styles.infoText, !isDarkMode && styles.textLight]}>
                {clase.dia}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Clock size={16} color={isDarkMode ? "#71717a" : "#64748b"} />
              <Text style={[styles.infoText, !isDarkMode && styles.textLight]}>
                {clase.hora_inicio} → {clase.hora_fin}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[
                styles.aulaContainer,
                !isDarkMode && styles.aulaContainerLight,
                !ubicacionValida && { opacity: 0.65 },
              ]}
              onPress={handlePressAula}
              activeOpacity={ubicacionValida ? 0.7 : 1}
            >
              <MapPin
                size={14}
                color={ubicacionValida ? "#a855f7" : isDarkMode ? "#71717a" : "#94a3b8"}
              />
              <Text style={[styles.aulaText, !isDarkMode && styles.textLight]}>
                AULA {clase.aula}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
});

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
    if (route?.params?.q !== undefined) {
      setBusqueda(route.params.q);
    }
  }, [route?.params?.q]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);

      try {
        const resultadosDB = await obtenerProfesores(busqueda);
        setProfesores(resultadosDB || []);

        if (busqueda.trim().length >= 2) {
          const term = busqueda.toUpperCase().trim();
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

          const profesoresMap = new Map<string, { totalMaterias: Set<string>; aula: string }>();
          const materiasAgregadas = new Set<string>();

          resultadosDB?.forEach((item) => {
            const doc = item.docente?.trim();
            const mat = item.materia?.trim();
            const aulaClass = item.aula?.trim();

            if (doc && doc.toUpperCase().includes(term)) {
              if (!profesoresMap.has(doc)) {
                profesoresMap.set(doc, { totalMaterias: new Set(), aula: aulaClass });
              }
              if (mat) profesoresMap.get(doc)!.totalMaterias.add(mat);
            }

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

          setSugerencias(nuevasSugerencias.slice(0, 6));
        } else {
          setSugerencias([]);
        }
      } catch (err) {
        console.error("Error al consultar profesores:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  // Lógica nueva para agrupar los datos obtenidos antes de renderizar
  const profesoresAgrupados = useMemo(() => {
    const grupos = new Map<string, ProfesorAgrupado>();
    profesores.forEach((item) => {
      const nombre = item.docente || "Docente Desconocido";
      if (!grupos.has(nombre)) {
        grupos.set(nombre, { docente: nombre, clases: [] });
      }
      grupos.get(nombre)!.clases.push(item);
    });
    return Array.from(grupos.values());
  }, [profesores]);

  const handleSelectSuggestion = useCallback((item: Suggestion) => {
    setIsFocused(false);
    setBusqueda(item.label);

    if (item.type === "prof") return;

    const aulaObjetivo = item.aulaResaltada ? item.aulaResaltada.toUpperCase() : "";
    const ubicacion = AULAS_UBICACIONES[aulaObjetivo];

    if (ubicacion) {
      navigation.navigate("Edificio", {
        id: ubicacion.edificioId,
        nombre: ubicacion.nombreEdificio,
        plantaInicial: ubicacion.planta,
        aulaResaltada: aulaObjetivo,
      });
    }
  }, [navigation]);

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

  const renderCard = useCallback(({ item }: { item: ProfesorAgrupado }) => (
    <ProfesorCard prof={item} />
  ), []);

  const keyExtractor = useCallback((item: ProfesorAgrupado, index: number) => item.docente + index, []);

  const ListHeaderComponent = useMemo(() => (
    <View style={styles.headerWrapper}>
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
        {/* Actualizado para mostrar cantidad de docentes únicos, no filas crudas de la BD */}
        <Text style={[styles.resultsText, !isDarkMode && styles.textLightSecondary]}>
          {profesoresAgrupados.length} DOCENTES
        </Text>
        <View style={styles.dot} />
        <Text style={styles.activeText}>EN CLASE AHORA</Text>
      </View>
    </View>
  ), [isDarkMode, isFocused, busqueda, sugerencias, profesoresAgrupados.length, handleSelectSuggestion]);

  return (
    <View style={[styles.screen, !isDarkMode && styles.screenLight]}>
      <Navbar />
      <FlatList
        data={profesoresAgrupados}
        renderItem={renderCard}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          isLoading ? (
            <Text style={[styles.loadingText, !isDarkMode && styles.textLightSecondary]}>
              Cargando registros...
            </Text>
          ) : (
            <Text style={[styles.loadingText, !isDarkMode && styles.textLightSecondary]}>
              No se encontraron resultados.
            </Text>
          )
        }
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  screenLight: { backgroundColor: "transparent" },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  headerWrapper: {
    width: "100%",
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
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 8,
    textAlign: "center",
  },
  titleLight: {
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 6,
    textAlign: "center",
  },
  subtitleLight: {
    color: "#64748b",
  },
  searchWrapper: {
    width: "100%",
    maxWidth: 600,
    position: "relative",
    zIndex: 10000,
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
  dropdownContainer: {
    position: "absolute",
    top: 56,
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
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
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
  loadingText: {
    color: "#71717a",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
  },
  gridColumn: {
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1e1e24",
    padding: 16,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    marginBottom: 16,
  },
  cardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  cardHovered: {
    borderColor: "#a855f7",
  },
  cardHoveredLight: {
    borderColor: "#a855f7",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
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
    fontSize: 15,
  },
  avatarTextLight: {
    color: "#9333ea",
  },
  headerInfo: {
    flex: 1,
  },
  docenteName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  grupoText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#71717a",
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#1e1e24",
    marginBottom: 12,
  },
  dividerLight: {
    backgroundColor: "#f1f5f9",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  infoText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "500",
  },
  aulaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    backgroundColor: "#121215",
    padding: 10,
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
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  textLight: {
    color: "#0f172a",
  },
  textLightSecondary: {
    color: "#64748b",
  },
});

export default Profesores;