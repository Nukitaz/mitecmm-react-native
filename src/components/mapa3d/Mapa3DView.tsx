import React, { useMemo, useRef, useEffect } from "react";
import { View, StyleSheet, Platform, StyleProp, ViewStyle, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { generateKioskHtml } from "./kioskEngine";

interface Mapa3DViewProps {
  svgXml: string | null | undefined;
  edificioId: string;
  planta: "baja" | "alta";
  selectedRoomId?: string | null;
  isDarkMode: boolean;
  onRoomClick?: (roomId: string) => void;
  style?: StyleProp<ViewStyle>;
}

export const Mapa3DView: React.FC<Mapa3DViewProps> = ({
  svgXml,
  edificioId,
  planta,
  selectedRoomId,
  isDarkMode,
  onRoomClick,
  style,
}) => {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);

  // El HTML del quiosco solo se regenera si cambia el plano SVG o el tema (Dark/Light).
  // NO depende de selectedRoomId para evitar recargar el iframe / WebGL al seleccionar aulas.
  const htmlContent = useMemo(() => {
    if (!svgXml) return "";
    return generateKioskHtml({
      svgContent: svgXml,
      isDarkMode,
      selectedRoomId,
    });
  }, [svgXml, isDarkMode]);

  // Comunicación fluida para resaltar sin recargas: envía mensaje al iframe o WebView
  useEffect(() => {
    if (!selectedRoomId) return;

    const payload = JSON.stringify({ type: "SELECT_ROOM", id: selectedRoomId });

    if (Platform.OS === "web") {
      try {
        iframeRef.current?.contentWindow?.postMessage(payload, "*");
      } catch {
        // En caso de que el iframe aún no esté listo
      }
    } else {
      try {
        webViewRef.current?.postMessage(payload);
      } catch {
        // En caso de que el webview aún no esté listo
      }
    }
  }, [selectedRoomId]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent?.data || event.data);
      if (data.type === "AULA_CLICK" && data.id && onRoomClick) {
        onRoomClick(data.id);
      }
    } catch {
      // Ignorar mensajes no formateados en JSON
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleWebMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "AULA_CLICK" && data.id && onRoomClick) {
          onRoomClick(data.id);
        }
      } catch {
        // Ignorar mensajes no compatibles
      }
    };

    window.addEventListener("message", handleWebMessage);
    return () => window.removeEventListener("message", handleWebMessage);
  }, [onRoomClick]);

  if (!svgXml) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.loadingText, { color: isDarkMode ? "#94a3b8" : "#64748b" }]}>
          Cargando plano arquitectónico...
        </Text>
      </View>
    );
  }

  // Render para Web (usando iframe con srcDoc para aislamiento y máxima aceleración WebGL)
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: isDarkMode ? "#08080a" : "#f1f4f8",
          }}
        />
      </View>
    );
  }

  // Render para Móvil (Android / iOS con WebView)
  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={[
          styles.webview,
          { backgroundColor: isDarkMode ? "#08080a" : "#f1f4f8" },
        ]}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        scalesPageToFit={false}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
