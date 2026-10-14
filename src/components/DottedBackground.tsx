import React from "react";
import {
  View,
  StyleSheet,
  Platform,
  ViewStyle,
  StyleProp,
} from "react-native";
import Svg, { Defs, Pattern, Rect, Circle } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

interface DottedBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const DottedBackground: React.FC<DottedBackgroundProps> = ({
  children,
  style,
}) => {
  const { isDarkMode } = useTheme();

  const backgroundColor = isDarkMode ? "#08080a" : "#f8fafc";
  const dotColor = isDarkMode
    ? "rgba(255, 255, 255, 0.18)" // Visible y nítido en modo oscuro
    : "rgba(0, 0, 0, 0.14)";       // Visible y nítido en modo claro

  // Versión Web (máximo rendimiento con CSS radial-gradient)
  if (Platform.OS === "web") {
    const webBackgroundStyle = {
      backgroundColor,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
      backgroundSize: "28px 28px",
      backgroundPosition: "center center",
    };

    return (
      <View style={[styles.container, webBackgroundStyle as any, style]}>
        {children}
      </View>
    );
  }

  // Versión Android / iOS (Mosaico SVG vectorial nativo sin dependencias de archivos)
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <Svg style={styles.svgOverlay} width="100%" height="100%">
        <Defs>
          <Pattern
            id="dotGridPattern"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <Circle cx="14" cy="14" r="1.2" fill={dotColor} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dotGridPattern)" />
      </Svg>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  svgOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default DottedBackground;