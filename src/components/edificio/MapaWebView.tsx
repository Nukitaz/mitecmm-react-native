import React, { forwardRef, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { getInjectedJavaScript } from "../../constants/scriptInject";
import { esIdSvgValido } from "../../utils/sanitize";
import { PROPS_WEBVIEW_SEGURO } from "../../constants/webviewSeguro";
import { log } from "../../utils/log";

interface MapaWebViewProps {
  svgBaja: string | null | undefined;
  svgAlta?: string | null | undefined;
  planta?: "baja" | "alta";
  targetSvgId: string | null;
  onAulaClick: (id: string) => void;
  isDarkMode: boolean;
}

// Nota: react-native-webview 14 declara `WebView<P = undefined>` con props `WebViewProps & P`;
// con P = undefined el tipo se reduce a never en TS 6, por eso se usa WebView<object>.
export const MapaWebView = forwardRef<WebView<object>, MapaWebViewProps>(
  function MapaWebView({ svgBaja, svgAlta, planta = "baja", targetSvgId, onAulaClick, isDarkMode }, ref) {
    const capaBajaRef = useRef<HTMLDivElement | null>(null);
    const capaAltaRef = useRef<HTMLDivElement | null>(null);

    const [personasCount, setPersonasCount] = React.useState<number>(0);

  React.useEffect(() => {
    let isMounted = true;

    const fetchConteo = async () => {
      try {
        const supabaseUrl = 'https://vwgbhkjticwbhmajxtzc.supabase.co/rest/v1/conteo_personas?id=eq.1&select=*';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z2Joa2p0aWN3YmhtYWp4dHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU2MDQsImV4cCI6MjA4ODczMTYwNH0.RNnZ6dk7hQVKrlJwq71xs0gKdwoGBGh2HY0CSIAEXZY';

        const response = await fetch(supabaseUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        console.log("Respuesta Supabase:", response.status, data);

        if (isMounted && Array.isArray(data) && data.length > 0) {
          const valor = data[0].personas_actuales ?? data[0].cantidad ?? data[0].personas ?? 0;
          setPersonasCount(valor);
        }
      } catch (err) {
        console.error("Error al consultar Supabase:", err);
      }
    };

    fetchConteo();
    const interval = setInterval(fetchConteo, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

    // Web: el resaltado se aplica sobre el DOM ya renderizado (classList),
    // nunca reescribiendo el HTML con texto que viene de la URL.
    useEffect(() => {
      if (Platform.OS !== "web") return;
      const capas = [capaBajaRef.current, capaAltaRef.current];
      capas.forEach((capa) =>
        capa
          ?.querySelectorAll(".resaltado-activo")
          .forEach((el) => el.classList.remove("resaltado-activo"))
      );
      if (!esIdSvgValido(targetSvgId)) return;
      const capaActiva = planta === "alta" ? capaAltaRef.current : capaBajaRef.current;
      capaActiva?.querySelectorAll("[id]").forEach((el) => {
        if (el.id.toLowerCase() === targetSvgId) el.classList.add("resaltado-activo");
      });
    }, [targetSvgId, planta, svgBaja, svgAlta, isDarkMode]);

    if (!svgBaja && !svgAlta) return null;

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

  let modifiedXml = xml.replace(/<svg([^>]*)>/, `<svg$1>${svgCustomStyle}`);

  const targetAulaId = "sala_de_docentes";
  const rectRegex = new RegExp(`(<rect[^>]*id="${targetAulaId}"[^>]*\\/?>)`, "i");
  const rectMatch = modifiedXml.match(rectRegex);

  if (rectMatch) {
    const rectTag = rectMatch[1];

    const getAttr = (name: string) => {
      const match = rectTag.match(new RegExp(`${name}="([0-9.-]+)"`, "i"));
      return match ? parseFloat(match[1]) : 0;
    };

    const x = getAttr("x");
    const y = getAttr("y");
    const w = getAttr("width");
    const h = getAttr("height");

    if (w > 0 && h > 0) {
      const centerX = x + w / 2;
      const centerY = y + h * 0.72;

      const boxW = w * 0.72;
      const boxH = h * 0.14;
      const fontSize = Math.round(boxH * 0.42);

      const dynamicTextSvg = `
        ${rectTag}
        <g id="contador_en_vivo" style="pointer-events: none;">
          <rect x="${centerX - boxW / 2}" y="${centerY - boxH / 2}" width="${boxW}" height="${boxH}" rx="20" fill="#121118" fill-opacity="0.9" stroke="#a855f7" stroke-width="8" />
          <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="${fontSize}" font-weight="bold" style="font-family: monospace;">
            Personas: ${personasCount}
          </text>
        </g>
      `;

      modifiedXml = modifiedXml.replace(rectTag, dynamicTextSvg);
    }
  }

  return modifiedXml;
};

    const formattedBaja = prepareSvg(svgBaja);
    const formattedAlta = prepareSvg(svgAlta);

    if (Platform.OS === "web") {
      return (
        <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: bgColor, border: "none" }}>
          <div
            ref={capaBajaRef}
            style={{
              position: "absolute",
              inset: 0,
              opacity: planta === "alta" ? 0.2 : 1,
              transition: "opacity 0.35s ease",
              border: "none",
            }}
            dangerouslySetInnerHTML={{ __html: formattedBaja }}
          />
          {formattedAlta && (
            <div
              ref={capaAltaRef}
              style={{
                position: "absolute",
                inset: 0,
                opacity: planta === "alta" ? 1 : 0,
                pointerEvents: planta === "alta" ? "auto" : "none",
                transition: "opacity 0.35s ease, transform 0.35s ease",
                transform: planta === "alta" ? "translateY(0)" : "translateY(12px)",
                border: "none",
              }}
              dangerouslySetInnerHTML={{ __html: formattedAlta }}
            />
          )}
        </div>
      );
    }

    return (
      <WebView
        ref={ref}
        {...PROPS_WEBVIEW_SEGURO}
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
        onMessage={(event: WebViewMessageEvent) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === "AULA_CLICK" && typeof data.id === "string" && data.id.length <= 120) {
              onAulaClick(data.id);
            }
          } catch (e) {
            log.error("Error WebView:", e);
          }
        }}
      />
    );
  }
);