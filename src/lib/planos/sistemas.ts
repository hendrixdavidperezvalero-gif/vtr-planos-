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
  sepBisagra: 20, // cm de cada bisagra (batiente) al borde horizontal más cercano
};

function perforacionesManillon(a: AjustesPuertaSola, desdeId: number): Perforacion[] {
  const centro = a.alto <= PUERTA_SOLA.topeCentro ? a.alto / 2 : PUERTA_SOLA.centroFijo;
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
  const centro = a.alto <= PUERTA_SOLA.topeCentro ? a.alto / 2 : PUERTA_SOLA.centroFijo;
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

/** BATIENTE: 2 tacas de bisagra pegadas al borde contrario al manillón, cada una a
 *  20 cm de su borde horizontal más cercano (la de arriba cota desde arriba) + manillón. */
export function generarBatiente(a: AjustesPuertaSola): { puerta: Pieza; avisos: string[] } {
  const bordeBisagras = a.manillon === "der" ? "izq" : "der";
  const els: Elemento[] = [
    { id: 1, tipo: "taca", clave: "bisagra", borde: bordeBisagras, dist: PUERTA_SOLA.sepBisagra, voltear: false, desdeFin: true },
    { id: 2, tipo: "taca", clave: "bisagra", borde: bordeBisagras, dist: PUERTA_SOLA.sepBisagra, voltear: false },
    ...perforacionesManillon(a, 3),
  ];
  return { puerta: { ancho: a.ancho, alto: a.alto, elementos: els }, avisos: avisosPuertaSola(a) };
}
