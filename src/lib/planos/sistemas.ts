// vtr-planos — sistemas de puertas con plano predefinido (puro, sin React).
// MILANO: puerta batiente + panel fijo, con perforaciones fijas por reglas de taller.
// TODO VISIÓN (con cerradura) y BATIENTE: puertas de una sola hoja con manillón de barra.
// Origen (0,0) esquina inferior izquierda, y hacia arriba. Todo en cm salvo el
// diámetro de perforación (mm), igual que el resto del modelo.

import type { Elemento, Esquina, Perforacion, Pieza } from "./modelo";

/** Medidas y opción de manillón que arma un juego MILANO (puerta + fijo). */
export interface AjustesMilano {
  anchoPuerta: number; // cm
  altoPuerta: number; // cm
  anchoFijo: number; // cm
  altoFijo: number; // cm
  manillon: "der" | "izq";
}

/** Rango habitual de trabajo del sistema (solo dispara avisos, no bloquea). */
export const MILANO_LIMITES = { minAncho: 50, maxAncho: 80, alto: 210, deltaPuerta: 1 };

function avisoAncho(nombre: string, w: number, avisos: string[]) {
  if (w < MILANO_LIMITES.minAncho || w > MILANO_LIMITES.maxAncho) {
    avisos.push(`El ancho de la ${nombre} está fuera del rango 50–80 cm`);
  }
}
function avisoAlto(nombre: string, h: number, avisos: string[]) {
  if (h !== MILANO_LIMITES.alto) {
    avisos.push(`El alto de la ${nombre} no es ${MILANO_LIMITES.alto} cm`);
  }
}

/** Arma la puerta y el panel fijo del sistema MILANO con sus perforaciones fijas. */
export function generarMilano(a: AjustesMilano): { puerta: Pieza; fijo: Pieza; avisos: string[] } {
  const W = a.anchoPuerta,
    H = a.altoPuerta;
  const Wf = a.anchoFijo,
    Hf = a.altoFijo;

  // Puerta: 4 perforaciones superiores (2 por lado) + manillón.
  const puertaEls: Perforacion[] = [
    { id: 1, tipo: "perforacion", dia: 16, x: 10, y: H - 3.5 },
    { id: 2, tipo: "perforacion", dia: 12, x: 10, y: H - 9 },
    { id: 3, tipo: "perforacion", dia: 16, x: W - 10, y: H - 3.5 },
    { id: 4, tipo: "perforacion", dia: 12, x: W - 10, y: H - 9 },
    { id: 5, tipo: "perforacion", dia: 45, x: a.manillon === "der" ? W - 6 : 6, y: 100 },
  ];

  // Panel fijo: 2 perforaciones superiores, una por lado.
  // 7 cm desde el tope hasta la perforación · 10 cm desde el borde vertical (altura).
  const fijoEls: Perforacion[] = [
    { id: 1, tipo: "perforacion", dia: 16, x: 10, y: Hf - 7 },
    { id: 2, tipo: "perforacion", dia: 16, x: Wf - 10, y: Hf - 7 },
  ];

  const puerta: Pieza = { ancho: W, alto: H, elementos: puertaEls };
  const fijo: Pieza = { ancho: Wf, alto: Hf, elementos: fijoEls };

  const avisos: string[] = [];
  avisoAncho("puerta", W, avisos);
  avisoAncho("panel fijo", Wf, avisos);
  // El fijo es la pieza de referencia (nominal 210); la puerta va derivada del fijo.
  avisoAlto("panel fijo", Hf, avisos);
  // La regla "1 cm menos" es sobre el ALTO: la puerta suele medir 1 cm menos que el fijo.
  if (H !== Hf - MILANO_LIMITES.deltaPuerta) {
    avisos.push("La puerta suele medir 1 cm menos de alto que el fijo");
  }

  return { puerta, fijo, avisos };
}

// ---- Puertas de una sola hoja: TODO VISIÓN (con cerradura) y BATIENTE ----
// Reglas de taller (Hendrix, 2026-07-20). Ambos sistemas comparten el manillón de
// barra: 2 perforaciones Ø15 en los extremos del manillón, eje a 10 cm del borde
// del lado del manillón. El centro del manillón va a la mitad del alto si la
// puerta mide 220 o menos; si es más alta, queda fijo a 110.

/** Medidas y manillón de una puerta de una sola hoja (todo visión / batiente). */
export interface AjustesPuertaSola {
  ancho: number; // cm
  alto: number; // cm
  manillon: "der" | "izq";
  largoManillon: number; // cm — las perforaciones van en los extremos
}

export const PUERTA_SOLA = {
  alto: 210, // alto estándar de ambos sistemas (solo avisa, no bloquea)
  topeCentro: 220, // hasta aquí el centro del manillón es alto/2
  centroFijo: 110, // pasado el tope, el centro se queda aquí
  sepManillon: 10, // cm del eje del manillón al borde de su lado
  diaManillon: 15, // Ø mm de cada perforación del manillón
  sepBisagra: 20, // cm del CENTRO de cada bisagra (batiente) al borde horizontal más cercano
};

/** Altura del herraje central (manillón / toallero): mitad del alto, fijo a 110 si la pieza pasa de 220. */
function centroAltura(alto: number): number {
  return alto <= PUERTA_SOLA.topeCentro ? alto / 2 : PUERTA_SOLA.centroFijo;
}

function perforacionesManillon(a: AjustesPuertaSola, desdeId: number): Perforacion[] {
  const centro = centroAltura(a.alto);
  const x = a.manillon === "der" ? a.ancho - PUERTA_SOLA.sepManillon : PUERTA_SOLA.sepManillon;
  const medio = a.largoManillon / 2;
  return [
    { id: desdeId, tipo: "perforacion", dia: PUERTA_SOLA.diaManillon, x, y: centro + medio },
    { id: desdeId + 1, tipo: "perforacion", dia: PUERTA_SOLA.diaManillon, x, y: centro - medio },
  ];
}

function avisosPuertaSola(a: AjustesPuertaSola): string[] {
  const avisos: string[] = [];
  if (a.alto !== PUERTA_SOLA.alto) avisos.push(`El alto de la puerta no es ${PUERTA_SOLA.alto} cm`);
  const centro = centroAltura(a.alto);
  if (centro - a.largoManillon / 2 < 0 || centro + a.largoManillon / 2 > a.alto) {
    avisos.push("El manillón no cabe: sus perforaciones caen fuera de la pieza");
  }
  return avisos;
}

/** TODO VISIÓN con cerradura: 3 tacas todo visión en esquina (la del lado del
 *  manillón hace de cerradura con el mismo tipo de taca) + manillón de barra.
 *  Con manillón a la derecha: sup-izq, inf-izq, inf-der; a la izquierda, en espejo. */
export function generarTodoVision(a: AjustesPuertaSola): { puerta: Pieza; avisos: string[] } {
  const esquinas: Esquina[] =
    a.manillon === "der" ? ["sup-izq", "inf-izq", "inf-der"] : ["sup-der", "inf-der", "inf-izq"];
  const els: Elemento[] = [
    // voltear: así lo pidió Hendrix viendo el plano (espejo horizontal de la forma).
    ...esquinas.map<Elemento>((esquina, i) => ({
      id: i + 1,
      tipo: "taca",
      clave: "todovision",
      borde: "inf",
      dist: 0,
      voltear: true,
      esquina,
    })),
    ...perforacionesManillon(a, 4),
  ];
  return { puerta: { ancho: a.ancho, alto: a.alto, elementos: els }, avisos: avisosPuertaSola(a) };
}

// ---- PUERTA TOALLERO: puerta (izquierda) + panel fijo (DERECHA) ----
// Reglas de taller (Hendrix, 2026-07-21). La puerta lleva 2 bisagras al borde
// izquierdo (centro a 20 del tope y del piso) y un TOALLERO de 3 perforaciones Ø15:
// margen = (ancho − toallero) / 2 a cada lado, pero si da más de 10 el toallero se
// fija a 10 cm del borde derecho; altura por centroAltura, y la perforación derecha
// lleva otra 15 cm (editable) más arriba. Fijo: 4 clips con centro a 20 cm — 2 en el
// piso (uno de cada lateral) y 2 en el borde izquierdo (piso y techo). Alto estándar
// fijo 210 / puerta 209 (puerta = fijo − 1, igual que MILANO).

export interface AjustesToallero {
  anchoPuerta: number; // cm
  altoPuerta: number; // cm
  anchoFijo: number; // cm
  altoFijo: number; // cm
  anchoToallero: number; // cm — separación entre las 2 perforaciones del toallero
  sepExtra: number; // cm — perforación extra sobre la derecha, estándar 15
}

export const TOALLERO = {
  alto: 210, // alto estándar del fijo (la puerta va derivada: fijo − 1)
  deltaPuerta: 1,
  margenMax: 10, // margen máximo del toallero al borde; si da más, se fija a 10 de la derecha
  dia: 15, // Ø mm de las 3 perforaciones
  sep: 20, // cm del centro de bisagras y clips a su borde más cercano
  anchoToallero: 45, // cm estándar
  sepExtra: 15, // cm estándar de la perforación extra
};

/** Arma la puerta y el panel fijo del sistema PUERTA TOALLERO. */
export function generarToallero(a: AjustesToallero): { puerta: Pieza; fijo: Pieza; avisos: string[] } {
  const W = a.anchoPuerta,
    H = a.altoPuerta;
  const s = TOALLERO.sep;

  const margen = (W - a.anchoToallero) / 2;
  const xDer = margen > TOALLERO.margenMax ? W - TOALLERO.margenMax : W - margen;
  const xIzq = xDer - a.anchoToallero;
  const y = centroAltura(H);

  const puertaEls: Elemento[] = [
    { id: 1, tipo: "taca", clave: "bisagra", borde: "izq", dist: s, voltear: false, desdeFin: true, alCentro: true },
    { id: 2, tipo: "taca", clave: "bisagra", borde: "izq", dist: s, voltear: false, alCentro: true },
    { id: 3, tipo: "perforacion", dia: TOALLERO.dia, x: xIzq, y },
    { id: 4, tipo: "perforacion", dia: TOALLERO.dia, x: xDer, y },
    { id: 5, tipo: "perforacion", dia: TOALLERO.dia, x: xDer, y: y + a.sepExtra },
  ];

  const fijoEls: Elemento[] = [
    { id: 1, tipo: "taca", clave: "clip", borde: "inf", dist: s, voltear: false, alCentro: true },
    { id: 2, tipo: "taca", clave: "clip", borde: "inf", dist: s, voltear: false, desdeFin: true, alCentro: true },
    { id: 3, tipo: "taca", clave: "clip", borde: "izq", dist: s, voltear: false, alCentro: true },
    { id: 4, tipo: "taca", clave: "clip", borde: "izq", dist: s, voltear: false, desdeFin: true, alCentro: true },
  ];

  const avisos: string[] = [];
  if (a.altoFijo !== TOALLERO.alto) avisos.push(`El alto del panel fijo no es ${TOALLERO.alto} cm`);
  if (H !== a.altoFijo - TOALLERO.deltaPuerta) avisos.push("La puerta suele medir 1 cm menos de alto que el fijo");
  if (margen < 0) avisos.push("El toallero es más ancho que la puerta");
  if (y + a.sepExtra > H) avisos.push("La perforación extra del toallero se sale de la pieza");

  return {
    puerta: { ancho: W, alto: H, elementos: puertaEls },
    fijo: { ancho: a.anchoFijo, alto: a.altoFijo, elementos: fijoEls },
    avisos,
  };
}

/** BATIENTE: 2 tacas de bisagra pegadas al borde contrario al manillón, cada una con
 *  su CENTRO a 20 cm del borde horizontal más cercano (la de arriba cota desde
 *  arriba) + manillón. */
export function generarBatiente(a: AjustesPuertaSola): { puerta: Pieza; avisos: string[] } {
  const bordeBisagras = a.manillon === "der" ? "izq" : "der";
  const els: Elemento[] = [
    { id: 1, tipo: "taca", clave: "bisagra", borde: bordeBisagras, dist: PUERTA_SOLA.sepBisagra, voltear: false, desdeFin: true, alCentro: true },
    { id: 2, tipo: "taca", clave: "bisagra", borde: bordeBisagras, dist: PUERTA_SOLA.sepBisagra, voltear: false, alCentro: true },
    ...perforacionesManillon(a, 3),
  ];
  return { puerta: { ancho: a.ancho, alto: a.alto, elementos: els }, avisos: avisosPuertaSola(a) };
}
