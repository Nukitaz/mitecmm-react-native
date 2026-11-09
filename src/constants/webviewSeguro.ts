import type { WebViewProps } from "react-native-webview";

/**
 * Configuración endurecida común para todos los WebView que muestran planos.
 * El contenido siempre es HTML local (source={{ html }}), cargado en about:blank:
 * no debe navegar a ningún otro sitio, abrir ventanas ni leer archivos del dispositivo.
 */
export const PROPS_WEBVIEW_SEGURO: Partial<WebViewProps> = {
  originWhitelist: ["about:blank"],
  onShouldStartLoadWithRequest: (req) => req.url === "about:blank",
  allowFileAccess: false,
  allowFileAccessFromFileURLs: false,
  allowUniversalAccessFromFileURLs: false,
  javaScriptCanOpenWindowsAutomatically: false,
  setSupportMultipleWindows: false,
  mixedContentMode: "never",
  geolocationEnabled: false,
  allowsLinkPreview: false,
};
