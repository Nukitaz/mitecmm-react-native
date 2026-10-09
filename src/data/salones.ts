// Catálogo de espacios (salones, laboratorios, oficinas, etc.) con su edificio y planta.
// Los IDs deben coincidir EXACTAMENTE con los id="..." dentro de cada SVG en el bucket "Maps".

export type Planta = "baja" | "alta";

export interface Salon {
  /** id exacto del elemento dentro del SVG */
  id: string;
  /** etiqueta legible para mostrar al usuario */
  label: string;
  /** id del edificio (a, b, em, i, p, l) */
  edificio: string;
  planta: Planta;
}

const fmt = (raw: string) =>
  raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLc1\b/, "LC1")
    .replace(/\bLc2\b/, "LC2")
    .replace(/\bLce\b/, "LCE")
    .replace(/\bLh\b/, "LH")
    .replace(/\bLme\b/, "LME")
    .replace(/\bLcs\b/, "LCS")
    .replace(/\bLwi\b/, "LWI")
    .replace(/\bLacd\b/, "LACD")
    .replace(/\bLds\b/, "LDS")
    .replace(/\bLis\b/, "LIS")
    .replace(/\bLia\b/, "LIA")
    .replace(/\bLr\b/, "LR")
    .replace(/\bLti\b/, "LTI")
    .replace(/\bLet\b/, "LET")
    .replace(/\bCiie\b/, "CIIE")
    .replace(/\bCnc\b/, "CNC");

const make = (edificio: string, planta: Planta, ids: string[], overrides: Record<string, string> = {}): Salon[] =>
  ids.map((id) => ({ id, label: overrides[id] ?? fmt(id), edificio, planta }));

export const SALONES: Salon[] = [
  // === Edificio A ===
  ...make("a", "baja", [
    "aula_a1", "aula_a2", "aula_a3", "aula_a4", "aula_a5", "aula_a6", "aula_a7", "aula_a8",
    "psicologia", "taller_restiradores_20",
  ], {
    aula_a1: "Aula A1", aula_a2: "Aula A2", aula_a3: "Aula A3", aula_a4: "Aula A4",
    aula_a5: "Aula A5", aula_a6: "Aula A6 (PB)", aula_a7: "Aula A7 (PB)", aula_a8: "Aula A8",
    taller_restiradores_20: "Taller Restiradores 20",
  }),
  ...make("a", "alta", [
    "aula_a6", "aula_a7", "aula_magna",
    "almacen_de_civil_y_arquitectura",
    "coordinacion_de_tutorias",
    "jefatura_de_division_de_arquitectura",
    "jefatura_de_division_de_vinculacion_1",
    "jefatura_de_division_de_vinculacion_2",
    "jefatura_laboratorio_y_talleres",
    "laboratorio_de_diseno_civil_y_arquitectura",
    "residencias",
    "taller_restiradores_30",
  ], {
    aula_a6: "Aula A6 (PA)", aula_a7: "Aula A7 (PA)", aula_magna: "Aula Magna",
    taller_restiradores_30: "Taller Restiradores 30",
  }),

  // === Edificio B ===
  ...make("b", "baja", [
    "aula_cb1", "aula_cb2", "aula_cb3", "aula_cb4", "aula_cb5", "aula_cb6",
    "laboratorio_de_fisica", "laboratorio_de_quimica",
    "sala_de_maestros_basicas", "sala_de_maestros_electromecanica",
  ]),
  ...make("b", "alta", [
    "aula_cb7", "aula_cb8", "aula_cb9", "aula_cb10", "aula_cb11",
    "archivo", "archivo_de_recursos_humanos_y_administracion",
    "cajas", "control_escolar", "egresados",
    "jefatura_de_administracion_y_finanzas",
    "jefatura_de_recursos_humanos",
    "jefatura_de_servicios_escolares",
    "jefatura_de_servicios_generales",
    "movilidad", "recursos_humanos",
    "servicios_escolares_ventanillas", "titulacion",
  ]),

  // === Edificio EM ===
  ...make("em", "baja", [
    "aula_em1", "aula_em2", "aula_em3",
    "area_de_manufactura_cnc", "area_de_procesos_de_manufactura",
    "area_de_soldadura", "area_de_tableros_de_control_electrico",
    "laboratorio", "laboratorio_de_hidraulica_lh",
    "laboratorio_de_manufactura", "laboratorio_de_metodos",
    "laboratorio_de_metrologia_lme", "mesa_de_ciclos",
  ]),
  ...make("em", "alta", [
    "aula_em4", "aula_em5", "aula_em6", "aula_em7",
    "bodega_em4", "bodega_em6", "bodega_em7", "bodega_lce",
    "jefatura_de_division_de_ingenieria_electromecanica",
    "laboratorio_de_computo_electromecanica_lce",
    "oficina_sindicato",
  ]),

  // === Edificio I ===
  ...make("i", "baja", [
    "aula_i1", "aula_i2", "aula_i3", "aula_i4", "aula_i5", "aula_i7",
    "auditorio", "consultorio_medico",
    "almacen_de_gastronomia", "almacen_laboratorio_de_ingenieria_industrial",
    "laboratorio_de_manufactura",
  ]),
  ...make("i", "alta", [
    "aula_i6",
    "almacen_de_cocteleria", "archivo_gastro", "area_de_docentes",
    "cocineta", "cocteleria",
    "coordinacion_de_idiomas",
    "jefatura_area_juridica",
    "jefatura_de_division_de_ingenieria_industrial",
    "jefatura_de_idiomas",
    "laboratorio_de_computo_1_lc1", "laboratorio_de_computo_2_lc2",
    "laboratorios_de_metodos_de_ing_industrial",
    "sala_de_juntas", "sala_de_maestros",
  ]),

  // === Edificio P ===
  ...make("p", "baja", [
    "aula_p1", "aula_p2", "aula_p3", "aula_p4", "aula_p5", "aula_p6", "aula_p7",
    "centro_de_incubacion_e_innovacion_empresarial_ciie",
    "jefatura_de_gestion_empresarial", "psicologia",
  ]),
  ...make("p", "alta", [
    "aula_p8", "aula_p9", "aula_p10", "aula_p11", "aula_p12",
    "desarrollo_de_material_educativo", "director_general",
    "jefatura_de_planeacion", "sala_de_egresados", "sala_de_ex_directores",
  ]),

  // === Edificio L ===
  ...make("l", "baja", [
    "centro_de_carga_electrico", "jefatura_de_redes",
    "laboratorio_de_analisis_y_ciencia_de_datos_lacd",
    "laboratorio_de_computo_sistemas_lcs",
    "laboratorio_de_worstation_ibm_lwi",
    "paqueteria_vigilancia",
  ]),
  ...make("l", "alta", [
    "bodega_de_documentacion", "bodega_de_equipos",
    "encargado_de_laboratorios_de_sistemas",
    "jefatura_de_division_de_sistemas_computacionales",
    "laboratorio_de_desarrollo_de_software_lds",
    "laboratorio_de_ingenieria_de_software_lis",
    "laboratorio_de_inteligencia_artificial_lia",
    "laboratorio_de_redes_lr",
    "laboratorio_de_tecnologias_de_la_informacion_lti",
    "laboratorio_de_tecnologias_emergentes_let",
    "mantenimiento_y_telecomunicaciones", "sala_de_docentes",
  ]),
];

export const buscarSalones = (query: string, limit = 8): Salon[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SALONES.filter(
    (s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
  ).slice(0, limit);
};

export const findSalon = (id: string): Salon | undefined =>
  SALONES.find((s) => s.id === id);
