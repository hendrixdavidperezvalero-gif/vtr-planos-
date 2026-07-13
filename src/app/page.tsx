// vtr-planos — generador de planos de perforación de vidrio de Corporación VTR.
// App 100% cliente (sin backend), hermana de vtr-cortes: mismo andamiaje, SVG inline
// dibujado a escala real, exportación por window.print() (PDF) y XMLSerializer+canvas (PNG).
//
// Una PIEZA a la vez. Origen (0,0) en la esquina inferior izquierda. La vendedora coloca
// PERFORACIONES (Ø mm por coordenada) y TACAS (escotaduras reales sobre un borde, medidas
// de la esquina al INICIO de la taca). Todo el dibujo geométrico usa las unidades reales
// (cm) como unidades de usuario SVG; el ajuste a pantalla lo hace viewBox + width/height.

"use client";

import { useRef, useState } from "react";
import { cx, Logo, Btn } from "@/components/ui";
import { DIAMETROS, BORDES } from "@/lib/planos/modelo";
import type { Borde, Elemento, Pieza, TacaClave } from "@/lib/planos/modelo";
import { TACAS, TACAS_LISTA } from "@/lib/planos/tacas";
import { transformTaca, cotaTaca } from "@/lib/planos/geometria";

// Estilos del plano embebidos en el propio SVG (para que el PNG serializado los conserve;
// colores literales, sin var() porque el PNG se rinde aislado del documento).
const PLANO_CSS = `
text{font-family:Inter,system-ui,sans-serif}
.pl-vidrio{fill:#e7efe9;stroke:#6e9484}
.pl-grid{stroke:#cdd9d1;fill:none}
.pl-hole{fill:#ffffff;stroke:#2f2c26}
.pl-taca{fill:#ffffff;stroke:#2f2c26}
.pl-taca-linea{fill:none;stroke:#2f2c26}
.pl-el{cursor:pointer}
.pl-el.sel .pl-hole,.pl-el.sel .pl-taca,.pl-el.sel .pl-taca-linea{stroke:#c8982e}
.pl-dim{stroke:#c8982e;fill:none}
.pl-dimtxt{fill:#c8982e;font-weight:700}
.pl-axis{fill:#6a6a60}
.pl-origin{fill:#c8982e}
.pl-otxt{fill:#c8982e;font-weight:700}
.pl-marca{fill:#c8982e;stroke:#ffffff}
.pl-marcatxt{fill:#ffffff;font-weight:800}
`;

const S0 = 3.2; // px por cm base (se multiplica por el zoom)

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Pieza de ejemplo (puerta 90 × 210).
const EJEMPLO: Elemento[] = [
  { id: 1, tipo: "taca", clave: "bisagra", borde: "izq", dist: 18, voltear: false },
  { id: 2, tipo: "taca", clave: "bisagra", borde: "izq", dist: 180, voltear: false },
  { id: 3, tipo: "taca", clave: "cerradura", borde: "der", dist: 100, voltear: false },
  { id: 4, tipo: "taca", clave: "con_freno", borde: "inf", dist: 0, voltear: false },
  { id: 5, tipo: "perforacion", dia: 10, x: 45, y: 205 },
];

// Punto ancla de la marca numerada de un elemento (en cm de pieza).
function markerAnchor(e: Elemento, W: number, H: number, off: number): [number, number] {
  if (e.tipo === "perforacion") return [e.x, e.y];
  const centro = e.dist + TACAS[e.clave].ancho / 2;
  switch (e.borde) {
    case "inf":
      return [centro, off];
    case "sup":
      return [centro, H - off];
    case "izq":
      return [off, centro];
    case "der":
      return [W - off, centro];
  }
}

// ---- Trazos de una taca (coords nativas) ----
function TacaPrims({ clave }: { clave: TacaClave }) {
  const def = TACAS[clave];
  return (
    <>
      {def.prims.map((p, i) => {
        if (p.t === "path")
          return (
            <path
              key={i}
              className={p.linea ? "pl-taca-linea" : "pl-taca"}
              d={p.d}
              fillRule={p.evenodd ? "evenodd" : undefined}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        if (p.t === "circle")
          return (
            <circle key={i} className="pl-taca" cx={p.cx} cy={p.cy} r={p.r} vectorEffect="non-scaling-stroke" strokeWidth={1.4} />
          );
        return (
          <rect
            key={i}
            className="pl-taca"
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            rx={p.rx}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.4}
          />
        );
      })}
    </>
  );
}

// ---- Plano de la pieza (a escala real) ----
function PiezaSVG({
  pieza,
  sel,
  onSelect,
  zoom = 1,
  forPrint = false,
}: {
  pieza: Pieza;
  sel: number | null;
  onSelect?: (id: number) => void;
  zoom?: number;
  forPrint?: boolean;
}) {
  const W = pieza.ancho,
    H = pieza.alto;
  const m = Math.max(W, H);
  const padL = m * 0.16,
    padR = m * 0.13,
    padT = m * 0.12,
    padB = m * 0.17;
  const vbW = W + padL + padR,
    vbH = H + padT + padB;
  const paso = m <= 60 ? 10 : m <= 160 ? 20 : 30;
  const fsAxis = m * 0.019,
    fsLabel = m * 0.022,
    fsDim = m * 0.022;
  const S = S0 * zoom;
  const badgeR = m * 0.02; // radio de la marca numerada (referencia, no a escala)
  const off = badgeR * 1.8;
  const map = (x: number, y: number): [number, number] => [x, H - y];

  // marcas de eje
  const xs: number[] = [];
  for (let t = 0; t <= W + 0.001; t += paso) xs.push(+t.toFixed(3));
  const ys: number[] = [];
  for (let t = 0; t <= H + 0.001; t += paso) ys.push(+t.toFixed(3));

  const selEl = pieza.elementos.find((e) => e.id === sel);

  return (
    <svg
      data-diagrama
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-padL} ${-padT} ${vbW} ${vbH}`}
      width={forPrint ? undefined : vbW * S}
      height={forPrint ? undefined : vbH * S}
      style={forPrint ? { width: "100%", height: "auto" } : undefined}
    >
      <style>{PLANO_CSS}</style>

      {/* geometría en cm, y hacia arriba (origen esquina inferior izquierda) */}
      <g transform={`translate(0,${H}) scale(1,-1)`}>
        <rect className="pl-vidrio" x={0} y={0} width={W} height={H} vectorEffect="non-scaling-stroke" strokeWidth={2} />
        {xs.slice(1, -1).map((t) => (
          <line key={"gx" + t} className="pl-grid" x1={t} y1={0} x2={t} y2={H} vectorEffect="non-scaling-stroke" strokeWidth={1} />
        ))}
        {ys.slice(1, -1).map((t) => (
          <line key={"gy" + t} className="pl-grid" x1={0} y1={t} x2={W} y2={t} vectorEffect="non-scaling-stroke" strokeWidth={1} />
        ))}

        {pieza.elementos.map((e) => {
          const s = sel === e.id;
          if (e.tipo === "perforacion") {
            return (
              <g key={e.id} className={cx("pl-el", s && "sel")} onClick={() => onSelect?.(e.id)}>
                <circle className="pl-hole" cx={e.x} cy={e.y} r={e.dia / 20} vectorEffect="non-scaling-stroke" strokeWidth={1.5} />
              </g>
            );
          }
          const def = TACAS[e.clave];
          return (
            <g
              key={e.id}
              className={cx("pl-el", s && "sel")}
              onClick={() => onSelect?.(e.id)}
              transform={transformTaca(def, e.borde, e.dist, e.voltear, W, H)}
            >
              <TacaPrims clave={e.clave} />
            </g>
          );
        })}
      </g>

      {/* etiquetas de eje (coords normales) */}
      {xs.map((t) => {
        const [px] = map(t, 0);
        return (
          <text key={"tx" + t} className="pl-axis" x={px} y={H + fsAxis * 1.25} textAnchor="middle" fontSize={fsAxis}>
            {fmt(t)}
          </text>
        );
      })}
      {ys.map((t) => {
        const [, py] = map(0, t);
        return (
          <text key={"ty" + t} className="pl-axis" x={-fsAxis * 0.5} y={py + fsAxis * 0.35} textAnchor="end" fontSize={fsAxis}>
            {fmt(t)}
          </text>
        );
      })}
      <text className="pl-axis" x={W / 2} y={H + fsAxis * 2.9} textAnchor="middle" fontSize={fsAxis}>
        X · cm desde la izquierda
      </text>
      <text
        className="pl-axis"
        transform={`translate(${-padL * 0.66}, ${H / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={fsAxis}
      >
        Y · cm desde abajo
      </text>

      {/* medidas de la pieza */}
      <text className="pl-axis" x={W / 2} y={-padT * 0.35} textAnchor="middle" fontSize={fsLabel}>
        {fmt(W)} cm
      </text>
      <text
        className="pl-axis"
        transform={`translate(${W + padR * 0.6}, ${H / 2}) rotate(90)`}
        textAnchor="middle"
        fontSize={fsLabel}
      >
        {fmt(H)} cm
      </text>

      {/* origen */}
      <circle className="pl-origin" cx={0} cy={H} r={fsAxis * 0.3} />
      <text className="pl-otxt" x={fsAxis * 0.6} y={H - fsAxis * 0.5} fontSize={fsAxis}>
        (0,0)
      </text>

      {/* cotas del elemento seleccionado */}
      {selEl && <Cotas el={selEl} W={W} H={H} fs={fsDim} map={map} />}

      {/* marcas numeradas grandes (referencia, ligadas a la leyenda de medidas) */}
      {pieza.elementos.map((e, i) => {
        const [ax, ay] = markerAnchor(e, W, H, off);
        const [sx, sy] = map(ax, ay);
        return (
          <g key={"m" + e.id}>
            <circle className="pl-marca" cx={sx} cy={sy} r={badgeR} vectorEffect="non-scaling-stroke" strokeWidth={1.5} />
            <text className="pl-marcatxt" x={sx} y={sy} textAnchor="middle" dominantBaseline="central" fontSize={badgeR * 1.25}>
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Cotas del elemento seleccionado (en oro).
function Cotas({
  el,
  W,
  H,
  fs,
  map,
}: {
  el: Elemento;
  W: number;
  H: number;
  fs: number;
  map: (x: number, y: number) => [number, number];
}) {
  if (el.tipo === "perforacion") {
    const [px, py] = map(el.x, el.y);
    const [lx] = map(0, el.y);
    const [, by] = map(el.x, 0);
    return (
      <>
        <line className="pl-dim" x1={lx} y1={py} x2={px} y2={py} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <text className="pl-dimtxt" x={(lx + px) / 2} y={py - fs * 0.4} textAnchor="middle" fontSize={fs}>
          {fmt(el.x)}
        </text>
        <line className="pl-dim" x1={px} y1={by} x2={px} y2={py} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <text className="pl-dimtxt" x={px + fs * 0.4} y={(by + py) / 2} fontSize={fs}>
          {fmt(el.y)}
        </text>
      </>
    );
  }
  const { a, b } = cotaTaca(el.borde, el.dist, W, H);
  const [ax, ay] = map(a[0], a[1]);
  const [bx, by] = map(b[0], b[1]);
  const mx = (ax + bx) / 2,
    my = (ay + by) / 2;
  const vertical = el.borde === "izq" || el.borde === "der";
  return (
    <>
      <line className="pl-dim" x1={ax} y1={ay} x2={bx} y2={by} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      <line className="pl-dim" x1={ax - 4} y1={ay} x2={ax + 4} y2={ay} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <line className="pl-dim" x1={bx - 4} y1={by} x2={bx + 4} y2={by} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {vertical ? (
        <text className="pl-dimtxt" transform={`translate(${mx - fs * 0.6}, ${my}) rotate(-90)`} textAnchor="middle" fontSize={fs}>
          {fmt(el.dist)}
        </text>
      ) : (
        <text className="pl-dimtxt" x={mx} y={my + (el.borde === "sup" ? -fs * 0.5 : fs * 1.1)} textAnchor="middle" fontSize={fs}>
          {fmt(el.dist)}
        </text>
      )}
    </>
  );
}

// ---- Página ----
export default function PlanosPage() {
  const [anchoTxt, setAnchoTxt] = useState("90");
  const [altoTxt, setAltoTxt] = useState("210");
  const [cliente, setCliente] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [elementos, setElementos] = useState<Elemento[]>(EJEMPLO);
  const [sel, setSel] = useState<number | null>(1);
  const [zoom, setZoom] = useState(1);

  // formulario "agregar"
  const [tipoSel, setTipoSel] = useState("taca:bisagra");
  const [hxTxt, setHxTxt] = useState("45");
  const [hyTxt, setHyTxt] = useState("100");
  const [borde, setBorde] = useState<Borde>("izq");
  const [distTxt, setDistTxt] = useState("15");
  const [voltear, setVoltear] = useState(false);

  const idRef = useRef(100);
  const escenaRef = useRef<HTMLDivElement>(null);

  const W = Math.max(5, parseFloat(anchoTxt) || 90);
  const H = Math.max(5, parseFloat(altoTxt) || 210);
  const pieza: Pieza = { ancho: W, alto: H, elementos };
  const esHueco = tipoSel.startsWith("hole:");
  const bordeVertical = borde === "izq" || borde === "der";

  function agregar() {
    const [k, v] = tipoSel.split(":");
    const id = idRef.current++;
    if (k === "hole") {
      const x = clamp(parseFloat(hxTxt) || 0, 0, W);
      const y = clamp(parseFloat(hyTxt) || 0, 0, H);
      setElementos((p) => [...p, { id, tipo: "perforacion", dia: parseInt(v, 10), x, y }]);
    } else {
      setElementos((p) => [
        ...p,
        { id, tipo: "taca", clave: v as TacaClave, borde, dist: parseFloat(distTxt) || 0, voltear },
      ]);
    }
    setSel(id);
  }
  function borrar(id: number) {
    setElementos((p) => p.filter((e) => e.id !== id));
    if (sel === id) setSel(null);
  }
  function limpiar() {
    setElementos([]);
    setSel(null);
  }
  function cargarEjemplo() {
    setAnchoTxt("90");
    setAltoTxt("210");
    setElementos(EJEMPLO);
    setSel(1);
  }

  // ---- Exportar PNG (SVG → canvas) ----
  function descargar(url: string, nombre: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
  }
  function exportarPNG() {
    const svg = escenaRef.current?.querySelector("svg[data-diagrama]") as SVGSVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const vb = svg.viewBox.baseVal;
      const esc = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round((vb.width || img.width) * esc);
      canvas.height = Math.round((vb.height || img.height) * esc);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return;
        const u = URL.createObjectURL(b);
        descargar(u, `plano-${fmt(W)}x${fmt(H)}.png`);
        URL.revokeObjectURL(u);
      }, "image/png");
    };
    img.src = url;
  }

  const nombreTipo = (e: Elemento) =>
    e.tipo === "perforacion" ? `Perforación Ø${e.dia} mm` : TACAS[e.clave].nombre;
  const bordeNombre = (b: Borde) => BORDES.find((x) => x.valor === b)!.nombre.toLowerCase();
  const subTipo = (e: Elemento) =>
    e.tipo === "perforacion"
      ? `X ${fmt(e.x)} · Y ${fmt(e.y)} cm`
      : `borde ${bordeNombre(e.borde)} · inicio a ${fmt(e.dist)} cm${e.voltear ? " · volteada" : ""}`;

  const fecha = new Date().toLocaleDateString("es-VE");

  return (
    <div className="min-h-full bg-[#f2f2ee] text-negro">
      {/* ====== APP (oculta al imprimir) ====== */}
      <div className="print:hidden">
        {/* top bar */}
        <header className="flex items-center gap-3 bg-negro px-5 py-3 text-white">
          <Logo size={38} />
          <div className="leading-tight">
            <h1 className="font-display text-lg font-bold tracking-tight">Planos de Perforación</h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-oro">Corporación VTR · zona de perforación</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* ---- sidebar izquierda: pieza + agregar ---- */}
          <aside className="flex flex-col gap-4">
            <Seccion titulo="Pieza">
              <div className="flex gap-2">
                <Campo label="Ancho (cm)">
                  <NumInput value={anchoTxt} onChange={setAnchoTxt} />
                </Campo>
                <Campo label="Alto (cm)">
                  <NumInput value={altoTxt} onChange={setAltoTxt} />
                </Campo>
              </div>
              <Campo label="Cliente (opcional)">
                <TxtInput value={cliente} onChange={setCliente} placeholder="Nombre" />
              </Campo>
              <Campo label="Descripción (opcional)">
                <TxtInput value={descripcion} onChange={setDescripcion} placeholder="Ej: puerta baño" />
              </Campo>
              <div className="flex gap-2">
                <BtnClaro onClick={cargarEjemplo}>Ejemplo</BtnClaro>
                <BtnClaro onClick={limpiar}>Limpiar</BtnClaro>
              </div>
            </Seccion>

            <Seccion titulo="Agregar elemento">
              <Campo label="Tipo">
                <Select value={tipoSel} onChange={setTipoSel}>
                  <optgroup label="Perforaciones (Ø mm)">
                    {DIAMETROS.map((d) => (
                      <option key={d} value={`hole:${d}`}>
                        Perforación Ø {d}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Tacas">
                    {TACAS_LISTA.map((t) => (
                      <option key={t.clave} value={`taca:${t.clave}`}>
                        {t.nombre}
                      </option>
                    ))}
                  </optgroup>
                </Select>
              </Campo>

              {esHueco ? (
                <div className="flex gap-2">
                  <Campo label="X izq. (cm)">
                    <NumInput value={hxTxt} onChange={setHxTxt} />
                  </Campo>
                  <Campo label="Y abajo (cm)">
                    <NumInput value={hyTxt} onChange={setHyTxt} />
                  </Campo>
                </div>
              ) : (
                <>
                  <Campo label="Borde">
                    <Select value={borde} onChange={(v) => setBorde(v as Borde)}>
                      {BORDES.map((b) => (
                        <option key={b.valor} value={b.valor}>
                          {b.nombre}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo label={`Distancia ${bordeVertical ? "desde abajo" : "desde la esquina"} al inicio (cm)`}>
                    <NumInput value={distTxt} onChange={setDistTxt} />
                  </Campo>
                  <label className="mb-2 flex items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={voltear} onChange={(e) => setVoltear(e.target.checked)} />
                    Voltear la taca
                  </label>
                </>
              )}

              <Btn onClick={agregar} className="w-full">
                Agregar al plano
              </Btn>
            </Seccion>
          </aside>

          {/* ---- centro: toolbar + plano ---- */}
          <main className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-[4px] border border-[#d8d8cf] bg-white px-3 py-2">
              <span className="text-[12px] font-semibold text-[#6a6a60]">Zoom</span>
              <BtnClaro onClick={() => setZoom((z) => clamp(+(z - 0.25).toFixed(2), 0.5, 2.5))}>–</BtnClaro>
              <span className="tabular w-12 text-center text-[13px]">{Math.round(zoom * 100)}%</span>
              <BtnClaro onClick={() => setZoom((z) => clamp(+(z + 0.25).toFixed(2), 0.5, 2.5))}>+</BtnClaro>
              <span className="ml-auto text-[12px] text-[#8a8a80]">
                {elementos.length} elemento{elementos.length === 1 ? "" : "s"}
              </span>
            </div>
            <div ref={escenaRef} className="flex justify-center overflow-auto rounded-[4px] border border-[#d8d8cf] bg-white p-4">
              <PiezaSVG pieza={pieza} sel={sel} onSelect={setSel} zoom={zoom} />
            </div>
          </main>

          {/* ---- sidebar derecha: lista + exportar ---- */}
          <aside className="flex flex-col gap-4">
            <Seccion titulo="Elementos">
              <div className="flex max-h-[320px] flex-col gap-1.5 overflow-auto">
                {elementos.length === 0 && (
                  <p className="text-[12px] italic text-[#8a8a80]">Sin elementos. Agrega uno o carga el ejemplo.</p>
                )}
                {elementos.map((e, i) => (
                  <div
                    key={e.id}
                    onClick={() => setSel(e.id)}
                    className={cx(
                      "flex cursor-pointer items-center gap-2 rounded-[4px] border bg-[#faf8f3] px-2.5 py-2",
                      sel === e.id ? "border-oro shadow-[inset_0_0_0_1px_var(--color-oro)]" : "border-[#e3e3da]",
                    )}
                  >
                    <NumBadge n={i + 1} />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px] font-semibold">{nombreTipo(e)}</b>
                      <span className="tabular text-[10.5px] text-[#8a8a80]">{subTipo(e)}</span>
                    </div>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        borrar(e.id);
                      }}
                      title="Borrar"
                      className="rounded-[4px] px-1.5 text-[16px] leading-none text-[#8a8a80] hover:bg-white hover:text-[#c04a36]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Exportar">
              <div className="flex flex-col gap-2">
                <Btn onClick={() => window.print()} className="w-full">
                  Imprimir plano (PDF)
                </Btn>
                <BtnClaro onClick={exportarPNG}>Descargar PNG</BtnClaro>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#8a8a80]">
                Cerradura y todo visión c/ freno van en esquina: ponles distancia 0. Si una taca sale al revés, usa
                “Voltear”.
              </p>
            </Seccion>
          </aside>
        </div>
      </div>

      {/* ====== REPORTE DE IMPRESIÓN (solo al imprimir) ====== */}
      <div className="hidden print:block [print-color-adjust:exact]">
        <div className="mb-4 flex items-center justify-between border-b-2 border-oro pb-3">
          <div className="flex items-center gap-3">
            <Logo size={46} />
            <div>
              <h1 className="font-display text-xl font-bold">Plano de perforación</h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-oro-dark">Corporación VTR</p>
            </div>
          </div>
          <table className="text-[11px]">
            <tbody>
              <tr>
                <td className="pr-2 font-semibold text-[#6a6a60]">Pieza</td>
                <td className="tabular">
                  {fmt(W)} × {fmt(H)} cm
                </td>
              </tr>
              {cliente && (
                <tr>
                  <td className="pr-2 font-semibold text-[#6a6a60]">Cliente</td>
                  <td>{cliente}</td>
                </tr>
              )}
              {descripcion && (
                <tr>
                  <td className="pr-2 font-semibold text-[#6a6a60]">Descripción</td>
                  <td>{descripcion}</td>
                </tr>
              )}
              <tr>
                <td className="pr-2 font-semibold text-[#6a6a60]">Fecha</td>
                <td className="tabular">{fecha}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* plano a la izquierda, medidas a la derecha — todo en la primera hoja */}
        <div className="flex break-inside-avoid gap-5">
          <div className="w-[57%] flex-none">
            <PiezaSVG pieza={pieza} sel={null} forPrint />
          </div>
          <div className="flex-1">
            <h2 className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[#6a6a60]">Medidas</h2>
            {elementos.length === 0 ? (
              <p className="text-[11px] italic text-[#8a8a80]">Sin elementos.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {elementos.map((e, i) => (
                  <div key={e.id} className="flex items-start gap-2 border-b border-[#eee] pb-2 text-[11px]">
                    <NumBadge n={i + 1} />
                    <div className="min-w-0">
                      <b className="block">{nombreTipo(e)}</b>
                      <span className="tabular text-[#6a6a60]">{subTipo(e)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- mini componentes de UI (locales) ----
function NumBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-oro text-[11px] font-bold text-white">
      {n}
    </span>
  );
}
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[4px] border border-[#d8d8cf] bg-[#eaeae4] p-3.5">
      <h2 className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[#6a6a60]">{titulo}</h2>
      {children}
    </section>
  );
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-[11px] font-semibold text-[#6a6a60]">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-[4px] border border-[#d8d8cf] bg-white px-2.5 py-2 text-[14px] text-negro outline-none focus:border-oro";
function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputCls, "tabular")}
    />
  );
}
function TxtInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {children}
    </select>
  );
}
function BtnClaro({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[4px] border border-[#d8d8cf] bg-white px-3 py-2 text-[13px] font-semibold text-negro transition hover:border-oro"
    >
      {children}
    </button>
  );
}
