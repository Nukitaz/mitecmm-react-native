import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
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

  // Función para recargar la página en Web
  const handleReload = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const isActive = (screenName: string) => route.name === screenName;

  return (
    <View style={[styles.navContainer, !isDarkMode && styles.navContainerLight]}>
      {/* 1. LOGO */}
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

      {/* 2. NAVEGACIÓN CENTRADA */}
      <View style={styles.centerNav}>
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

      {/* 3. TOGGLE TEMA + STATUS + BOTÓN REINICIAR PÁGINA */}
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

        <View style={styles.statusBadge}>
          <Text style={[styles.statusLabel, !isDarkMode && styles.textLightSecondary]}>
            [ DB_STATUS: <Text style={styles.statusOnline}>ONLINE</Text> ]
          </Text>
        </View>

        {/* BOTÓN DE REINICIAR PÁGINA */}
        <TouchableOpacity
          style={[styles.clockBadge, !isDarkMode && styles.clockBadgeLight]}
          onPress={handleReload}
          activeOpacity={0.7}
        >
          <Text style={[styles.clockText, !isDarkMode && styles.clockTextLight]}>
            {timeString || "09/10/2026 22:31:31"}
          </Text>
          <RotateCw
            size={12}
            color={isDarkMode ? "#a1a1aa" : "#64748b"}
            style={styles.refreshIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    width: "100%",
    height: 60,
    backgroundColor: "#08080a",
    borderBottomWidth: 1,
    borderBottomColor: "#18181c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    zIndex: 1000,
    position: "relative",
  },
  navContainerLight: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#e2e8f0",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
    paddingVertical: 8,
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },
  logoSquare: {
    width: 12,
    height: 12,
    backgroundColor: "#a855f7",
    borderRadius: 2,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  logoTextLight: {
    color: "#0f172a",
  },
  centerNav: {
    position: "absolute",
    left: "50%",
    ...(Platform.OS === "web"
      ? { transform: "translateX(-50%)" as any }
      : { transform: [{ translateX: -100 }] }),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    zIndex: 5,
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },
  navBtnActiveDark: {
    backgroundColor: "#1e112a",
  },
  navBtnActiveLight: {
    backgroundColor: "#f1f5f9",
  },
  navBtnText: {
    fontSize: 14,
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
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 10,
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
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 3,
  },
  themeBtnActiveDark: {
    backgroundColor: "#2a1745",
  },
  themeBtnActiveLight: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusBadge: {
    paddingHorizontal: 4,
  },
  statusLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
  },
  textLightSecondary: {
    color: "#64748b",
  },
  statusOnline: {
    color: "#a855f7",
    fontWeight: "bold",
  },
  clockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#0d0d10",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },
  clockBadgeLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  clockText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#ffffff",
  },
  clockTextLight: {
    color: "#0f172a",
  },
  refreshIcon: {
    marginLeft: 2,
  },
});

export default Navbar;