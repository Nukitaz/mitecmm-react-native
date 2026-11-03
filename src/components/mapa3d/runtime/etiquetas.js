/*
 * MiTecmm · Etiquetas de espacios (fuente única).
 *
 * Convierte IDs técnicos del plano SVG (p. ej. "jefatura_de_division_de_sistemas_computacionales")
 * en textos para personas. Lo usan:
 *  - el motor 3D (script clásico en el iframe / WebView) como global `MiTecmmEtiquetas`
 *  - la app React (import CommonJS, tipos en etiquetas.d.ts)
 *
 * ES5 sin dependencias. Después de editarlo ejecuta:  npm run vendor
 */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.MiTecmmEtiquetas = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PALABRAS_VACIAS = { de: 1, del: 1, la: 1, las: 1, el: 1, los: 1, y: 1, e: 1, en: 1, para: 1, a: 1 };

  /** Palabras con acento (el ID nunca los trae). */
  var ACENTOS = {
    analisis: "análisis", bano: "baño", basicas: "básicas", cafeteria: "cafetería", arquitectonico: "arquitectónico", almacen: "almacén", area: "área",
    coordinacion: "coordinación", computo: "cómputo", cocteleria: "coctelería", cubiculo: "cubículo",
    diseno: "diseño", direccion: "dirección", division: "división", documentacion: "documentación",
    electromecanica: "electromecánica", electrico: "eléctrico", fisica: "física", gastronomia: "gastronomía",
    gestion: "gestión", hidraulica: "hidráulica", incubacion: "incubación", informacion: "información",
    ingenieria: "ingeniería", innovacion: "innovación", inteligencia: "inteligencia", juridica: "jurídica",
    medico: "médico", metodos: "métodos", metrologia: "metrología", paqueteria: "paquetería",
    planeacion: "planeación", psicologia: "psicología", quimica: "química", tecnologias: "tecnologías",
    titulacion: "titulación", tutorias: "tutorías", vinculacion: "vinculación", administracion: "administración",
    telecomunicaciones: "telecomunicaciones",
  };

  /** Abreviaturas para que el nombre quepa en la etiqueta 3D. */
  var ABREVIATURAS = {
    administracion: "ADMIN.", arquitectura: "ARQ.", computacionales: "COMP.", desarrollo: "DESARR.",
    division: "DIV.", documentacion: "DOCUM.", educativo: "EDUC.", electromecanica: "ELECTROMEC.",
    empresarial: "EMPRES.", escolares: "ESCOLARES", gastronomia: "GASTRON.", generales: "GRALES.",
    gestion: "GESTIÓN", industrial: "IND.", informacion: "INFORM.", ingenieria: "ING.", ing: "ING.",
    innovacion: "INNOV.", incubacion: "INCUB.", laboratorio: "LAB.", laboratorios: "LABS.",
    mantenimiento: "MANT.", material: "MAT.", servicios: "SERV.", sistemas: "SIST.",
    tecnologias: "TEC.", telecomunicaciones: "TELECOM.", ventanillas: "VENTANILLAS",
  };

  /** Primera palabra del ID -> categoría (línea superior de la etiqueta). */
  var CATEGORIAS = {
    aula: "AULA", laboratorio: "LAB", laboratorios: "LAB", jefatura: "JEFATURA",
    coordinacion: "COORDINACIÓN", sala: "SALA", area: "ÁREA", almacen: "ALMACÉN", bodega: "BODEGA",
    archivo: "ARCHIVO", taller: "TALLER", oficina: "OFICINA", centro: "CENTRO", encargado: "ENCARGADO",
    consultorio: "CONSULTORIO", director: "DIRECCIÓN", direccion: "DIRECCIÓN",
  };
  /** Categorías cuyo último token suele ser una sigla (LTI, LR, CIIE, EM4…). */
  var CON_SIGLA = { LAB: 1, CENTRO: 1, BODEGA: 1 };

  function tokens(id) {
    return String(id || "").toLowerCase().replace(/[^a-z0-9_]/g, "").split("_").filter(Boolean);
  }

  function esSigla(token) {
    return /\d/.test(token) || (token.length <= 4 && !PALABRAS_VACIAS[token] && !ACENTOS[token]);
  }

  function mayusculas(palabra) {
    return (ACENTOS[palabra] || palabra).toUpperCase();
  }

  /** Tipo de servicio (icono naranja) o null si es un espacio normal. */
  function tipoServicio(id) {
    var t = String(id || "").toLowerCase();
    if (t.indexOf("bano") !== -1 || t.indexOf("sanitario") !== -1 || /(^|_)wc(_|$)/.test(t)) return "restroom";
    if (t.indexOf("medico") !== -1 || t.indexOf("consultorio") !== -1 || t.indexOf("enfermeria") !== -1) return "medical";
    if (t.indexOf("vigilancia") !== -1 || t.indexOf("paqueteria") !== -1 || t.indexOf("seguridad") !== -1) return "security";
    if (t.indexOf("escalera") !== -1) return "stairs";
    if (t.indexOf("centro_de_carga") !== -1 || t.indexOf("subestacion") !== -1) return "electric";
    return null;
  }

  /**
   * Texto de la etiqueta 3D: { categoria, codigo }.
   * aula_a3 -> AULA / A3 · laboratorio_de_redes_lr -> LAB / LR
   * jefatura_de_division_de_sistemas_computacionales -> JEFATURA / DIV. SIST. COMP.
   */
  function etiqueta(id) {
    var t = tokens(id);
    if (!t.length) return { categoria: "", codigo: "" };

    var categoria = CATEGORIAS[t[0]] || "";
    var resto = categoria ? t.slice(1) : t.slice(0);

    if (t[0] === "aula" && resto.length === 1) return { categoria: "AULA", codigo: resto[0].toUpperCase() };

    var ultimo = resto[resto.length - 1];
    if (CON_SIGLA[categoria] && resto.length > 1 && esSigla(ultimo)) {
      return { categoria: categoria, codigo: ultimo.toUpperCase() };
    }

    var significativas = resto.filter(function (p) { return !PALABRAS_VACIAS[p]; });
    if (!significativas.length) return { categoria: "", codigo: mayusculas(t[0]) };

    // Una sola palabra: completa (con acento). Varias: abreviadas, máximo 3.
    var codigo = significativas.length === 1
      ? mayusculas(significativas[0])
      : significativas.slice(0, 3).map(function (p) {
          return /\d/.test(p) ? p.toUpperCase() : ABREVIATURAS[p] || mayusculas(p);
        }).join(" ");
    return { categoria: categoria, codigo: codigo };
  }

  /**
   * Nombre legible para personas (avisos, accesibilidad):
   * aula_a3 -> "Aula A3" · laboratorio_de_redes_lr -> "Laboratorio de redes (LR)"
   * bodega_em4 -> "Bodega EM4" · taller_restiradores_20 -> "Taller restiradores 20"
   */
  function nombreLegible(id) {
    var t = tokens(id);
    if (!t.length) return "";
    if (t[0] === "aula" && t.length === 2) return "Aula " + (t[1] === "magna" ? "magna" : t[1].toUpperCase());

    var categoria = CATEGORIAS[t[0]] || "";
    var sigla = "";
    if (CON_SIGLA[categoria] && t.length >= 2 && esSigla(t[t.length - 1]) && !/^\d+$/.test(t[t.length - 1])) {
      sigla = t.pop().toUpperCase();
    }
    var palabras = t.map(function (p, i) {
      if (PALABRAS_VACIAS[p] && i > 0) return p;
      if (/\d/.test(p)) return p.toUpperCase();
      var conAcento = ACENTOS[p] || p;
      return i === 0 ? conAcento.charAt(0).toUpperCase() + conAcento.slice(1) : conAcento;
    });
    var texto = palabras.join(" ");
    if (sigla) texto += t.length === 1 ? " " + sigla : " (" + sigla + ")";
    return texto;
  }

  return { tipoServicio: tipoServicio, etiqueta: etiqueta, nombreLegible: nombreLegible };
});
