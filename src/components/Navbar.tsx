import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  DevSettings,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sun, Moon, RotateCw } from "lucide-react-native";
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
        {/* FILA PRINCIPAL: 3 COLUMNAS QUE ABARCAN EL 100% DE LA PANTALLA */}
        <View style={styles.topRow}>
          {/* EXTREMO IZQUIERDO: LOGO */}
          <View style={styles.leftCol}>
            <TouchableOpacity
              style={styles.logoContainer}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("Index")}
            >
              <View style={styles.logoSquare} />
              <Text style={[styles.logoText, !isDarkMode && styles.logoTextLight]}>
                MiTecmm
              </Text>
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
              <RotateCw
                size={14}
                color={isDarkMode ? "#a1a1aa" : "#64748b"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              activeOpacity={0.8}
              style={[
                styles.themeToggleContainer,
                !isDarkMode && styles.themeToggleContainerLight,
              ]}
            >
              <View
                style={[
                  styles.themeIconBox,
                  !isDarkMode && styles.themeBtnActiveLight,
                ]}
              >
                <Sun size={13} color={!isDarkMode ? "#a855f7" : "#71717a"} />
              </View>

              <View
                style={[
                  styles.themeIconBox,
                  isDarkMode && styles.themeBtnActiveDark,
                ]}
              >
                <Moon size={13} color={isDarkMode ? "#ffffff" : "#71717a"} />
              </View>
            </TouchableOpacity>

            {Platform.OS === "web" && (
              <View style={[styles.clockBadge, !isDarkMode && styles.clockBadgeLight]}>
                <Text style={[styles.clockText, !isDarkMode && styles.clockTextLight]}>
                  {timeString || "13/10/2026 18:30:00"}
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
    paddingHorizontal: 24, // Margen mínimo con el borde de la ventana
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

  /* 3 columnas balanceadas */
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
});

export default Navbar;