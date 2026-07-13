// vtr-planos — modelo de dominio (puro, sin React).
// Una PIEZA de vidrio lleva PERFORACIONES (agujeros redondos) y TACAS (escotaduras
// del canto). Origen (0,0) = esquina inferior izquierda. Todo en centímetros salvo
// el diámetro de la perforación, que va en milímetros (así lo pide el taller).
//
// Regla de cota de una taca: de la esquina del borde AL INICIO de la taca (no al centro).

/** Borde de la pieza sobre el que se apoya una taca. */
export type Borde = "inf" | "sup" | "izq" | "der";

export const BORDES: { valor: Borde; nombre: string }[] = [
  { valor: "inf", nombre: "Inferior" },
  { valor: "sup", nombre: "Superior" },
  { valor: "izq", nombre: "Izquierda" },
  { valor: "der", nombre: "Derecha" },
];

/** Diámetros de broca disponibles (mm). Vocabulario cerrado: la vendedora elige de aquí. */
export const DIAMETROS = [5, 6, 8, 10, 11, 12, 13, 15, 16, 19, 20, 22, 25, 28, 30, 40, 45, 55, 70];

/** Perforación redonda, colocada por coordenada interior. */
export interface Perforacion {
  id: number;
  tipo: "perforacion";
  dia: number; // diámetro en mm
  x: number;   // cm desde la izquierda
  y: number;   // cm desde abajo
}

/** Taca (escotadura de canto) apoyada en un borde. */
export interface Taca {
  id: number;
  tipo: "taca";
  clave: TacaClave;
  borde: Borde;
  dist: number;     // cm de la esquina del borde al INICIO de la taca
  voltear: boolean; // espejo a lo largo del borde
}

export type Elemento = Perforacion | Taca;

/** Pieza de vidrio con sus elementos. */
export interface Pieza {
  ancho: number; // cm (dimensión X)
  alto: number;  // cm (dimensión Y)
  elementos: Elemento[];
}

// ---- Tacas: claves y definición geométrica (geometría real, calcada de Figma) ----

export type TacaClave =
  | "clip"
  | "todovision"
  | "cerradura"
  | "con_freno"
  | "bisagra"
  | "cierre_suave";

/** Primitiva de dibujo en coordenadas nativas del SVG de Figma. */
export type Primitiva =
  | { t: "path"; d: string; linea?: boolean; evenodd?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number };

/** Definición de una taca: geometría nativa + su ancho real (la cota que manda). */
export interface DefTaca {
  clave: TacaClave;
  nombre: string;
  ancho: number;          // cm (dimensión que manda)
  nvb: [number, number];  // ancho, alto nativos del SVG (px de Figma)
  esquina: boolean;       // va en una esquina (dist ~ 0)
  prims: Primitiva[];     // trazos en coords nativas
}
