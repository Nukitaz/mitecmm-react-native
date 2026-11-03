import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Navbar } from "../components/Navbar";
import { EdificioHeader } from "../components/edificio/EdificioHeader";
import { FloorSelector } from "../components/edificio/FloorSelector";
import { MapaWebView } from "../components/edificio/MapaWebView";
import { Mapa3DView, MotivoError3D } from "../components/mapa3d/Mapa3DView";
import { EstadoPlano } from "../components/common/EstadoPlano";
import {
  getPlanoEdificioUrl,
  descargarPlanoSvg,
  PlanoError,
  ErrorPlano,
  MENSAJES_ERROR_PLANO,
} from "../services/mapasService";
import { log } from "../utils/log";
import { nombreLegible } from "../components/mapa3d/runtime/etiquetas";
import { ListaEspacios } from "../components/edificio/ListaEspacios";
import { listarEspacios } from "../utils/espacios";
import { AULAS_UBICACIONES } from "./Mapa";
import { useTheme } from "../context/ThemeContext";
import { esIdSvgValido, normalizarAulaParam } from "../utils/sanitize";
import { Box, Layers } from "lucide-react-native";

const formatearNombreEdificio = (id: string, nombreOriginal?: string) => {
  if (
    nombreOriginal &&
    !nombreOriginal.toLowerCase().includes("edificio edificio") &&
    !nombreOriginal.toLowerCase().startsWith("edificio _")
  ) {
    return nombreOriginal;
  }
  if (!id) return "Edificio";

  let limpio = id
    .toLowerCase()
    .replace(/^edificio_?/, "")
    .replace(/_copy$/, "")
    .replace(/^_+/, "")
    .trim();

  const lugaresEspeciales: Record<string, string> = {
    estacionamiento: "Estacionamiento",
    cafeteria: "Cafetería",
    canchas: "Canchas Deportivas",
    domo: "Domo Cultural",
    "1_2": "Edificio 1 y 2",
    em: "Edificio EM",
    e: "Edificio EM",
  };

  return lugaresEspeciales[limpio] || `Edificio ${limpio.toUpperCase()}`;
};

/** Estado de descarga de cada planta. */
type EstadoPlanta =
  | { estado: "cargando" }
  | { estado: "listo"; svg: string }
  | { estado: "error"; motivo: ErrorPlano };

/** Mensajes cuando el 3D no puede mostrarse y la vista vuelve al 2D. */
const AVISOS_3D: Record<MotivoError3D, string> = {
  webgl: "Este dispositivo o navegador no admite gráficos 3D (WebGL). Se muestra el plano 2D.",
  three: "No se pudo cargar el motor 3D. Se muestra el plano 2D.",
  sin_aulas: "Este plano no tiene aulas que se puedan mostrar en 3D. Se muestra el plano 2D.",
  construccion: "Ocurrió un error al construir la vista 3D. Se muestra el plano 2D.",
  contexto: "Se perdió la aceleración gráfica del dispositivo. Se muestra el plano 2D.",
  tiempo: "La vista 3D tardó demasiado en cargar. Se muestra el plano 2D.",
  no_disponible: "La vista 3D no está disponible en esta versión. Se muestra el plano 2D.",
};

/** IDs de edificio válidos: evita rutas extrañas en la URL de Storage. */
const ID_EDIFICIO_RE = /^[a-z0-9_]{1,20}$/;

const Edificio = ({ route }: any) => {
  const { isDarkMode } = useTheme();

  const edificioIdParam = String(route?.params?.id || "p").toLowerCase().trim();
  const edificioValido = ID_EDIFICIO_RE.test(edificioIdParam);
  const edificioId = edificioValido ? edificioIdParam : "desconocido";
  const nombreEdificio = formatearNombreEdificio(
    edificioId,
    route?.params?.nombre
  );
  const plantaInicial: "baja" | "alta" = route?.params?.plantaInicial === "alta" ? "alta" : "baja";

  // Modo quiosco (pantallas fijas en el campus):
  //   /mapa/a?kiosco=1&aqui=entrada_principal&inactividad=90
  // - aqui: ID de un elemento del plano donde se marca "Usted está aquí"
  // - inactividad: segundos sin uso para volver a la vista inicial (15–600, por defecto 90)
  const modoKiosco = route?.params?.kiosco === "1" || route?.params?.kiosco === 1;
  const aquiParam = String(route?.params?.aqui ?? "").toLowerCase().trim();
  const aqui = esIdSvgValido(aquiParam) ? aquiParam : null;
  const segundosInactividad = Math.min(600, Math.max(15, Number(route?.params?.inactividad) || 90));
  const inactividadMs = modoKiosco ? segundosInactividad * 1000 : 0;


  const [modoVista, setModoVista] = useState<"2d" | "3d">("3d");
  const [aulaResaltada, setAulaResaltada] = useState<string | null>(
    normalizarAulaParam(route?.params?.aulaResaltada)
  );
  const [planta, setPlanta] = useState<"baja" | "alta">(plantaInicial);

  const [plantaBaja, setPlantaBaja] = useState<EstadoPlanta>({ estado: "cargando" });
  const [plantaAlta, setPlantaAlta] = useState<EstadoPlanta>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [aviso3D, setAviso3D] = useState<string | null>(null);

  const svgBaja = plantaBaja.estado === "listo" ? plantaBaja.svg : null;
  const svgAlta = plantaAlta.estado === "listo" ? plantaAlta.svg : null;

  // Si llega otra aula por parámetro, se aplica durante el render
  // (patrón recomendado por React en lugar de setState dentro de un efecto).
  const aulaParam = route?.params?.aulaResaltada;
  const [aulaParamPrevio, setAulaParamPrevio] = useState(aulaParam);
  if (aulaParam !== aulaParamPrevio) {
    setAulaParamPrevio(aulaParam);
    if (aulaParam !== undefined) {
      const nuevaAula = normalizarAulaParam(aulaParam);
      setAulaResaltada(nuevaAula);
      const ubicacion = nuevaAula ? AULAS_UBICACIONES[nuevaAula.toUpperCase()] : undefined;
      if (ubicacion?.planta) setPlanta(ubicacion.planta);
    }
  }

  // Descarga de ambas plantas. Se cancela al cambiar de edificio (evita que una
  // respuesta tardía del edificio anterior sobrescriba al actual).
  useEffect(() => {
    const control = new AbortController();
    const cargar = (p: "baja" | "alta", set: (e: EstadoPlanta) => void) => {
      set({ estado: "cargando" });
      if (!edificioValido) {
        set({ estado: "error", motivo: "no_existe" });
        return;
      }
      descargarPlanoSvg(getPlanoEdificioUrl(edificioId, p), control.signal)
        .then((svg) => set({ estado: "listo", svg }))
        .catch((e) => {
          if (control.signal.aborted) return;
          log.error(`Plano ${edificioId}/${p}:`, e);
          set({ estado: "error", motivo: e instanceof PlanoError ? e.motivo : "red" });
        });
    };
    cargar("baja", setPlantaBaja);
    cargar("alta", setPlantaAlta);
    return () => control.abort();
  }, [edificioId, edificioValido, intento]);

  const reintentar = () => setIntento((n) => n + 1);

  const alFallar3D = (motivo: MotivoError3D) => {
    log.warn("3D no disponible:", motivo);
    setAviso3D(AVISOS_3D[motivo]);
    setModoVista("2d");
  };

  const targetSvgId = useMemo(() => {
    if (!aulaResaltada) return null;
    const claveUpper = aulaResaltada.toUpperCase().trim();
    const ubicacion = AULAS_UBICACIONES[claveUpper];

    if (ubicacion?.svgId) {
      return esIdSvgValido(ubicacion.svgId) ? ubicacion.svgId : null;
    }

    const limpia = aulaResaltada.toLowerCase().trim().replace(/[\s-]+/g, "_");
    let candidato: string;
    if (
      limpia.startsWith("aula_") ||
      limpia.startsWith("edificio_") ||
      limpia.startsWith("laboratorio_") ||
      limpia.startsWith("consultorio_") ||
      limpia.startsWith("sala_") ||
      limpia.startsWith("area_") ||
      limpia.startsWith("almacen_") ||
      limpia.startsWith("jefatura_") ||
      limpia.startsWith("servicio_") ||
      limpia.startsWith("paqueteria_") ||
      limpia.startsWith("centro_")
    ) {
      candidato = limpia;
    } else {
      candidato = `aula_${limpia}`;
    }
    // Lista blanca: cualquier ID que no sea [a-z0-9_] se descarta.
    return esIdSvgValido(candidato) ? candidato : null;
  }, [aulaResaltada]);

  const processedBaja = useMemo(
    () =>
      svgBaja?.replace(
        /<svg/,
        '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
      ),
    [svgBaja]
  );
  const processedAlta = useMemo(
    () =>
      svgAlta?.replace(
        /<svg/,
        '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
      ),
    [svgAlta]
  );

  const currentSvgFor3D = planta === "baja" ? svgBaja : svgAlta;
  const svgOtraPlanta = planta === "baja" ? svgAlta : svgBaja;
  const espacios = useMemo(() => listarEspacios(currentSvgFor3D), [currentSvgFor3D]);
  const estadoActual = planta === "baja" ? plantaBaja : plantaAlta;

  return (
    <View style={[styles.screen, !isDarkMode && styles.screenLight]}>
      <Navbar />
      <View style={styles.main}>
        <View style={styles.headerRow}>
          <EdificioHeader
            edificioId={edificioId}
            nombreEdificio={nombreEdificio}
            isDarkMode={isDarkMode}
          />
          {/* Selector de Modo 2D / 3D */}
          <View style={[styles.modeToggleContainer, !isDarkMode && styles.modeToggleContainerLight]}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                modoVista === "2d" && (isDarkMode ? styles.modeBtnActiveDark : styles.modeBtnActiveLight),
              ]}
              onPress={() => setModoVista("2d")}
              activeOpacity={0.7}
            >
              <Layers size={14} color={modoVista === "2d" ? (isDarkMode ? "#ffffff" : "#0f172a") : (isDarkMode ? "#71717a" : "#64748b")} />
              <Text
                style={[
                  styles.modeBtnText,
                  !isDarkMode && styles.modeBtnTextLight,
                  modoVista === "2d" && (isDarkMode ? styles.modeBtnTextActiveDark : styles.modeBtnTextActiveLight),
                ]}
              >
                2D Plano
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeBtn,
                modoVista === "3d" && (isDarkMode ? styles.modeBtnActiveDark : styles.modeBtnActiveLight),
              ]}
              onPress={() => {
                setAviso3D(null);
                setModoVista("3d");
              }}
              activeOpacity={0.7}
            >
              <Box size={14} color={modoVista === "3d" ? (isDarkMode ? "#ffffff" : "#0f172a") : (isDarkMode ? "#71717a" : "#64748b")} />
              <Text
                style={[
                  styles.modeBtnText,
                  !isDarkMode && styles.modeBtnTextLight,
                  modoVista === "3d" && (isDarkMode ? styles.modeBtnTextActiveDark : styles.modeBtnTextActiveLight),
                ]}
              >
                3D Quiosco
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {aviso3D && (
          <View
            style={[styles.avisoBanner, !isDarkMode && styles.avisoBannerLight]}
            role="alert"
          >
            <Text style={[styles.avisoText, !isDarkMode && styles.avisoTextLight]}>{aviso3D}</Text>
            <TouchableOpacity onPress={() => setAviso3D(null)} role="button" aria-label="Cerrar aviso">
              <Text style={styles.quitarText}>cerrar</Text>
            </TouchableOpacity>
          </View>
        )}

        {aulaResaltada && (
          <View
            style={[
              styles.resaltadoBanner,
              !isDarkMode && styles.resaltadoBannerLight,
            ]}
          >
            <Text style={styles.resaltadoText}>
              RESALTADO: {targetSvgId ? nombreLegible(targetSvgId) : aulaResaltada.toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => setAulaResaltada(null)}>
              <Text style={styles.quitarText}>quitar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.mapCard, !isDarkMode && styles.mapCardLight]}>
          <View style={styles.mapContent}>
            <FloorSelector
              planta={planta}
              setPlanta={setPlanta}
              isDarkMode={isDarkMode}
            />
            <View
              style={[
                styles.imageContainer,
                !isDarkMode && styles.imageContainerLight,
              ]}
            >
              <View style={styles.mapWrapper}>
                {estadoActual.estado === "cargando" ? (
                  <EstadoPlano tipo="cargando" mensaje="Cargando plano arquitectónico…" isDarkMode={isDarkMode} />
                ) : estadoActual.estado === "error" ? (
                  <EstadoPlano
                    tipo="error"
                    mensaje={MENSAJES_ERROR_PLANO[estadoActual.motivo].mensaje}
                    detalle={MENSAJES_ERROR_PLANO[estadoActual.motivo].detalle}
                    isDarkMode={isDarkMode}
                    onReintentar={estadoActual.motivo === "no_existe" ? undefined : reintentar}
                  />
                ) : modoVista === "3d" ? (
                  <Mapa3DView
                    svgXml={currentSvgFor3D}
                    edificioId={edificioId}
                    planta={planta}
                    selectedRoomId={targetSvgId}
                    isDarkMode={isDarkMode}
                    onRoomClick={(id) => setAulaResaltada(normalizarAulaParam(id)?.toUpperCase() ?? null)}
                    onError={alFallar3D}
                    onSeleccionLimpiada={() => setAulaResaltada(null)}
                    svgSecundario={svgOtraPlanta}
                    aqui={aqui}
                    inactividadMs={inactividadMs}
                    titulo={nombreEdificio}
                  />
                ) : (
                  <MapaWebView
                    svgBaja={processedBaja}
                    svgAlta={processedAlta}
                    planta={planta}
                    targetSvgId={targetSvgId}
                    onAulaClick={(id) => setAulaResaltada(normalizarAulaParam(id)?.toUpperCase() ?? null)}
                    isDarkMode={isDarkMode}
                  />
                )}
              </View>
            </View>
          </View>
        </View>

        <ListaEspacios
          espacios={espacios}
          seleccionado={targetSvgId}
          isDarkMode={isDarkMode}
          onSeleccionar={(id) => setAulaResaltada(normalizarAulaParam(id)?.toUpperCase() ?? null)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  screenLight: { backgroundColor: "transparent" },
  main: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  modeToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  modeToggleContainerLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeBtnActiveDark: {
    backgroundColor: "#27272a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnActiveLight: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  modeBtnTextLight: {
    color: "#64748b",
  },
  modeBtnTextActiveDark: {
    color: "#ffffff",
  },
  modeBtnTextActiveLight: {
    color: "#0f172a",
  },
  resaltadoBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(30, 20, 50, 0.6)",
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  resaltadoBannerLight: { backgroundColor: "#f3e8ff" },
  avisoBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(120, 53, 15, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  avisoBannerLight: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  avisoText: { color: "#fcd34d", flex: 1, fontSize: 13 },
  avisoTextLight: { color: "#92400e" },
  resaltadoText: { color: "#c084fc", fontWeight: "bold" },
  quitarText: { color: "#71717a", textDecorationLine: "underline" },
  
  /* CONTENEDOR PRINCIPAL DEL MAPA Y BOTONES LATERALES */
  mapCard: {
    flex: 1,
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
  },
  mapCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  mapContent: { flex: 1, flexDirection: "row" },
  
  /* ÁREA ESPECÍFICA DONDE SE DIBUJA EL SVG / 3D */
  imageContainer: { 
    flex: 1, 
    backgroundColor: "#08080a", 
    padding: 0,
  },
  imageContainerLight: { 
    backgroundColor: "#f1f4f8",
  },
  mapWrapper: { width: "100%", height: "100%", position: "relative" },
});

export default Edificio;
