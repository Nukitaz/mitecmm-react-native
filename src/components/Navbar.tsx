import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sun, Moon, RotateCw } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

export const Navbar = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { isDarkMode, toggleTheme } = useTheme();

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
    }
  };

  const isActive = (screenName: string) => route.name === screenName;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, !isDarkMode && styles.safeAreaLight]}
    >
      <View style={[styles.navContainer, !isDarkMode && styles.navContainerLight]}>
        {/* FILA PRINCIPAL: LOGO + CONTROLES */}
        <View style={styles.topRow}>
          {/* LOGO */}
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

          {/* CONTROLES (TEMA Y RELOJ SOLO EN WEB) */}
          <View style={styles.rightSection}>
            <View
              style={[
                styles.themeToggleContainer,
                !isDarkMode && styles.themeToggleContainerLight,
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.themeBtn,
                  !isDarkMode && styles.themeBtnActiveLight,
                ]}
                onPress={() => isDarkMode && toggleTheme()}
                activeOpacity={0.7}
              >
                <Sun size={13} color={!isDarkMode ? "#a855f7" : "#71717a"} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeBtn,
                  isDarkMode && styles.themeBtnActiveDark,
                ]}
                onPress={() => !isDarkMode && toggleTheme()}
                activeOpacity={0.7}
              >
                <Moon size={13} color={isDarkMode ? "#ffffff" : "#71717a"} />
              </TouchableOpacity>
            </View>

            {/* RELOJ / REINICIAR (SOLO WEB PARA NO SATURAR EL CELULAR) */}
            {Platform.OS === "web" && (
              <TouchableOpacity
                style={[styles.clockBadge, !isDarkMode && styles.clockBadgeLight]}
                onPress={handleReload}
                activeOpacity={0.7}
              >
                <Text style={[styles.clockText, !isDarkMode && styles.clockTextLight]}>
                  {timeString || "09/10/2026 23:35:47"}
                </Text>
                <RotateCw
                  size={12}
                  color={isDarkMode ? "#a1a1aa" : "#64748b"}
                  style={styles.refreshIcon}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* NAVEGACIÓN EN SEGUNDA FILA O ENLACES CENTRADOS */}
        <View style={styles.linksRow}>
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
        </View>
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
  navContainerLight: {
    backgroundColor: "#ffffff",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
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
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  themeBtn: {
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
    gap: 6,
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
  refreshIcon: {
    marginLeft: 2,
  },
  linksRow: {
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