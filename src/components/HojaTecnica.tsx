// vtr-planos — HojaTecnica: render de "plano de taller clásico" (hoja blanca, cotas
// con líneas de extensión y ticks a 45°, número grande de pieza al centro, notas al
// pie) con toques VTR (número/oro). Reemplaza al render de PiezaSVG en el bloque de
// impresión, en el export PNG y es el render principal del modo MILANO.
//
// Mismas convenciones que el resto de /lib/planos: unidades de usuario SVG = cm
// reales (mm solo para diámetro), origen (0,0) esquina inferior izquierda, y hacia
// arriba. Cada pieza se dibuja dentro de un <g> con flip (translate+scale -1) para
// la geometría; los textos y cotas viven FUERA de ese flip (usan `map`) para no
// salir espejados.

import type { Borde, Perforacion, Pieza, Taca, TacaClave } from "@/lib/planos/modelo";
import { TACAS } from "@/lib/planos/tacas";
import { cotaTaca, transformTaca, transformTacaEsquina } from "@/lib/planos/geometria";

// Estilos embebidos en el propio SVG (colores literales, sin var(): el PNG
// serializado se rinde aislado del documento y debe conservar la paleta).
const HT_CSS = `
text{font-family:Inter,system-ui,sans-serif}
.ht-vidrio{fill:#eef4f0;stroke:#1a1a1a}
.ht-hole{fill:#ffffff;stroke:#1a1a1a}
.ht-cross{stroke:#1a1a1a}
.ht-ext{stroke:#1a1a1a;stroke-opacity:.45;fill:none}
.ht-dim{stroke:#1a1a1a;fill:none}
.ht-dimtxt{fill:#1a1a1a;font-weight:600}
.ht-num{fill:#1a1a1a;fill-opacity:.85;font-weight:800}
.ht-titulo{fill:#9d7a1f;font-weight:800;letter-spacing:.14em}
.ht-dia{fill:#9d7a1f;font-weight:700}
.ht-nota{fill:#1a1a1a}
.ht-taca{fill:#ffffff;stroke:#1a1a1a}
.ht-taca-linea{fill:none;stroke:#1a1a1a}
`;

const S0 = 3.2; // px por cm base (se multiplica por el zoom), igual que PiezaSVG
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Factor de agrandado visual de una taca (igual criterio que en page.tsx: garantiza
// un ancho dibujado mínimo relativo a la pieza, sin tocar la cota real).
function boostTaca(anchoReal: number, m: number): number {
  return Math.max(1, (m * 0.09) / anchoReal);
}

/** Trazos de una taca (coords nativas), variante de estilo "hoja técnica". */
function TacaPrimsHT({ clave }: { clave: TacaClave }) {
  const def = TACAS[clave];
  return (
    <>
      {def.prims.map((p, i) => {
        if (p.t === "path")
          return (
            <path
              key={i}
              className={p.linea ? "ht-taca-linea" : "ht-taca"}
              d={p.d}
              fillRule={p.evenodd ? "evenodd" : undefined}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        if (p.t === "circle")
          return (
            <circle key={i} className="ht-taca" cx={p.cx} cy={p.cy} r={p.r} vectorEffect="non-scaling-stroke" strokeWidth={1.9} />
          );
        return (
          <rect
            key={i}
            className="ht-taca"
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            rx={p.rx}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.9}
          />
        );
      })}
    </>
  );
}

// Un elemento a la hoja: la pieza + su número grande + su título opcional.
export interface PiezaHoja {
  pieza: Pieza;
  titulo?: string; // "PUERTA", "PANEL FIJO"… al centro de la pieza
}

type MapFn = (x: number, y: number) => [number, number];

// ---- Acumuladores de cotas por margen (perforaciones + tacas confluyen aquí) ----
interface AcumVert {
  side: "izq" | "der";
  yRef: number; // borde de referencia (H o 0)
  valor: number; // valor redondeado a 0.1 (dy de perforación o dist de taca)
  puntos: number[]; // x de cada agujero/inicio de taca que aporta a esta cota
}
interface AcumHoriz {
  side: "sup" | "inf";
  xRef: number; // borde de referencia (0 o W)
  valor: number;
  puntos: number[]; // y de cada agujero/inicio de taca que aporta a esta cota
}

function addVert(mapa: Map<string, AcumVert>, side: "izq" | "der", yRef: number, x: number, valorCrudo: number) {
  const valor = Math.round(valorCrudo * 10) / 10;
  const key = `${side}|${yRef}|${valor}`;
  let e = mapa.get(key);
  if (!e) {
    e = { side, yRef, valor, puntos: [] };
    mapa.set(key, e);
  }
  e.puntos.push(x);
}
function addHoriz(mapa: Map<string, AcumHoriz>, side: "sup" | "inf", xRef: number, y: number, valorCrudo: number) {
  const valor = Math.round(valorCrudo * 10) / 10;
  const key = `${side}|${xRef}|${valor}`;
  let e = mapa.get(key);
  if (!e) {
    e = { side, xRef, valor, puntos: [] };
    mapa.set(key, e);
  }
  e.puntos.push(y);
}

// Nivel de apilado de cotas de un margen: cada cota toma el primer nivel donde su
// tramo no solapa con otra ya colocada — así las cotas espejadas ("10" desde cada
// lado) comparten nivel como en un plano de taller, y una cota larga no pisa a las
// cortas. Se colocan de menor a mayor tramo (las cortas quedan pegadas a la pieza).
function nivelesSinSolape(spans: [number, number][]): { nivel: number[]; usados: number } {
  const capas: [number, number][][] = [];
  const nivel = new Array<number>(spans.length).fill(0);
  const orden = spans.map((_, i) => i).sort((a, b) => spans[a][1] - spans[a][0] - (spans[b][1] - spans[b][0]));
  for (const i of orden) {
    const [s, e] = spans[i];
    let n = 0;
    while (capas[n]?.some(([s2, e2]) => s < e2 && s2 < e)) n++;
    (capas[n] ??= []).push([s, e]);
    nivel[i] = n;
  }
  return { nivel, usados: capas.length };
}

// Tick de 45° (línea corta) centrado en (px,py).
function tick(px: number, py: number, m: number, key: string) {
  const h = m * 0.014 * 0.5 * Math.SQRT1_2;
  return <line key={key} className="ht-dim" x1={px - h} y1={py - h} x2={px + h} y2={py + h} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
}

// Dimensión vertical (margen izq/der): línea de cota vertical, extensiones desde el
// agujero/taca y desde la esquina de referencia, ticks y texto rotado −90°.
function dimVert(key: string, side: "izq" | "der", yRef: number, valor: number, puntosX: number[], off: number, W: number, H: number, m: number, fsDim: number, map: MapFn) {
  const xEdge = side === "izq" ? 0 : W;
  const xLine = side === "izq" ? -off : W + off;
  const over = side === "izq" ? -m * 0.008 : m * 0.008;
  const yPoint = yRef === H ? H - valor : valor;
  const [lax, lay] = map(xLine, yRef);
  const [lbx, lby] = map(xLine, yPoint);
  const [cax, cay] = map(xEdge, yRef);
  const [cbx, cby] = map(xLine + over, yRef);
  const midY = (lay + lby) / 2;
  const dir = side === "izq" ? -1 : 1;
  return (
    <g key={key}>
      <line className="ht-ext" x1={cax} y1={cay} x2={cbx} y2={cby} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {puntosX.map((px, i) => {
        const [x1, y1] = map(px, yPoint);
        const [x2, y2] = map(xLine + over, yPoint);
        return <line key={i} className="ht-ext" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
      })}
      <line className="ht-dim" x1={lax} y1={lay} x2={lbx} y2={lby} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      {tick(lax, lay, m, "t1")}
      {tick(lbx, lby, m, "t2")}
      <text className="ht-dimtxt" transform={`translate(${xLine + dir * fsDim * 0.45}, ${midY}) rotate(-90)`} textAnchor="middle" fontSize={fsDim}>
        {fmt(valor)}
      </text>
    </g>
  );
}

// Dimensión horizontal (margen sup/inf): análoga a dimVert pero en el eje X.
function dimHoriz(key: string, side: "sup" | "inf", xRef: number, valor: number, puntosY: number[], off: number, W: number, H: number, m: number, fsDim: number, map: MapFn) {
  const yEdge = side === "sup" ? H : 0;
  const yLine = side === "sup" ? H + off : -off;
  const over = side === "sup" ? m * 0.008 : -m * 0.008;
  const xPoint = xRef === 0 ? valor : W - valor;
  const [lax, lay] = map(xRef, yLine);
  const [lbx, lby] = map(xPoint, yLine);
  const [cax, cay] = map(xRef, yEdge);
  const [cbx, cby] = map(xRef, yLine + over);
  const midX = (lax + lbx) / 2;
  const textY = side === "sup" ? lay - fsDim * 0.5 : lay + fsDim * 1.1;
  return (
    <g key={key}>
      <line className="ht-ext" x1={cax} y1={cay} x2={cbx} y2={cby} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {puntosY.map((py, i) => {
        const [x1, y1] = map(xPoint, py);
        const [x2, y2] = map(xPoint, yLine + over);
        return <line key={i} className="ht-ext" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
      })}
      <line className="ht-dim" x1={lax} y1={lay} x2={lbx} y2={lby} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      {tick(lax, lay, m, "t1")}
      {tick(lbx, lby, m, "t2")}
      <text className="ht-dimtxt" x={midX} y={textY} textAnchor="middle" fontSize={fsDim}>
        {fmt(valor)}
      </text>
    </g>
  );
}

// ---- Bloque de una pieza dentro de la hoja ----
function PiezaBloque({ ph, originX, padSup, m }: { ph: PiezaHoja; originX: number; padSup: number; m: number }) {
  const { pieza, titulo } = ph;
  const W = pieza.ancho,
    H = pieza.alto;
  const fsDim = m * 0.02; // texto de cotas
  const fsDia = m * 0.017; // etiqueta de diámetro (un punto menor que la cota)
  const fsTitulo = m * 0.024;
  const OFF0 = m * 0.045,
    OFFSTEP = m * 0.036;
  const map: MapFn = (x, y) => [x, H - y];

  const perfs = pieza.elementos.filter((e): e is Perforacion => e.tipo === "perforacion");
  const tacas = pieza.elementos.filter((e): e is Taca => e.tipo === "taca" && !e.esquina);
  const tacasEsquina = pieza.elementos.filter((e): e is Taca => e.tipo === "taca" && !!e.esquina);

  // ---- Acumular cotas de perforaciones y tacas por margen ----
  const vertMap = new Map<string, AcumVert>();
  const horizMap = new Map<string, AcumHoriz>();

  perfs.forEach((h) => {
    const ladoX: "izq" | "der" = h.x <= W / 2 ? "izq" : "der";
    const dx = ladoX === "izq" ? h.x : W - h.x;
    const ladoY: "sup" | "inf" = h.y >= H / 2 ? "sup" : "inf";
    const dy = ladoY === "sup" ? H - h.y : h.y;
    const yRef = ladoY === "sup" ? H : 0;
    const xRef = ladoX === "izq" ? 0 : W;
    addVert(vertMap, ladoX, yRef, h.x, dy);
    addHoriz(horizMap, ladoY, xRef, h.y, dx);
  });
  tacas.forEach((t) => {
    const { a, b } = cotaTaca(t.borde, t.dist, W, H);
    if (t.borde === "izq") addVert(vertMap, "izq", a[1], b[0], t.dist);
    else if (t.borde === "der") addVert(vertMap, "der", a[1], b[0], t.dist);
    else if (t.borde === "inf") addHoriz(horizMap, "inf", a[0], b[1], t.dist);
    else addHoriz(horizMap, "sup", a[0], b[1], t.dist);
  });

  const izqList = [...vertMap.values()].filter((e) => e.side === "izq").sort((a, b) => a.valor - b.valor);
  const derList = [...vertMap.values()].filter((e) => e.side === "der").sort((a, b) => a.valor - b.valor);
  const supList = [...horizMap.values()].filter((e) => e.side === "sup").sort((a, b) => a.valor - b.valor);
  const infList = [...horizMap.values()].filter((e) => e.side === "inf").sort((a, b) => a.valor - b.valor);

  // tramo que cubre cada cota sobre su borde (para repartir niveles sin solape)
  const spanVert = (e: AcumVert): [number, number] => (e.yRef === H ? [H - e.valor, H] : [0, e.valor]);
  const spanHoriz = (e: AcumHoriz): [number, number] => (e.xRef === 0 ? [0, e.valor] : [W - e.valor, W]);
  const izqNiv = nivelesSinSolape(izqList.map(spanVert));
  const derNiv = nivelesSinSolape(derList.map(spanVert));
  const supNiv = nivelesSinSolape(supList.map(spanHoriz));
  const infNiv = nivelesSinSolape(infList.map(spanHoriz));

  return (
    <g transform={`translate(${originX}, ${padSup})`}>
      {/* geometría en cm, y hacia arriba */}
      <g transform={`translate(0,${H}) scale(1,-1)`}>
        <rect className="ht-vidrio" x={0} y={0} width={W} height={H} vectorEffect="non-scaling-stroke" strokeWidth={2.5} />

        {perfs.map((h) => {
          const r = Math.max(h.dia / 20, m * 0.007);
          return (
            <g key={h.id}>
              <circle className="ht-hole" cx={h.x} cy={h.y} r={r} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <line className="ht-cross" x1={h.x - r * 1.4} y1={h.y} x2={h.x + r * 1.4} y2={h.y} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
              <line className="ht-cross" x1={h.x} y1={h.y - r * 1.4} x2={h.x} y2={h.y + r * 1.4} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}

        {tacasEsquina.map((t) => {
          const def = TACAS[t.clave];
          const k = boostTaca(def.ancho, m);
          const tr = transformTacaEsquina(def, t.esquina!, W, H, k, t.voltear);
          return (
            <g key={t.id} transform={tr}>
              <TacaPrimsHT clave={t.clave} />
            </g>
          );
        })}
        {tacas.map((t) => {
          const def = TACAS[t.clave];
          const k = boostTaca(def.ancho, m);
          const tr = transformTaca(def, t.borde, t.dist, t.voltear, W, H, k);
          return (
            <g key={t.id} transform={tr}>
              <TacaPrimsHT clave={t.clave} />
            </g>
          );
        })}
      </g>

      {/* título al centro (sin número: se confunde con la cantidad de piezas) */}
      {titulo && (
        <text className="ht-titulo" x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontSize={fsTitulo}>
          {titulo.toUpperCase()}
        </text>
      )}

      {/* cotas de perforaciones y tacas, apiladas por margen (nivel = sin solape de tramos) */}
      {izqList.map((e, i) => dimVert(`iz${i}`, "izq", e.yRef, e.valor, e.puntos, OFF0 + izqNiv.nivel[i] * OFFSTEP, W, H, m, fsDim, map))}
      {derList.map((e, i) => dimVert(`de${i}`, "der", e.yRef, e.valor, e.puntos, OFF0 + derNiv.nivel[i] * OFFSTEP, W, H, m, fsDim, map))}
      {supList.map((e, i) => dimHoriz(`su${i}`, "sup", e.xRef, e.valor, e.puntos, OFF0 + supNiv.nivel[i] * OFFSTEP, W, H, m, fsDim, map))}
      {infList.map((e, i) => dimHoriz(`in${i}`, "inf", e.xRef, e.valor, e.puntos, OFF0 + infNiv.nivel[i] * OFFSTEP, W, H, m, fsDim, map))}

      {/* cotas totales: ancho abajo (nivel más externo del margen inf), alto a la derecha (nivel más externo del margen der) */}
      {dimHoriz("totW", "inf", 0, W, [0], OFF0 + infNiv.usados * OFFSTEP, W, H, m, fsDim, map)}
      {dimVert("totH", "der", 0, H, [W], OFF0 + derNiv.usados * OFFSTEP, W, H, m, fsDim, map)}

      {/* etiqueta de diámetro en CADA perforación: siempre debe quedar claro su tamaño.
          Se ancla a la ALTURA de su propio agujero y se desplaza sólo en horizontal
          hacia el centro, para que agujeros vecinos (misma x) no encimen sus etiquetas. */}
      {perfs.map((h) => {
        const r = Math.max(h.dia / 20, m * 0.007);
        const haciaCentro = h.x <= W / 2 ? 1 : -1; // +1 = etiqueta a la derecha del agujero
        const [sx, sy] = map(h.x + haciaCentro * (r + fsDia * 0.7), h.y);
        return (
          <text
            key={"dia" + h.id}
            className="ht-dia"
            x={sx}
            y={sy}
            textAnchor={haciaCentro > 0 ? "start" : "end"}
            dominantBaseline="central"
            fontSize={fsDia}
            stroke="#ffffff"
            strokeWidth={fsDia * 0.25}
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            Ø{h.dia}
          </text>
        );
      })}
    </g>
  );
}

// ---- Hoja técnica: 1..N piezas lado a lado, notas al pie ----
export function HojaTecnica({
  piezas,
  notas = [],
  zoom = 1,
  forPrint = false,
}: {
  piezas: PiezaHoja[];
  notas?: string[];
  zoom?: number;
  forPrint?: boolean;
}) {
  const dims = piezas.flatMap((ph) => [ph.pieza.ancho, ph.pieza.alto]);
  const m = dims.length ? Math.max(...dims) : 100;

  const pad = m * 0.15,
    padSup = m * 0.13,
    padInf = m * 0.13,
    gap = m * 0.02;
  const fsNota = m * 0.026;

  // El tamaño de cada perforación se rotula directamente sobre su agujero, así que la
  // hoja no lleva nota-resumen de diámetros: al pie solo van las notas que llegan.
  const notasFinal = notas;

  // bloques uno al lado del otro, alineados por el borde superior
  const blockWidths = piezas.map((ph) => pad * 2 + ph.pieza.ancho);
  const xOffsets: number[] = [];
  let acc = 0;
  piezas.forEach((_, i) => {
    xOffsets.push(acc);
    acc += blockWidths[i];
    if (i < piezas.length - 1) acc += gap;
  });
  const vbW = acc;
  const maxH = piezas.length ? Math.max(...piezas.map((ph) => ph.pieza.alto)) : 0;
  const vbHTop = padSup + maxH + padInf;
  const notaAlto = notasFinal.length * fsNota * 1.9 + m * 0.03;
  const vbH = vbHTop + notaAlto;

  const S = S0 * zoom;

  return (
    <svg
      data-diagrama
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={forPrint ? undefined : vbW * S}
      height={forPrint ? undefined : vbH * S}
      style={forPrint ? { width: "100%", height: "auto" } : undefined}
    >
      <style>{HT_CSS}</style>

      {piezas.map((ph, i) => (
        <PiezaBloque key={i} ph={ph} originX={xOffsets[i] + pad} padSup={padSup} m={m} />
      ))}

      {notasFinal.map((linea, i) => (
        <text key={i} className="ht-nota" x={vbW / 2} y={vbHTop + m * 0.03 + fsNota + i * fsNota * 1.9} textAnchor="middle" fontSize={fsNota}>
          {linea}
        </text>
      ))}
    </svg>
  );
}
