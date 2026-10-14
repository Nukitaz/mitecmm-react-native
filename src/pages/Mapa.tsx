import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
} from "react-native";
import { WebView } from "react-native-webview";
import { useNavigation } from "@react-navigation/native";
import { Search, User, Book, MapPin } from "lucide-react-native";
import { Navbar } from "../components/Navbar";
import { getMapaGeneralUrl } from "../services/mapasService";
import { obtenerProfesores } from "../services/profesoresService";
import { useTheme } from "../context/ThemeContext";

export const AULAS_UBICACIONES: Record<
  string,
  { edificioId: string; nombreEdificio: string; planta: "baja" | "alta"; svgId: string }
> = {
  // ==========================================
  //               EDIFICIO L
  // ==========================================
  LTI: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "laboratorio_de_tecnologias_de_la_informacion_lti" },
  LR: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "laboratorio_de_redes_lr" },
  LDS: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "laboratorio_de_desarrollo_de_software_lds" },
  LIS: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "laboratorio_de_ingenieria_de_software_lis" },
  LET: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "laboratorio_de_tecnologias_emergentes_let" },
  LIA: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "laboratorio_de_inteligencia_artificial_lia" },
  SISTEMAS: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "encargado_de_laboratorios_de_sistemas" },
  JEFATURA_SISTEMAS: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "jefatura_de_division_de_sistemas_computacionales" },
  MANTENIMIENTO: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "mantenimiento_y_telecomunicaciones" },
  DOCENTES_L: { edificioId: "l", nombreEdificio: "Edificio L", planta: "alta", svgId: "sala_de_docentes" },

  LCS: { edificioId: "l", nombreEdificio: "Edificio L", planta: "baja", svgId: "laboratorio_de_computo_sistemas_lcs" },
  LACD: { edificioId: "l", nombreEdificio: "Edificio L", planta: "baja", svgId: "laboratorio_de_analisis_y_ciencia_de_datos_lacd" },
  LWI: { edificioId: "l", nombreEdificio: "Edificio L", planta: "baja", svgId: "laboratorio_de_worstation_ibm_lwi" },
  VIGILANCIA: { edificioId: "l", nombreEdificio: "Edificio L", planta: "baja", svgId: "paqueteria_vigilancia" },
  REDES: { edificioId: "l", nombreEdificio: "Edificio L", planta: "baja", svgId: "jefatura_de_redes" },
  CARGA: { edificioId: "l", nombreEdificio: "Edificio L", planta: "baja", svgId: "centro_de_carga_electrico" },

  // ==========================================
  //               EDIFICIO B
  // ==========================================
  LAB_QUIMICA: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "laboratorio_de_quimica" },
  LAB_FISICA: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "laboratorio_de_fisica" },
  CB1: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "aula_cb1" },
  CB2: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "aula_cb2" },
  CB3: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "aula_cb3" },
  CB4: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "aula_cb4" },
  CB5: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "aula_cb5" },
  CB6: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "aula_cb6" },
  MAESTROS_BASICAS: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "sala_de_maestros_basicas" },
  MAESTROS_ELECTROMECANICA: { edificioId: "b", nombreEdificio: "Edificio B", planta: "baja", svgId: "sala_de_maestros_electromecanica" },

  CB7: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "aula_cb7" },
  CB8: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "aula_cb8" },
  CB9: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "aula_cb9" },
  CB10: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "aula_cb10" },
  CB11: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "aula_cb11" },
  CONTROL_ESCOLAR: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "control_escolar" },
  SERVICIOS_ESCOLARES: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "servicios_escolares_ventanillas" },
  JEFATURA_SERVICIOS_ESCOLARES: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "jefatura_de_servicios_escolares" },
  TITULACION: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "titulacion" },
  MOVILIDAD: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "movilidad" },
  EGRESADOS: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "egresados" },
  CAJAS: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "cajas" },
  RECURSOS_HUMANOS: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "recursos_humanos" },
  JEFATURA_RECURSOS_HUMANOS: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "jefatura_de_recursos_humanos" },
  JEFATURA_FINANZAS: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "jefatura_de_administracion_y_finanzas" },
  JEFATURA_SERVICIOS_GENERALES: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "jefatura_de_servicios_generales" },
  ARCHIVO: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "archivo" },
  ARCHIVO_RH_ADMIN: { edificioId: "b", nombreEdificio: "Edificio B", planta: "alta", svgId: "archivo_de_recursos_humanos_y_administracion" },

  // ==========================================
  //               EDIFICIO I
  // ==========================================
  I1: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "aula_i1" },
  I2: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "aula_i2" },
  I3: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "aula_i3" },
  I4: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "aula_i4" },
  I5: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "aula_i5" },
  I7: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "aula_i7" },
  CONSULTORIO_MEDICO: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "consultorio_medico" },
  AUDITORIO: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "auditorio" },
  LAB_MANUFACTURA: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "laboratorio_de_manufactura" },
  ALMACEN_INDUSTRIAL: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "almacen_laboratorio_de_ingenieria_industrial" },
  ALMACEN_GASTRONOMIA: { edificioId: "i", nombreEdificio: "Edificio I", planta: "baja", svgId: "almacen_de_gastronomia" },

  I6: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "aula_i6" },
  LC1: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "laboratorio_de_computo_1_lc1" },
  LC2: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "laboratorio_de_computo_2_lc2" },
  METODOS_INDUSTRIAL: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "laboratorios_de_metodos_de_ing_industrial" },
  JEFATURA_INDUSTRIAL: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "jefatura_de_division_de_ingenieria_industrial" },
  JEFATURA_IDIOMAS: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "jefatura_de_idiomas" },
  COORDINACION_IDIOMAS: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "coordinacion_de_idiomas" },
  JEFATURA_JURIDICA: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "jefatura_area_juridica" },
  SALA_DE_MAESTROS_I: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "sala_de_maestros" },
  SALA_DE_JUNTAS_I: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "sala_de_juntas" },
  COCTELERIA: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "cocteleria" },
  ALMACEN_COCTELERIA: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "almacen_de_cocteleria" },
  COCINETA: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "cocineta" },
  ARCHIVO_GASTRO: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "archivo_gastro" },
  AREA_DOCENTES_I: { edificioId: "i", nombreEdificio: "Edificio I", planta: "alta", svgId: "area_de_docentes" },

  // ==========================================
  //               EDIFICIO P
  // ==========================================
  P1: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p1" },
  P2: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p2" },
  P3: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p3" },
  P4: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p4" },
  P5: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p5" },
  P6: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p6" },
  P7: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "aula_p7" },
  PSICOLOGIA: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "psicologia" },
  CIIE: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "centro_de_incubacion_e_innovacion_empresarial_ciie" },
  JEFATURA_GESTION: { edificioId: "p", nombreEdificio: "Edificio P", planta: "baja", svgId: "jefatura_de_gestion_empresarial" },

  P8: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "aula_p8" },
  P9: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "aula_p9" },
  P10: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "aula_p10" },
  P11: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "aula_p11" },
  P12: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "aula_p12" },
  SALA_EGRESADOS: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "sala_de_egresados" },
  DIRECTOR_GENERAL: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "director_general" },
  JEFATURA_PLANEACION: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "jefatura_de_planeacion" },
  SALA_EX_DIRECTORES: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "sala_de_ex_directores" },
  DESARROLLO_MATERIAL_EDUCATIVO: { edificioId: "p", nombreEdificio: "Edificio P", planta: "alta", svgId: "desarrollo_de_material_educativo" },

  // ==========================================
  //               EDIFICIO A
  // ==========================================
  A1: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a1" },
  A2: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a2" },
  A3: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a3" },
  A4: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a4" },
  A5: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a5" },
  A6_PB: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a6" },
  A7_PB: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a7" },
  A8: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "aula_a8" },
  RESTIRADORES_20: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "taller_restiradores_20" },
  PSICOLOGIA_A: { edificioId: "a", nombreEdificio: "Edificio A", planta: "baja", svgId: "psicologia" },

  A6_PA: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "aula_a6" },
  A7_PA: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "aula_a7" },
  AULA_MAGNA: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "aula_magna" },
  RESTIRADORES_30: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "taller_restiradores_30" },
  LAB_DISENO_CIVIL_ARQ: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "laboratorio_de_diseno_civil_y_arquitectura" },
  ALMACEN_CIVIL_ARQ: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "almacen_de_civil_y_arquitectura" },
  JEFATURA_LAB_TALLERES: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "jefatura_laboratorio_y_talleres" },
  RESIDENCIAS: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "residencias" },
  JEFATURA_VINCULACION_1: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "jefatura_de_division_de_vinculacion_1" },
  JEFATURA_VINCULACION_2: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "jefatura_de_division_de_vinculacion_2" },
  JEFATURA_ARQUITECTURA: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "jefatura_de_division_de_arquitectura" },
  TUTORIAS: { edificioId: "a", nombreEdificio: "Edificio A", planta: "alta", svgId: "coordinacion_de_tutorias" },

  // ==========================================
  //               EDIFICIO EM
  // ==========================================
  EM1: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "aula_em1" },
  EM2: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "aula_em2" },
  EM3: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "aula_em3" },
  LAB_EM: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "laboratorio" },
  LAB_METODOS_EM: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "laboratorio_de_metodos" },
  LME: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "laboratorio_de_metrologia_lme" },
  LH: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "laboratorio_de_hidraulica_lh" },
  MESA_CICLOS: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "mesa_de_ciclos" },
  MANUFACTURA_EM: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "area_de_procesos_de_manufactura" },
  MANUFACTURA_CNC: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "area_de_manufactura_cnc" },
  CONTROL_ELECTRICO: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "area_de_tableros_de_control_electrico" },
  SOLDADURA: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "area_de_soldadura" },
  LAB_MANUFACTURA_EM: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "baja", svgId: "laboratorio_de_manufactura" },

  EM4: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "aula_em4" },
  EM5: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "aula_em5" },
  EM6: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "aula_em6" },
  EM7: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "aula_em7" },
  LCE: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "laboratorio_de_computo_electromecanica_lce" },
  JEFATURA_ELECTROMECANICA: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "jefatura_de_division_de_ingenieria_electromecanica" },
  SINDICATO: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "oficina_sindicato" },
  BODEGA_EM4: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "bodega_em4" },
  BODEGA_EM6: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "bodega_em6" },
  BODEGA_EM7: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "bodega_em7" },
  BODEGA_LCE: { edificioId: "em", nombreEdificio: "Edificio EM", planta: "alta", svgId: "bodega_lce" },
};

const EDIFICIOS_CLICKEABLES: Record<string, { id: string; nombre: string }> = {
  Edificio_P: { id: "p", nombre: "Edificio P" },
  Edificio_L: { id: "l", nombre: "Edificio L" },
  Edificio_A: { id: "a", nombre: "Edificio A" },
  Edificio_I: { id: "i", nombre: "Edificio I" },
  Edificio_EM: { id: "em", nombre: "Edificio EM" },
  Edificio_B: { id: "b", nombre: "Edificio B" },
};

export type Suggestion = {
  id: string;
  type: "aula" | "prof" | "materia";
  label: string;
  detail: string;
  aulaResaltada?: string;
  profesorQuery?: string;
};

let mapaGeneralCache: string | null = null;

const Mapa = () => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();
  const mapaGeneralUrl = getMapaGeneralUrl();

  const bgColor = isDarkMode ? "#08080a" : "#f8fafc";

  const [activeBuildingSvgId, setActiveBuildingSvgId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(mapaGeneralCache);
  const [isMapHovered, setIsMapHovered] = useState(false);

  // Estados del Buscador
  const [busqueda, setBusqueda] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sugerencias, setSugerencias] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!mapaGeneralCache) {
      fetch(mapaGeneralUrl)
        .then((res) => res.text())
        .then((text) => {
          mapaGeneralCache = text;
          setSvgContent(text);
        })
        .catch((err) => console.error("Error al cargar el mapa general:", err));
    }
  }, [mapaGeneralUrl]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (busqueda.trim().length < 2) {
        setSugerencias([]);
        return;
      }

      const term = busqueda.toUpperCase().trim();
      let nuevasSugerencias: Suggestion[] = [];

      // 1. Filtrar Aulas estáticas
      Object.keys(AULAS_UBICACIONES).forEach((aula) => {
        if (aula.includes(term)) {
          nuevasSugerencias.push({
            id: `aula-${aula}`,
            type: "aula",
            label: `AULA ${aula}`,
            detail: "SALÓN",
            aulaResaltada: aula,
          });
        }
      });

      // 2. Consulta a Supabase (horarios_docentes)
      try {
        const resultadosDB = await obtenerProfesores(busqueda);

        const profesoresMap = new Map<string, { totalMaterias: Set<string>; aula: string }>();
        const materiasAgregadas = new Set<string>();

        resultadosDB?.forEach((item: any) => {
          const doc = item.docente?.trim();
          const mat = item.materia?.trim();
          const aulaClass = item.aula?.trim();

          // Filtrar por Docente
          if (doc && doc.toUpperCase().includes(term)) {
            if (!profesoresMap.has(doc)) {
              profesoresMap.set(doc, { totalMaterias: new Set(), aula: aulaClass });
            }
            if (mat) profesoresMap.get(doc)!.totalMaterias.add(mat);
          }

          // Filtrar por Materia
          if (mat && mat.toUpperCase().includes(term) && !materiasAgregadas.has(mat)) {
            materiasAgregadas.add(mat);
            nuevasSugerencias.push({
              id: `mat-${item.id || mat}`,
              type: "materia",
              label: mat,
              detail: "MATERIA",
              aulaResaltada: aulaClass,
            });
          }
        });

        // Formatear resultados de Profesores
        profesoresMap.forEach((val, docente) => {
          const count = val.totalMaterias.size;
          nuevasSugerencias.push({
            id: `prof-${docente}`,
            type: "prof",
            label: docente,
            detail: count > 0 ? `PROF · ${count} MATS` : "PROFESOR",
            aulaResaltada: val.aula,
            profesorQuery: docente,
          });
        });
      } catch (err) {
        console.error("Error al consultar Supabase:", err);
      }

      setSugerencias(nuevasSugerencias.slice(0, 6));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  const processedSvg = useMemo(() => {
    if (!svgContent) return null;

    let modifiedXml = svgContent;

    modifiedXml = modifiedXml.replace(
      /<svg/,
      '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
    );

    Object.keys(EDIFICIOS_CLICKEABLES).forEach((svgId) => {
      const isHovered = activeBuildingSvgId === svgId;
      const regex = new RegExp(`(<[^>]+id="${svgId}"[^>]*)(style="[^"]*")?`, "g");

      modifiedXml = modifiedXml.replace(regex, (match, p1) => {
        const extendedClickStyle = "pointer-events: all; cursor: pointer; stroke-width: 12px; stroke: transparent;";
        if (isHovered) {
          return `${p1} style="${extendedClickStyle} filter: drop-shadow(0px 0px 10px #a855f7); transition: all 0.2s;"`;
        }
        return `${p1} style="${extendedClickStyle}"`;
      });
    });

    return modifiedXml;
  }, [svgContent, activeBuildingSvgId]);

  const handleElementClick = (targetId: string) => {
    if (!targetId) return;

    const edificio = EDIFICIOS_CLICKEABLES[targetId];
    if (edificio) {
      navigation.navigate("Edificio", {
        id: edificio.id,
        nombre: edificio.nombre,
      });
    }
  };

  const handleSelectSuggestion = (item: Suggestion) => {
    setBusqueda(item.label);
    setIsFocused(false);

    // Redirección si es Profesor
    if (item.type === "prof") {
      navigation.navigate("Profesores", { q: item.profesorQuery || item.label });
      return;
    }

    // Redirección si es Materia o Aula
    let aulaObjetivo = item.aulaResaltada ? item.aulaResaltada.toUpperCase() : "";
    let ubicacion = AULAS_UBICACIONES[aulaObjetivo];

    if (!ubicacion && aulaObjetivo) {
      const letraEdificio = aulaObjetivo.charAt(0).toLowerCase();
      const edificiosValidos = ["a", "b", "c", "f", "g", "i", "l", "o", "p", "e"];

      if (edificiosValidos.includes(letraEdificio)) {
        ubicacion = {
          edificioId: letraEdificio === "e" ? "em" : letraEdificio,
          nombreEdificio: `Edificio ${letraEdificio.toUpperCase()}`,
          planta: "alta",
          svgId: "",
        };
      }
    }

    if (ubicacion) {
      navigation.navigate("Edificio", {
        id: ubicacion.edificioId,
        nombre: ubicacion.nombreEdificio,
        plantaInicial: ubicacion.planta,
        aulaResaltada: aulaObjetivo,
      });
    } else {
      navigation.navigate("Profesores", { q: item.label });
    }
  };

  const IconoTipo = ({ type }: { type: string }) => {
    switch (type) {
      case "prof":
        return <User size={16} color="#a855f7" />;
      case "materia":
        return <Book size={16} color="#a855f7" />;
      default:
        return <MapPin size={16} color="#a855f7" />;
    }
  };

  return (
    <View style={[styles.screen, !isDarkMode && styles.screenLight]}>
      <Navbar />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.main}>
          <View style={styles.headerSection}>
            <Text style={[styles.modCode, !isDarkMode && styles.textLightSecondary]}>
              [ MOD_03 · CAMPUS_MAP ]
            </Text>
            <Text style={[styles.title, !isDarkMode && styles.titleLight]}>
              Mapa del Campus
            </Text>
            <Text style={[styles.subtitle, !isDarkMode && styles.subtitleLight]}>
              Selecciona un edificio o busca una ubicación específica.
            </Text>

            <View style={styles.searchWrapper}>
              <View
                style={[
                  styles.searchContainer,
                  !isDarkMode && styles.searchContainerLight,
                  isFocused && styles.searchContainerActive,
                ]}
              >
                <Search
                  size={18}
                  color={isFocused ? "#a855f7" : isDarkMode ? "#a1a1aa" : "#64748b"}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, !isDarkMode && styles.searchInputLight]}
                  placeholder="Busca un salón, profesor o materia..."
                  placeholderTextColor={isDarkMode ? "#71717a" : "#94a3b8"}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 250)}
                  returnKeyType="search"
                />
              </View>

              {isFocused && sugerencias.length > 0 && (
                <View
                  style={[
                    styles.dropdownContainer,
                    !isDarkMode && styles.dropdownContainerLight,
                  ]}
                >
                  {sugerencias.map((sug, index) => (
                    <TouchableOpacity
                      key={sug.id}
                      style={[
                        styles.dropdownItem,
                        index !== sugerencias.length - 1 &&
                          (isDarkMode ? styles.dropdownItemBorder : styles.dropdownItemBorderLight),
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSuggestion(sug)}
                      {...(Platform.OS === "web"
                        ? {
                            onMouseDown: (e: any) => {
                              e.preventDefault();
                              handleSelectSuggestion(sug);
                            },
                          }
                        : {})}
                    >
                      <View style={styles.dropdownLeft}>
                        <IconoTipo type={sug.type} />
                        <Text
                          style={[styles.dropdownLabel, !isDarkMode && styles.dropdownLabelLight]}
                          numberOfLines={1}
                        >
                          {sug.label}
                        </Text>
                      </View>
                      <Text style={styles.dropdownDetail}>{sug.detail}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View
            style={[
              styles.mapCard,
              !isDarkMode && styles.mapCardLight,
              isMapHovered && (isDarkMode ? styles.mapCardHovered : styles.mapCardHoveredLight),
            ]}
            {...({
              onPointerEnter: () => setIsMapHovered(true),
              onPointerLeave: () => setIsMapHovered(false),
            } as any)}
          >
            <View style={styles.mapHeader}>
              <Text style={[styles.mapTag, !isDarkMode && styles.textLightSecondary]}>
                // MAPA_GENERAL.SVG
              </Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {activeBuildingSvgId && EDIFICIOS_CLICKEABLES[activeBuildingSvgId]
                    ? EDIFICIOS_CLICKEABLES[activeBuildingSvgId].nombre.toUpperCase()
                    : "LIVE"}
                </Text>
              </View>
            </View>

            <View style={[styles.canvasContainer, !isDarkMode && styles.canvasContainerLight]}>
              <View
                style={styles.mapWrapper}
                {...({
                  onPointerOver: (e: any) => {
                    const targetId = e.target?.id || e.target?.parentElement?.id;
                    if (targetId && EDIFICIOS_CLICKEABLES[targetId]) {
                      setActiveBuildingSvgId(targetId);
                    } else {
                      setActiveBuildingSvgId(null);
                    }
                  },
                  onClick: (e: any) => {
                    const targetId = e.target?.id || e.target?.parentElement?.id;
                    handleElementClick(targetId);
                  },
                } as any)}
              >
                {processedSvg ? (
                  Platform.OS === "web" ? (
                    <div
                      style={{ width: "100%", height: "100%", backgroundColor: bgColor }}
                      dangerouslySetInnerHTML={{ __html: processedSvg }}
                    />
                  ) : (
                    <WebView
                      originWhitelist={["*"]}
                      source={{
                        html: `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes">
                              <style>
                                * { -webkit-tap-highlight-color: transparent; }
                                body, html {
                                  margin: 0;
                                  padding: 0;
                                  width: 100%;
                                  height: 100%;
                                  background-color: ${bgColor};
                                  display: flex;
                                  justify-content: center;
                                  align-items: center;
                                  overflow: hidden;
                                  touch-action: manipulation;
                                }
                                svg {
                                  width: 100%;
                                  height: 100%;
                                  max-width: 100%;
                                  max-height: 100%;
                                  object-fit: contain;
                                }
                              </style>
                            </head>
                            <body>
                              ${processedSvg}
                              <script>
                                var isHandled = false;

                                function processClick(e) {
                                  if (isHandled) return;
                                  var target = e.target;
                                  while (target && target !== document.body) {
                                    if (target.id) {
                                      isHandled = true;
                                      window.ReactNativeWebView.postMessage(JSON.stringify({
                                        type: 'BUILDING_CLICK',
                                        id: target.id
                                      }));
                                      setTimeout(function() { isHandled = false; }, 400);
                                      break;
                                    }
                                    target = target.parentElement;
                                  }
                                }

                                document.addEventListener('touchend', function(e) {
                                  if (e.changedTouches && e.changedTouches.length > 0) {
                                    var touch = e.changedTouches[0];
                                    var element = document.elementFromPoint(touch.clientX, touch.clientY);
                                    if (element) {
                                      processClick({ target: element });
                                    }
                                  }
                                }, { passive: true });

                                document.addEventListener('click', processClick);
                              </script>
                            </body>
                          </html>
                        `,
                      }}
                      style={{ flex: 1, backgroundColor: bgColor }}
                      containerStyle={{ backgroundColor: bgColor }}
                      scrollEnabled={false}
                      scalesPageToFit={true}
                      onMessage={(event) => {
                        try {
                          const data = JSON.parse(event.nativeEvent.data);
                          if (data.type === "BUILDING_CLICK" && data.id) {
                            handleElementClick(data.id);
                          }
                        } catch (e) {
                          console.error("Error al procesar mensaje del WebView:", e);
                        }
                      }}
                    />
                  )
                ) : (
                  <Text style={{ color: "#71717a", textAlign: "center", marginTop: 20 }}>
                    Cargando Mapa del Campus...
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  screenLight: { backgroundColor: "transparent" },
  container: { flexGrow: 1 },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
    zIndex: 1,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 24,
    zIndex: 9999,
  },
  modCode: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 4,
  },
  titleLight: { color: "#0f172a" },
  subtitle: {
    fontSize: 14,
    color: "#a1a1aa",
    marginTop: 4,
  },
  subtitleLight: { color: "#64748b" },
  searchWrapper: {
    width: "100%",
    maxWidth: 600,
    marginTop: 20,
    position: "relative",
    zIndex: 10000,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 4,
    paddingHorizontal: 14,
  },
  searchContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  searchContainerActive: {
    borderColor: "#a855f7",
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 15,
    outlineStyle: "none" as any,
  },
  searchInputLight: { color: "#0f172a" },
  dropdownContainer: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: "#121118",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    borderRadius: 6,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 25,
    zIndex: 10001,
  },
  dropdownContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e24",
  },
  dropdownItemBorderLight: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  dropdownLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  dropdownLabelLight: { color: "#0f172a" },
  dropdownDetail: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#c084fc",
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  mapCard: {
    backgroundColor: "#0d0d10",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
    width: "100%",
    ...(Platform.OS === "web"
      ? ({
          transitionDuration: "0.3s",
          transitionProperty: "border-color, box-shadow, background-color",
        } as any)
      : {}),
  },
  mapCardLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  mapCardHovered: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  mapCardHoveredLight: {
    borderColor: "#a855f7",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mapTag: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#71717a",
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a855f7",
  },
  liveText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#a855f7",
    fontWeight: "bold",
  },
  canvasContainer: {
    width: "100%",
    backgroundColor: "#08080a",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1e1e24",
    alignItems: "center",
    justifyContent: "center",
  },
  canvasContainerLight: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  mapWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: Platform.OS === "web" ? 1.43 : 1.3,
  },
  textLightSecondary: { color: "#64748b" },
});

export default Mapa;