// vtr-planos — HojaTecnica: render de "plano de taller clásico" (hoja blanca, cotas
// con líneas de extensión y ticks a 45°, título de la pieza al centro) con toques VTR
// (negro/oro). Es el ÚNICO render del plano: pantalla, impresión y export PNG, tanto
// en pieza libre como en el sistema MILANO.
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
.ht-titulo{fill:#9d7a1f;font-weight:800;letter-spacing:.14em}
.ht-dia{fill:#9d7a1f;font-weight:700}
.ht-taca{fill:#ffffff;stroke:#1a1a1a}
.ht-taca-linea{fill:none;stroke:#1a1a1a}
`;

const S0 = 3.2; // px por cm base (se multiplica por el zoom)
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Alto máximo de la hoja impresa: el plano DEBE salir en una sola página. Es el alto
// de una Letter (11in, la más corta frente a A4) menos los márgenes de impresión y el
// encabezado. Verificado contando páginas del PDF con puerta 90×210 y con MILANO.
const MAX_ALTO_HOJA = "8.9in";

// Factor de agrandado visual de una taca: garantiza un ancho dibujado mínimo relativo
// a la pieza, sin tocar la cota real.
function boostTaca(anchoReal: number, m: number): number {
  return Math.max(1, (m * 0.09) / anchoReal);
}

// Huella dibujada de una taca sobre su borde. `voltear` no entra: espeja la forma
// dentro de su propio tramo, no lo mueve. Las tacas de esquina se apoyan siempre en un
// borde horizontal (ver transformTacaEsquina), de ahí que `horizontal` las incluya.
function huellaTaca(t: Taca, W: number, m: number) {
  const def = TACAS[t.clave];
  const k = boostTaca(def.ancho, m);
  const largo = def.ancho * k; // tramo dibujado a lo largo del borde
  const fondo = ((def.nvb[1] * def.ancho) / def.nvb[0]) * k; // lo que entra al vidrio
  const horizontal = !!t.esquina || t.borde === "inf" || t.borde === "sup";
  const arriba = t.esquina ? t.esquina.startsWith("sup") : t.borde === "sup";
  // centro del tramo a lo largo del borde (X si el borde es horizontal, Y si vertical)
  const centro = t.esquina ? (t.esquina.endsWith("izq") ? largo / 2 : W - largo / 2) : t.dist + largo / 2;
  return { largo, fondo, horizontal, arriba, centro };
}

// Ancho aproximado de un texto: SVG no mide sin rasterizar y el rótulo hay que
// encajarlo DENTRO de la pieza, así que se estima por el avance medio de Inter bold.
const ANCHO_CARACTER = 0.56;
const anchoTexto = (s: string, fs: number) => s.length * ANCHO_CARACTER * fs;

/** Rótulo (herraje + posición) de cada taca de la pieza. La hoja no lleva leyenda
 *  aparte, así que el plano tiene que decir por sí solo qué va en cada escotadura.
 *  - Borde vertical (izq/der): el texto entra al vidrio a la altura de su taca.
 *  - Borde horizontal (inf/sup, incl. esquinas): el texto va por encima/debajo de la
 *    taca, centrado en ella pero METIDO a la fuerza dentro de la pieza — una taca de
 *    esquina está pegada al canto y su rótulo, centrado, se saldría y pisaría las
 *    cotas del margen. Si dos rótulos del mismo borde se pisarían, se apilan. */
function rotulosTacas(lista: Taca[], W: number, H: number, m: number, fs: number) {
  const gap = fs * 0.9;
  const paso = fs * 1.35; // separación entre rótulos apilados

  const verticales = lista.filter((t) => !huellaTaca(t, W, m).horizontal);
  const horizontales = lista.filter((t) => huellaTaca(t, W, m).horizontal);

  const rotVert = verticales.map((t) => {
    const { fondo, centro } = huellaTaca(t, W, m);
    const izq = t.borde === "izq";
    return {
      id: t.id,
      texto: TACAS[t.clave].nombre,
      x: izq ? fondo + gap : W - fondo - gap,
      y: centro,
      anchor: (izq ? "start" : "end") as "start" | "end",
    };
  });

  // los horizontales se resuelven por borde: primero se centran y se encajan dentro
  // de la pieza, después se reparten niveles para que no se pisen entre sí
  const rotHoriz = (["inf", "sup"] as const).flatMap((lado) => {
    const grupo = horizontales.filter((t) => huellaTaca(t, W, m).arriba === (lado === "sup"));
    const cajas = grupo.map((t) => {
      const { centro } = huellaTaca(t, W, m);
      const texto = TACAS[t.clave].nombre;
      const medio = anchoTexto(texto, fs) / 2;
      // si el rótulo es más ancho que la pieza no hay dónde encajarlo: se centra y ya
      const x = medio * 2 >= W ? W / 2 : Math.max(medio, Math.min(W - medio, centro));
      return { t, texto, span: [x - medio, x + medio] as [number, number], x };
    });
    const { nivel } = nivelesSinSolape(cajas.map((c) => c.span));
    return cajas.map((c, i) => {
      const { fondo } = huellaTaca(c.t, W, m);
      const sep = fondo + gap + nivel[i] * paso;
      return {
        id: c.t.id,
        texto: c.texto,
        x: c.x,
        y: lado === "sup" ? H - sep : sep,
        anchor: "middle" as const,
      };
    });
  });

  return [...rotVert, ...rotHoriz];
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
      {/* número horizontal (no rotado) centrado sobre la línea; el halo blanco la tapa detrás */}
      <text
        className="ht-dimtxt"
        x={lax}
        y={midY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fsDim}
        stroke="#ffffff"
        strokeWidth={fsDim * 0.3}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
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
      <text
        className="ht-dimtxt"
        x={midX}
        y={textY}
        textAnchor="middle"
        fontSize={fsDim}
        stroke="#ffffff"
        strokeWidth={fsDim * 0.3}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
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

      {/* rótulo en CADA taca, en el mismo oro que el Ø de las perforaciones */}
      {rotulosTacas([...tacasEsquina, ...tacas], W, H, m, fsDia).map((r) => {
        const [sx, sy] = map(r.x, r.y);
        return (
          <text
            key={"rot" + r.id}
            className="ht-dia"
            x={sx}
            y={sy}
            textAnchor={r.anchor}
            dominantBaseline="central"
            fontSize={fsDia}
            stroke="#ffffff"
            strokeWidth={fsDia * 0.25}
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {r.texto}
          </text>
        );
      })}
    </g>
  );
}

// ---- Hoja técnica: 1..N piezas lado a lado ----
// La hoja es autosuficiente y no lleva pie de notas: cada elemento se rotula sobre el
// plano (Ø en su agujero, herraje en su taca) y los datos de cliente/pieza van en el
// encabezado de impresión.
export function HojaTecnica({
  piezas,
  zoom = 1,
  forPrint = false,
}: {
  piezas: PiezaHoja[];
  zoom?: number;
  forPrint?: boolean;
}) {
  const dims = piezas.flatMap((ph) => [ph.pieza.ancho, ph.pieza.alto]);
  const m = dims.length ? Math.max(...dims) : 100;

  const pad = m * 0.15,
    padSup = m * 0.13,
    padInf = m * 0.13,
    gap = m * 0.02;

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
  const vbH = padSup + maxH + padInf;

  const S = S0 * zoom;

  return (
    <svg
      data-diagrama
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={forPrint ? undefined : vbW * S}
      height={forPrint ? undefined : vbH * S}
      // Al imprimir la hoja ocupa el ancho, pero el tope de alto manda: una hoja de una
      // sola pieza vertical (p. ej. 90×210) escalada solo por el ancho se desborda y el
      // PDF sale en varias páginas. Con el tope, preserveAspectRatio la encoge y centra.
      style={forPrint ? { width: "100%", height: "auto", maxHeight: MAX_ALTO_HOJA } : undefined}
    >
      <style>{HT_CSS}</style>

      {piezas.map((ph, i) => (
        <PiezaBloque key={i} ph={ph} originX={xOffsets[i] + pad} padSup={padSup} m={m} />
      ))}
    </svg>
  );
}
