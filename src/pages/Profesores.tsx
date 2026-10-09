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
import { Search, Book, Calendar, Clock, MapPin } from "lucide-react-native";
import { Navbar } from "../components/Navbar";
import { obtenerProfesores, HorarioDocente } from "../services/profesoresService";

// Componente individual para manejar el hover de cada tarjeta independientemente
const ProfesorCard = ({ prof }: { prof: HorarioDocente }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Obtener iniciales del nombre
  const initials = prof.docente
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <View
      style={[styles.card, isHovered && styles.cardHovered]}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.docenteName}>{prof.docente}</Text>
          <Text style={styles.grupoText}>
            GRUPO {prof.grupo ? prof.grupo : "N/A"}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Book size={16} color="#71717a" />
        <Text style={styles.infoText}>{prof.materia}</Text>
      </View>

      <View style={styles.infoRow}>
        <Calendar size={16} color="#71717a" />
        <Text style={styles.infoText}>{prof.dia}</Text>
      </View>

      <View style={styles.infoRow}>
        <Clock size={16} color="#71717a" />
        <Text style={styles.infoText}>
          {prof.hora_inicio} → {prof.hora_fin}
        </Text>
      </View>

      <View style={styles.aulaContainer}>
        <MapPin size={14} color="#a855f7" />
        <Text style={styles.aulaText}>AULA {prof.aula}</Text>
      </View>
    </View>
  );
};

const Profesores = ({ route }: any) => {
  const queryInicial = route?.params?.q || "";
  const [busqueda, setBusqueda] = useState(queryInicial);
  const [profesores, setProfesores] = useState<HorarioDocente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  };

  return (
    <View style={styles.screen}>
      <Navbar />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.main}>
          <View style={styles.headerSection}>
            <Text style={styles.modCode}>[ MOD_02 · DOCENT_LOCATOR ]</Text>
            <Text style={styles.title}>Búsqueda de Profesores</Text>
            <Text style={styles.subtitle}>
              Encuentra docentes, materias y horarios en tiempo real.
            </Text>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#a1a1aa" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Busca salón, profesor o materia..."
              placeholderTextColor="#71717a"
              value={busqueda}
              onChangeText={setBusqueda}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>
              {profesores.length} RESULTADOS
            </Text>
            <View style={styles.dot} />
            <Text style={styles.activeText}>EN CLASE AHORA</Text>
          </View>

          <View style={styles.grid}>
            {isLoading ? (
              <Text style={styles.loadingText}>Buscando registros...</Text>
            ) : profesores.length > 0 ? (
              profesores.map((prof) => (
                <ProfesorCard key={prof.id} prof={prof} />
              ))
            ) : (
              <Text style={styles.loadingText}>No se encontraron resultados.</Text>
            )}
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
  headerSection: { alignItems: "center", marginBottom: 32 },
  modCode: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11, color: "#71717a", letterSpacing: 2 },
  title: { fontSize: 42, fontWeight: "900", color: "#ffffff", marginTop: 8 },
  subtitle: { fontSize: 15, color: "#a1a1aa", marginTop: 8 },
  
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    paddingHorizontal: 16,
    marginBottom: 20,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, paddingVertical: 14, color: "#ffffff", fontSize: 16 },
  
  resultsHeader: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 32 },
  resultsText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11, color: "#71717a", letterSpacing: 1.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#a855f7" },
  activeText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11, color: "#a855f7", fontWeight: "bold", letterSpacing: 1.5 },
  
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20, justifyContent: "center" },
  loadingText: { color: "#71717a", fontSize: 14, marginTop: 20, textAlign: "center" },
  
  // Estilos individuales de la tarjeta del Profesor
  card: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1e1e24",
    padding: 20,
    width: "100%",
    maxWidth: 400,
    ...Platform.select({
      web: { transitionDuration: "0.25s", transitionProperty: "border-color, box-shadow" } as any,
    }),
  },
  // EFECTO LED AL PASAR EL CURSOR EN LA TARJETA
  cardHovered: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  avatar: { width: 45, height: 45, backgroundColor: "#1c142c", borderRadius: 4, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#c084fc", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  headerInfo: { flex: 1 },
  docenteName: { color: "#ffffff", fontSize: 16, fontWeight: "900", textTransform: "uppercase" },
  grupoText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", color: "#71717a", fontSize: 10, marginTop: 4, letterSpacing: 1.5 },
  divider: { height: 1, backgroundColor: "#1e1e24", marginBottom: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  infoText: { color: "#e4e4e7", fontSize: 14, fontWeight: "500" },
  aulaContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: "#121215", padding: 12, borderRadius: 4, borderWidth: 1, borderColor: "#1e1e24" },
  aulaText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", color: "#e4e4e7", fontSize: 12, fontWeight: "bold", letterSpacing: 1 },
});

export default Profesores;
