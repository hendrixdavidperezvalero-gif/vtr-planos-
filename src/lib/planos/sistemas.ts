// vtr-planos — sistemas de puertas con plano predefinido (puro, sin React).
// MILANO: puerta batiente + panel fijo, con perforaciones fijas por reglas de taller.
// Origen (0,0) esquina inferior izquierda, y hacia arriba. Todo en cm salvo el
// diámetro de perforación (mm), igual que el resto del modelo.

import type { Perforacion, Pieza } from "./modelo";

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
  const fijoEls: Perforacion[] = [
    { id: 1, tipo: "perforacion", dia: 16, x: 7, y: Hf - 10 },
    { id: 2, tipo: "perforacion", dia: 16, x: Wf - 7, y: Hf - 10 },
  ];

  const puerta: Pieza = { ancho: W, alto: H, elementos: puertaEls };
  const fijo: Pieza = { ancho: Wf, alto: Hf, elementos: fijoEls };

  const avisos: string[] = [];
  avisoAncho("puerta", W, avisos);
  avisoAncho("panel fijo", Wf, avisos);
  avisoAlto("puerta", H, avisos);
  avisoAlto("panel fijo", Hf, avisos);
  if (W !== Wf - MILANO_LIMITES.deltaPuerta) {
    avisos.push("La puerta suele medir 1 cm menos que el fijo");
  }

  return { puerta, fijo, avisos };
}
