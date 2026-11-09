import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  DevSettings,
  useWindowDimensions,
  Modal,
  Pressable
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { 
  Sun, 
  Moon, 
  RotateCw, 
  ChevronDown, 
  X, 
  ShieldCheck, 
  MessageSquare, 
  Code, 
  Users
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { StatusBar } from "expo-status-bar";

export const Navbar = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { isDarkMode, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();

  // Detecta pantalla de escritorio
  const isDesktop = width >= 768;

  const [timeString, setTimeString] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Estado del menú lateral

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("es-MX", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setTimeString(`${dateStr} ${timeStr}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleReload = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    } else {
      if (DevSettings && typeof DevSettings.reload === "function") {
        DevSettings.reload();
      } else {
        navigation.replace(route.name, route.params);
      }
    }
  };

  const isActive = (screenName: string) => route.name === screenName;

  const renderNavLinks = () => (
    <>
      <TouchableOpacity
        style={[
          styles.navBtn,
          isActive("Index") &&
            (isDarkMode ? styles.navBtnActiveDark : styles.navBtnActiveLight),
        ]}
        onPress={() => navigation.navigate("Index")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.navBtnText,
            !isDarkMode && styles.navBtnTextLight,
            isActive("Index") &&
              (isDarkMode ? styles.navBtnTextActiveDark : styles.navBtnTextActiveLight),
          ]}
        >
          Inicio
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.navBtn,
          (isActive("Mapa") || isActive("Edificio")) &&
            (isDarkMode ? styles.navBtnActiveDark : styles.navBtnActiveLight),
        ]}
        onPress={() => navigation.navigate("Mapa")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.navBtnText,
            !isDarkMode && styles.navBtnTextLight,
            (isActive("Mapa") || isActive("Edificio")) &&
              (isDarkMode ? styles.navBtnTextActiveDark : styles.navBtnTextActiveLight),
          ]}
        >
          Mapa
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.navBtn,
          isActive("Profesores") &&
            (isDarkMode ? styles.navBtnActiveDark : styles.navBtnActiveLight),
        ]}
        onPress={() => navigation.navigate("Profesores")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.navBtnText,
            !isDarkMode && styles.navBtnTextLight,
            isActive("Profesores") &&
              (isDarkMode ? styles.navBtnTextActiveDark : styles.navBtnTextActiveLight),
          ]}
        >
          Profesores
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, !isDarkMode && styles.safeAreaLight]}
      >
        <StatusBar style={isDarkMode ? "light" : "dark"} />

        <View
          style={[
            styles.navContainer,
            !isDarkMode && styles.navContainerLight,
            isDesktop && styles.navContainerDesktop,
          ]}
        >
          {/* FILA PRINCIPAL */}
          <View style={styles.topRow}>
            {/* EXTREMO IZQUIERDO: LOGO (AHORA BOTÓN DE MENÚ) */}
            <View style={styles.leftCol}>
              <TouchableOpacity
                style={styles.logoContainer}
                activeOpacity={0.7}
                onPress={() => setIsMenuOpen(true)}
              >
                <View style={styles.logoSquare} />
                <Text style={[styles.logoText, !isDarkMode && styles.logoTextLight]}>
                  MiTecmm
                </Text>
                <ChevronDown size={16} color={isDarkMode ? "#a855f7" : "#71717a"} />
              </TouchableOpacity>
            </View>

            {/* CENTRO: ENLACES */}
            {isDesktop && (
              <View style={styles.centerCol}>
                <View style={styles.linksRowDesktop}>{renderNavLinks()}</View>
              </View>
            )}

            {/* EXTREMO DERECHO: CONTROLES */}
            <View style={styles.rightCol}>
              <TouchableOpacity
                style={[styles.refreshBtn, !isDarkMode && styles.refreshBtnLight]}
                onPress={handleReload}
                activeOpacity={0.7}
              >
                <RotateCw size={14} color={isDarkMode ? "#a1a1aa" : "#64748b"} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggleTheme}
                activeOpacity={0.8}
                style={[
                  styles.themeToggleContainer,
                  !isDarkMode && styles.themeToggleContainerLight,
                ]}
              >
                <View style={[styles.themeIconBox, !isDarkMode && styles.themeBtnActiveLight]}>
                  <Sun size={13} color={!isDarkMode ? "#a855f7" : "#71717a"} />
                </View>

                <View style={[styles.themeIconBox, isDarkMode && styles.themeBtnActiveDark]}>
                  <Moon size={13} color={isDarkMode ? "#ffffff" : "#71717a"} />
                </View>
              </TouchableOpacity>

              {Platform.OS === "web" && (
                <View style={[styles.clockBadge, !isDarkMode && styles.clockBadgeLight]}>
                  <Text style={[styles.clockText, !isDarkMode && styles.clockTextLight]}>
                    {timeString || "Cargando..."}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* NAVEGACIÓN EN SEGUNDA FILA (SOLO MÓVIL) */}
          {!isDesktop && (
            <View style={styles.linksRowMobile}>{renderNavLinks()}</View>
          )}
        </View>
      </SafeAreaView>

      {/* MENÚ LATERAL (MODAL) */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Fondo oscuro para cerrar al hacer clic afuera */}
          <Pressable style={styles.modalBackdrop} onPress={() => setIsMenuOpen(false)} />
          
          {/* Panel Lateral */}
          <View style={[styles.sidebar, !isDarkMode && styles.sidebarLight]}>
            <View style={styles.sidebarHeader}>
              <View style={styles.logoContainer}>
                <View style={styles.logoSquare} />
                <Text style={[styles.logoText, !isDarkMode && styles.logoTextLight]}>
                  MiTecmm
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)} style={styles.closeBtn}>
                <X size={20} color={isDarkMode ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarContent}>
              <Text style={[styles.sidebarSectionTitle, !isDarkMode && styles.sidebarSectionTitleLight]}>
                OPCIONES
              </Text>

              {/* Botón de Administración */}
              <TouchableOpacity 
                style={[styles.sidebarBtn, !isDarkMode && styles.sidebarBtnLight]}
                onPress={() => {
                  setIsMenuOpen(false);
                  navigation.navigate("AdminAuth"); // Enlace activado
                }}
              >
                <ShieldCheck size={20} color={isDarkMode ? "#c084fc" : "#a855f7"} />
                <Text style={[styles.sidebarBtnText, !isDarkMode && styles.sidebarBtnTextLight]}>
                  Acceso Administrativo
                </Text>
              </TouchableOpacity>

              {/* Botón de Sugerencias */}
              <TouchableOpacity 
                style={[styles.sidebarBtn, !isDarkMode && styles.sidebarBtnLight]}
                onPress={() => {
                  setIsMenuOpen(false);
                  navigation.navigate("Sugerencias"); // Enlace activado
                }}
              >
                <MessageSquare size={20} color={isDarkMode ? "#c084fc" : "#a855f7"} />
                <Text style={[styles.sidebarBtnText, !isDarkMode && styles.sidebarBtnTextLight]}>
                  Buzón de Sugerencias
                </Text>
              </TouchableOpacity>

            </View>

            {/* Boton desarroladores */}
            <TouchableOpacity
            style={[styles.sidebarBtn, !isDarkMode && styles.sidebarBtnLight]}
                onPress={() => {
                  setIsMenuOpen(false);
                  navigation.navigate("Desarrolladores");
                }}
              >
                <Users size={20} color={isDarkMode ? "#c084fc" : "#a855f7"} />
                <Text style={[styles.sidebarBtnText, !isDarkMode && styles.sidebarBtnTextLight]}>
                  Desarrolladores
                </Text>
              </TouchableOpacity>
          

            {/* Footer de Créditos */}
            <View style={styles.sidebarFooter}>
              <View style={styles.creditsContainer}>
                <Code size={16} color={isDarkMode ? "#64748b" : "#94a3b8"} />
                <Text style={[styles.creditsText, !isDarkMode && styles.creditsTextLight]}>
                  Desarrollado por alumnos del TecMM.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#08080a",
    borderBottomWidth: 1,
    borderBottomColor: "#18181c",
    zIndex: 1000,
    width: "100%",
  },
  safeAreaLight: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#e2e8f0",
  },
  navContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navContainerDesktop: {
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  navContainerLight: {
    backgroundColor: "#ffffff",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  leftCol: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  centerCol: {
    flexShrink: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  rightCol: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  logoSquare: {
    width: 12,
    height: 12,
    backgroundColor: "#a855f7",
    borderRadius: 2,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  logoTextLight: {
    color: "#0f172a",
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#0d0d10",
    borderWidth: 1,
    borderColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtnLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  themeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d10",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    padding: 2,
    gap: 2,
  },
  themeToggleContainerLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  themeIconBox: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 3,
  },
  themeBtnActiveDark: {
    backgroundColor: "#2a1745",
  },
  themeBtnActiveLight: {
    backgroundColor: "#ffffff",
  },
  clockBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#0d0d10",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  clockBadgeLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  clockText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#ffffff",
  },
  clockTextLight: {
    color: "#0f172a",
  },
  linksRowDesktop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linksRowMobile: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingTop: 4,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  navBtnActiveDark: {
    backgroundColor: "#1e112a",
  },
  navBtnActiveLight: {
    backgroundColor: "#f1f5f9",
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94a3b8",
  },
  navBtnTextLight: {
    color: "#64748b",
  },
  navBtnTextActiveDark: {
    color: "#c084fc",
    fontWeight: "bold",
  },
  navBtnTextActiveLight: {
    color: "#a855f7",
    fontWeight: "bold",
  },

  /* ESTILOS DEL MENÚ LATERAL */
  modalOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  modalBackdrop: {position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  sidebar: {
    width: 280,
    maxWidth: "80%",
    height: "100%",
    backgroundColor: "#08080a",
    borderRightWidth: 1,
    borderRightColor: "#18181c",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sidebarLight: {
    backgroundColor: "#ffffff",
    borderRightColor: "#e2e8f0",
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  closeBtn: {
    padding: 4,
  },
  sidebarContent: {
    flex: 1,
    gap: 12,
  },
  sidebarSectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  sidebarSectionTitleLight: {
    color: "#94a3b8",
  },
  sidebarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#121217",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  sidebarBtnLight: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  sidebarBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  sidebarBtnTextLight: {
    color: "#1e293b",
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: "#18181c",
    paddingTop: 20,
    marginTop: "auto",
  },
  creditsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    opacity: 0.8,
  },
  creditsText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
    lineHeight: 18,
  },
  creditsTextLight: {
    color: "#94a3b8",
  },
});

export default Navbar;