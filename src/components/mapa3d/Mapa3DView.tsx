import React, { useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Platform, StyleProp, ViewStyle, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { PROPS_WEBVIEW_SEGURO } from "../../constants/webviewSeguro";
import { esIdSvgValido } from "../../utils/sanitize";
import { KIOSK_HTML_NATIVE, KIOSK_VERSION } from "../../vendor/kioskBundle";

interface Mapa3DViewProps {
  svgXml: string | null | undefined;
  edificioId: string;
  planta: "baja" | "alta";
  selectedRoomId?: string | null;
  isDarkMode: boolean;
  onRoomClick?: (roomId: string) => void;
  /** El 3D no puede mostrarse en este dispositivo/plano: la pantalla debe volver al 2D. */
  onError?: (motivo: MotivoError3D) => void;
  style?: StyleProp<ViewStyle>;
}

export type MotivoError3D = "three" | "webgl" | "sin_aulas" | "construccion" | "contexto" | "tiempo" | "no_disponible";

/** Si el motor no confirma que la escena está lista en este tiempo, se considera fallido. */
const TIEMPO_MAXIMO_3D_MS = 20000;
const MOTIVOS_VALIDOS: MotivoError3D[] = ["three", "webgl", "sin_aulas", "construccion", "contexto"];

/** Página estática del motor 3D servida desde el propio dominio (sin CDN). */
const KIOSK_WEB_URL = `${process.env.EXPO_BASE_URL ?? ""}/vendor/kiosk.html?v=${KIOSK_VERSION}`;

export const Mapa3DView: React.FC<Mapa3DViewProps> = ({
  svgXml,
  edificioId,
  planta,
  selectedRoomId,
  isDarkMode,
  onRoomClick,
  onError,
  style,
}) => {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Valores actuales para responder al saludo del motor sin recrear listeners.
  const actual = useRef({ svgXml, isDarkMode, selectedRoomId, onRoomClick, onError });
  actual.current = { svgXml, isDarkMode, selectedRoomId, onRoomClick, onError };
  const escenaLista = useRef(false);
  const errorReportado = useRef(false);

  const reportarError = useCallback((motivo: MotivoError3D) => {
    if (errorReportado.current) return;
    errorReportado.current = true;
    actual.current.onError?.(motivo);
  }, []);

  /** Envía un mensaje al motor 3D (iframe en web, WebView en móvil). */
  const enviar = useCallback((data: object) => {
    const payload = JSON.stringify(data);
    if (Platform.OS === "web") {
      // El iframe es sandbox (origen opaco): "*" es obligatorio; el motor valida event.source.
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    } else {
      webViewRef.current?.postMessage(payload);
    }
  }, []);

  /** Procesa los mensajes que llegan del motor 3D. */
  const procesarMensaje = useCallback(
    (raw: unknown) => {
      let data: any;
      try {
        data = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;

      if (data.type === "KIOSK_LOADED") {
        const { svgXml: svg, isDarkMode: dark, selectedRoomId: sel } = actual.current;
        if (!svg) return;
        enviar({
          type: "INIT",
          svg,
          isDark: dark,
          selectedId: esIdSvgValido(sel) ? sel : "",
        });
      } else if (data.type === "KIOSK_READY") {
        escenaLista.current = true;
      } else if (data.type === "KIOSK_ERROR") {
        const motivo = MOTIVOS_VALIDOS.includes(data.motivo) ? data.motivo : "construccion";
        reportarError(motivo);
      } else if (data.type === "AULA_CLICK") {
        const id = String(data.id ?? "");
        if (esIdSvgValido(id.toLowerCase())) actual.current.onRoomClick?.(id);
      }
    },
    [enviar, reportarError]
  );

  // Web: solo se aceptan mensajes que provienen del iframe del quiosco.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      procesarMensaje(event.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [procesarMensaje]);

  // Resaltar o quitar el resaltado sin recargar la escena.
  // Si el motor aún no terminó de cargar, el mensaje se ignora y la selección
  // vigente viaja en INIT (se lee de `actual` al recibir KIOSK_LOADED).
  useEffect(() => {
    if (selectedRoomId && esIdSvgValido(selectedRoomId)) {
      enviar({ type: "SELECT_ROOM", id: selectedRoomId });
    } else {
      enviar({ type: "CLEAR_SELECTION" });
    }
  }, [selectedRoomId, enviar]);

  // Tiempo máximo: si el motor no llega a KIOSK_READY (iframe bloqueado, script que no
  // carga, dispositivo muy lento) se informa el error en lugar de un loader infinito.
  const claveEscena = svgXml ? `${edificioId}-${planta}-${isDarkMode ? "d" : "l"}-${svgXml.length}` : "";
  useEffect(() => {
    if (!claveEscena) return;
    escenaLista.current = false;
    errorReportado.current = false;
    if (Platform.OS !== "web" && !KIOSK_HTML_NATIVE) {
      reportarError("no_disponible");
      return;
    }
    const t = setTimeout(() => {
      if (!escenaLista.current) reportarError("tiempo");
    }, TIEMPO_MAXIMO_3D_MS);
    return () => clearTimeout(t);
  }, [claveEscena, reportarError]);

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

  // Cambiar de edificio, planta, plano o tema (claveEscena) reconstruye la escena desde cero.
  const fondo = isDarkMode ? "#08080a" : "#f1f4f8";

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        <iframe
          key={claveEscena}
          ref={iframeRef}
          src={`${KIOSK_WEB_URL}#${isDarkMode ? "dark" : "light"}`}
          title="Mapa 3D del edificio"
          // Sin allow-same-origin: el motor no puede acceder al origen de la app.
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", border: "none", backgroundColor: fondo }}
        />
      </View>
    );
  }

  if (!KIOSK_HTML_NATIVE) return null;

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={claveEscena}
        ref={webViewRef}
        {...PROPS_WEBVIEW_SEGURO}
        source={{ html: KIOSK_HTML_NATIVE.replace("<body>", `<body class="${isDarkMode ? "dark" : "light"}">`) }}
        style={[styles.webview, { backgroundColor: fondo }]}
        onMessage={(event) => procesarMensaje(event.nativeEvent.data)}
        javaScriptEnabled={true}
        domStorageEnabled={false}
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
