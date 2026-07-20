// vtr-planos — geometría de colocación (pura). Convierte la definición nativa de una
// taca (px de Figma) a su lugar sobre un borde de la pieza (cm), vía transforms SVG.
//
// Cadena de transforms (se aplican de fuera hacia adentro sobre el trazo nativo):
//   matBorde  ∘  [matVoltear]  ∘  matNativoACanonico  ∘  trazo nativo
//
// Canónico = borde del vidrio en y=0, la taca entra hacia +y. La pieza se dibuja en
// cm con y hacia arriba (origen esquina inferior izquierda).

import type { Borde, DefTaca, Esquina } from "./modelo";

/** Nativo (px, y hacia abajo) → canónico (cm, borde en y=0, entra hacia +y). */
export function matNativoACanonico(t: DefTaca): string {
  const f = t.ancho / t.nvb[0]; // cm por px
  return `matrix(${f},0,0,${-f},0,${t.nvb[1] * f})`;
}

/** Espejo a lo largo del borde (voltear la taca). */
export function matVoltear(t: DefTaca): string {
  return `matrix(-1,0,0,1,${t.ancho},0)`;
}

/** Canónico → pieza (cm), según el borde y la distancia de la esquina al inicio.
 *  Con `desdeFin` la dist se mide desde el OTRO extremo del borde (arriba en los
 *  verticales, derecha en los horizontales) y la taca entra hacia la esquina base;
 *  el anclaje queda en el extremo medido, así el boost visual no miente la cota. */
export function matBorde(borde: Borde, dist: number, W: number, H: number, desdeFin = false): string {
  switch (borde) {
    case "inf":
      return desdeFin ? `matrix(-1,0,0,1,${W - dist},0)` : `matrix(1,0,0,1,${dist},0)`;
    case "sup":
      return desdeFin ? `matrix(-1,0,0,-1,${W - dist},${H})` : `matrix(1,0,0,-1,${dist},${H})`;
    case "izq":
      return desdeFin ? `matrix(0,-1,1,0,0,${H - dist})` : `matrix(0,1,1,0,0,${dist})`;
    case "der":
      return desdeFin ? `matrix(0,-1,-1,0,${W},${H - dist})` : `matrix(0,1,-1,0,${W},${dist})`;
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
  desdeFin = false,
  alCentro = false,
): string {
  // alCentro: dist apunta al CENTRO de la taca — el inicio real queda medio ancho
  // antes, y el boost se ancla al centro para que la cota siga siendo cierta.
  const d0 = alCentro ? dist - t.ancho / 2 : dist;
  const partes = [matBorde(borde, d0, W, H, desdeFin)];
  if (escala !== 1) partes.push(`matrix(${escala},0,0,${escala},${alCentro ? -((escala - 1) * t.ancho) / 2 : 0},0)`);
  if (voltear) partes.push(matVoltear(t));
  partes.push(matNativoACanonico(t));
  return partes.join(" ");
}

/** Transform para una taca DE ESQUINA: pegada a la esquina indicada. Las esquinas
 *  derechas llevan espejo horizontal para que la forma abra hacia el vidrio.
 *  Por defecto la taca va VOLTEADA para que su espacio abierto dé a la esquina;
 *  el flag `voltear` la devuelve al derecho si un herraje lo pide. */
export function transformTacaEsquina(
  t: DefTaca,
  esq: Esquina,
  W: number,
  H: number,
  escala = 1,
  voltear = false,
): string {
  const base =
    esq === "inf-izq"
      ? "matrix(1,0,0,1,0,0)"
      : esq === "inf-der"
        ? `matrix(-1,0,0,1,${W},0)`
        : esq === "sup-izq"
          ? `matrix(1,0,0,-1,0,${H})`
          : `matrix(-1,0,0,-1,${W},${H})`;
  const partes = [base];
  if (escala !== 1) partes.push(`matrix(${escala},0,0,${escala},0,0)`);
  if (!voltear) partes.push(matVoltear(t));
  partes.push(matNativoACanonico(t));
  return partes.join(" ");
}

/** Extremos de la cota de una taca (esquina → inicio), en pieza cm.
 *  Con `desdeFin` la cota sale de la esquina opuesta del borde. */
export function cotaTaca(
  borde: Borde,
  dist: number,
  W: number,
  H: number,
  desdeFin = false,
): { a: [number, number]; b: [number, number] } {
  switch (borde) {
    case "inf":
      return desdeFin ? { a: [W, 0], b: [W - dist, 0] } : { a: [0, 0], b: [dist, 0] };
    case "sup":
      return desdeFin ? { a: [W, H], b: [W - dist, H] } : { a: [0, H], b: [dist, H] };
    case "izq":
      return desdeFin ? { a: [0, H], b: [0, H - dist] } : { a: [0, 0], b: [0, dist] };
    case "der":
      return desdeFin ? { a: [W, H], b: [W, H - dist] } : { a: [W, 0], b: [W, dist] };
  }
}
