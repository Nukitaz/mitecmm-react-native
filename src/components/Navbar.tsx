import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

export const Navbar = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const currentRoute = route.name;

  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
      setTimeStr(now.toLocaleTimeString("es-MX", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const links = [
    { name: "Inicio", screen: "Index" },
    { name: "Mapa", screen: "Mapa" },
    { name: "Profesores", screen: "Profesores" },
  ];

  const canGoBack = navigation.canGoBack() && currentRoute !== "Index";

  return (
    <View style={styles.header}>
      <View style={styles.leftNav}>
        {/* Botón de Volver o Logo */}
        {canGoBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.logoContainer}
            onPress={() => navigation.navigate("Index")}
            activeOpacity={0.7}
          >
            <View style={styles.logoSquare} />
            <Text style={styles.logoText}>MiTecmm</Text>
          </TouchableOpacity>
        )}

        {/* Links de Navegación */}
        <View style={styles.tabsRow}>
          {links.map((link) => {
            const isActive = currentRoute === link.screen;
            return (
              <TouchableOpacity
                key={link.screen}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => navigation.navigate(link.screen)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {link.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Status & Reloj */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          [ DB_STATUS: <Text style={styles.onlineText}>ONLINE</Text> ]
        </Text>
        <Text style={styles.timeText}>
          {dateStr} {timeStr}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0d0d0e",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 50,
  },
  leftNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoSquare: {
    width: 10,
    height: 10,
    backgroundColor: "#a855f7",
    borderRadius: 2,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  backButton: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  backButtonText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#c084fc",
    fontWeight: "bold",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: "rgba(168, 85, 247, 0.18)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#a1a1aa",
  },
  tabTextActive: {
    color: "#c084fc",
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#71717a",
  },
  onlineText: {
    color: "#a855f7",
    fontWeight: "bold",
  },
  timeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#71717a",
  },
});
