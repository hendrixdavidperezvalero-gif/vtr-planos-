// vtr-planos — geometría de colocación (pura). Convierte la definición nativa de una
// taca (px de Figma) a su lugar sobre un borde de la pieza (cm), vía transforms SVG.
//
// Cadena de transforms (se aplican de fuera hacia adentro sobre el trazo nativo):
//   matBorde  ∘  [matVoltear]  ∘  matNativoACanonico  ∘  trazo nativo
//
// Canónico = borde del vidrio en y=0, la taca entra hacia +y. La pieza se dibuja en
// cm con y hacia arriba (origen esquina inferior izquierda).

import type { Borde, DefTaca } from "./modelo";

/** Nativo (px, y hacia abajo) → canónico (cm, borde en y=0, entra hacia +y). */
export function matNativoACanonico(t: DefTaca): string {
  const f = t.ancho / t.nvb[0]; // cm por px
  return `matrix(${f},0,0,${-f},0,${t.nvb[1] * f})`;
}

/** Espejo a lo largo del borde (voltear la taca). */
export function matVoltear(t: DefTaca): string {
  return `matrix(-1,0,0,1,${t.ancho},0)`;
}

/** Canónico → pieza (cm), según el borde y la distancia de la esquina al inicio. */
export function matBorde(borde: Borde, dist: number, W: number, H: number): string {
  switch (borde) {
    case "inf":
      return `matrix(1,0,0,1,${dist},0)`;
    case "sup":
      return `matrix(1,0,0,-1,${dist},${H})`;
    case "izq":
      return `matrix(0,1,1,0,0,${dist})`;
    case "der":
      return `matrix(0,1,-1,0,${W},${dist})`;
  }
}

/** Transform SVG completo para colocar una taca (todo en espacio de pieza cm).
 *  `escala` agranda el dibujo SOLO como referencia visual (anclado al inicio de
 *  la taca, así la cota de inicio sigue siendo cierta aunque no sea proporcional). */
export function transformTaca(
  t: DefTaca,
  borde: Borde,
  dist: number,
  voltear: boolean,
  W: number,
  H: number,
  escala = 1,
): string {
  const partes = [matBorde(borde, dist, W, H)];
  if (escala !== 1) partes.push(`matrix(${escala},0,0,${escala},0,0)`);
  if (voltear) partes.push(matVoltear(t));
  partes.push(matNativoACanonico(t));
  return partes.join(" ");
}

/** Extremos de la cota de una taca (esquina → inicio), en pieza cm. */
export function cotaTaca(
  borde: Borde,
  dist: number,
  W: number,
  H: number,
): { a: [number, number]; b: [number, number] } {
  switch (borde) {
    case "inf":
      return { a: [0, 0], b: [dist, 0] };
    case "sup":
      return { a: [0, H], b: [dist, H] };
    case "izq":
      return { a: [0, 0], b: [0, dist] };
    case "der":
      return { a: [W, 0], b: [W, dist] };
  }
}
