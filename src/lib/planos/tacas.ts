// vtr-planos — biblioteca de tacas. Geometría REAL calcada de los SVG del archivo
// de Figma "perforaciones de vidrio" (fileKey 4S4kAD1weUJeRWzzKTYE5Y). No se inventa
// ninguna forma: cada trazo viene del SVG exportado o de las primitivas del archivo.
//
// Sistema de coords nativo: cada taca en su propio viewBox (nvb). El borde del vidrio
// es el lado INFERIOR del nvb; la taca "entra" hacia arriba (ver geometria.ts).

import type { DefTaca, TacaClave } from "./modelo";

export const TACAS: Record<TacaClave, DefTaca> = {
  clip: {
    clave: "clip",
    nombre: "Clip pared/vidrio",
    ancho: 2.8,
    nvb: [147, 112],
    esquina: false,
    prims: [
      {
        t: "path",
        evenodd: true,
        d: "M74 0C90.5685 0 104 13.4315 104 30C104 36.273 102.073 42.0952 98.7812 46.9102L116.877 110H147V111H117.5V111.5H0V110.5H30.123L48.5195 46.3623L48.9297 46.4795C45.8144 41.7497 44 36.0871 44 30C44 13.4315 57.4315 0 74 0ZM31.1631 110.5H115.98L98.0391 47.9492C92.5682 55.2645 83.8374 60 74 60C63.786 60 54.7655 54.8947 49.3477 47.0977L31.1631 110.5Z",
      },
    ],
  },

  todovision: {
    clave: "todovision",
    nombre: "Taca todo visión",
    ancho: 3.0,
    nvb: [555, 160],
    esquina: true,
    prims: [
      { t: "path", linea: true, d: "M 0,40 C 120,44 250,45 345,49 L 410,92 L 468,158" },
      { t: "circle", cx: 524.5, cy: 30.5, r: 30.5 },
    ],
  },

  cerradura: {
    clave: "cerradura",
    nombre: "Cerradura",
    ancho: 3.0,
    nvb: [679, 191],
    esquina: true,
    prims: [{ t: "path", d: "M678.5 190.5V0.5H0.5V190.5H678.5Z" }],
  },

  con_freno: {
    clave: "con_freno",
    nombre: "Todo visión c/ freno",
    ancho: 4.5,
    nvb: [666, 197],
    esquina: true,
    prims: [{ t: "path", linea: true, d: "M0.5 197V0.5H665.5" }],
  },

  bisagra: {
    clave: "bisagra",
    nombre: "Bisagra pared/vidrio",
    ancho: 6.7,
    nvb: [483, 244],
    esquina: false,
    prims: [
      { t: "circle", cx: 50, cy: 50, r: 50 },
      { t: "circle", cx: 433, cy: 50, r: 50 },
      { t: "rect", x: 53, y: 54, w: 380, h: 190, rx: 24 },
    ],
  },

  cierre_suave: {
    clave: "cierre_suave",
    nombre: "Bisagra cierre suave",
    ancho: 6.8,
    nvb: [483, 570],
    esquina: false,
    prims: [
      { t: "circle", cx: 57.1, cy: 57.1, r: 57.1 },
      { t: "circle", cx: 425.9, cy: 65.2, r: 57.1 },
      { t: "rect", x: 53, y: 70.4, w: 380, h: 499.6, rx: 24 },
    ],
  },
};

/** Lista ordenada de menor a mayor ancho, para poblar selects. */
export const TACAS_LISTA: DefTaca[] = [
  TACAS.clip,
  TACAS.todovision,
  TACAS.cerradura,
  TACAS.con_freno,
  TACAS.bisagra,
  TACAS.cierre_suave,
];
