import React, { forwardRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { getInjectedJavaScript } from "../../constants/scriptInject";

interface MapaWebViewProps {
  svgBaja: string | null | undefined;
  svgAlta?: string | null | undefined;
  planta?: "baja" | "alta";
  targetSvgId: string | null;
  onAulaClick: (id: string) => void;
  isDarkMode: boolean;
}

export const MapaWebView = forwardRef<WebView, MapaWebViewProps>(
  ({ svgBaja, svgAlta, planta = "baja", targetSvgId, onAulaClick, isDarkMode }, ref) => {
    if (!svgBaja) return null;

    const bgColor = isDarkMode ? "#08080a" : "#f8fafc";
    const textColor = isDarkMode ? "#ffffff" : "#0f172a";

    // CSS Unificado para resaltado en Web y Móvil
    const svgCustomStyle = `
      <style>
        html, body, div, svg {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        svg {
          border: 0 !important;
        }
        svg > rect:first-child[width="100%"],
        svg > rect:first-child[width="100%"][height="100%"] {
          stroke: transparent !important;
        }
        text, tspan {
          fill: ${textColor} !important;
          color: ${textColor} !important;
        }
        .resaltado-activo {
          display: inline !important;
          fill: rgba(168, 85, 247, 0.55) !important;
          stroke: #ffffff !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0px 0px 14px #a855f7) !important;
          animation: parpadeoSalon 1s infinite alternate !important;
        }
        .resaltado-activo text,
        .resaltado-activo tspan {
          fill: #ffffff !important;
          color: #ffffff !important;
          stroke: #000000 !important;
          stroke-width: 0.6px !important;
          font-weight: 900 !important;
          filter: drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.9)) !important;
        }
        @keyframes parpadeoSalon {
          0% { fill-opacity: 0.4; stroke-opacity: 0.6; }
          100% { fill-opacity: 0.85; stroke-opacity: 1; }
        }
      </style>
    `;

    const prepareSvg = (xml?: string | null) => {
      if (!xml) return "";
      return xml.replace(/<svg([^>]*)>/, `<svg$1>${svgCustomStyle}`);
    };

    const formattedBaja = prepareSvg(svgBaja);
    const formattedAlta = prepareSvg(svgAlta);

    if (Platform.OS === "web") {
      return (
        <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: bgColor, border: "none" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: planta === "alta" ? 0.2 : 1,
              transition: "opacity 0.35s ease",
              border: "none",
            }}
            dangerouslySetInnerHTML={{
              __html:
                planta === "baja" && targetSvgId
                  ? formattedBaja.replace(
                      new RegExp(`id="${targetSvgId}"`, "gi"),
                      `id="${targetSvgId}" class="resaltado-activo"`
                    )
                  : formattedBaja,
            }}
          />
          {formattedAlta && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: planta === "alta" ? 1 : 0,
                pointerEvents: planta === "alta" ? "auto" : "none",
                transition: "opacity 0.35s ease, transform 0.35s ease",
                transform: planta === "alta" ? "translateY(0)" : "translateY(12px)",
                border: "none",
              }}
              dangerouslySetInnerHTML={{
                __html:
                  planta === "alta" && targetSvgId
                    ? formattedAlta.replace(
                        new RegExp(`id="${targetSvgId}"`, "gi"),
                        `id="${targetSvgId}" class="resaltado-activo"`
                      )
                    : formattedAlta,
              }}
            />
          )}
        </div>
      );
    }

    return (
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes">
                <style>
                  * {
                    -webkit-tap-highlight-color: transparent;
                    border: none !important;
                    outline: none !important;
                  }
                  body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    background-color: ${bgColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: auto;
                    touch-action: manipulation;
                  }
                  .container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  }
                  .layer {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transition: opacity 0.35s ease, transform 0.35s ease;
                  }
                  .layer-baja {
                    opacity: ${planta === "alta" ? "0.2" : "1"};
                    z-index: 1;
                  }
                  .layer-alta {
                    opacity: ${planta === "alta" ? "1" : "0"};
                    pointer-events: ${planta === "alta" ? "auto" : "none"};
                    transform: ${planta === "alta" ? "translateY(0)" : "translateY(12px)"};
                    z-index: 2;
                  }
                  svg {
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    border: none !important;
                  }
                  text, tspan {
                    fill: ${textColor} !important;
                    color: ${textColor} !important;
                  }
                  .resaltado-activo {
                    display: inline !important;
                    fill: rgba(168, 85, 247, 0.55) !important;
                    stroke: #ffffff !important;
                    stroke-width: 3px !important;
                    filter: drop-shadow(0px 0px 14px #a855f7) !important;
                    animation: parpadeoSalon 1s infinite alternate !important;
                  }
                  .resaltado-activo text,
                  .resaltado-activo tspan {
                    fill: #ffffff !important;
                    color: #ffffff !important;
                    stroke: #000000 !important;
                    stroke-width: 0.6px !important;
                    font-weight: 900 !important;
                    filter: drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.9)) !important;
                  }
                  @keyframes parpadeoSalon {
                    0% { fill-opacity: 0.4; stroke-opacity: 0.6; }
                    100% { fill-opacity: 0.85; stroke-opacity: 1; }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="layer layer-baja">${formattedBaja || ""}</div>
                  ${formattedAlta ? `<div class="layer layer-alta">${formattedAlta}</div>` : ""}
                </div>
                <script>
                  ${getInjectedJavaScript(targetSvgId)}
                </script>
              </body>
            </html>
          `,
        }}
        style={{ flex: 1, backgroundColor: bgColor }}
        containerStyle={{ backgroundColor: bgColor }}
        scrollEnabled={true}
        scalesPageToFit={true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "AULA_CLICK" && data.id) {
              onAulaClick(data.id);
            }
          } catch (e) {
            console.error("Error WebView:", e);
          }
        }}
      />
    );
  }
);