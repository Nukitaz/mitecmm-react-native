import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";

interface ModuleCardProps {
  onPress: () => void;
  code: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isDarkMode: boolean;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  onPress,
  code,
  title,
  description,
  icon,
  isDarkMode,
}) => (
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
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 20,
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
  textLightSecondary: {
    color: "#64748b",
  },
});