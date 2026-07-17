// vtr-planos — generador de planos de perforación de vidrio de Corporación VTR.
// App 100% cliente (sin backend), hermana de vtr-cortes: mismo andamiaje, SVG inline
// dibujado a escala real, exportación por window.print() (PDF) y XMLSerializer+canvas (PNG).
//
// Origen (0,0) en la esquina inferior izquierda. La vendedora coloca PERFORACIONES
// (Ø mm por coordenada) y TACAS (escotaduras reales sobre un borde, medidas de la
// esquina al INICIO de la taca).
//
// Los dos modos (pieza libre y sistema MILANO) entregan la MISMA hoja de taller
// (HojaTecnica): lo único que cambia es de dónde salen las piezas — a mano en libre,
// de las reglas del sistema en MILANO.

"use client";

import { useMemo, useRef, useState } from "react";
import { cx, Logo, Btn } from "@/components/ui";
import { DIAMETROS, BORDES, ESQUINAS } from "@/lib/planos/modelo";
import type { Borde, Elemento, Esquina, Perforacion, Pieza, TacaClave } from "@/lib/planos/modelo";
import { TACAS, TACAS_LISTA } from "@/lib/planos/tacas";
import { HojaTecnica } from "@/components/HojaTecnica";
import type { PiezaHoja } from "@/components/HojaTecnica";
import { generarMilano } from "@/lib/planos/sistemas";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Pieza de ejemplo (puerta 90 × 210).
const EJEMPLO: Elemento[] = [
  { id: 1, tipo: "taca", clave: "bisagra", borde: "izq", dist: 18, voltear: false },
  { id: 2, tipo: "taca", clave: "bisagra", borde: "izq", dist: 180, voltear: false },
  { id: 3, tipo: "taca", clave: "cerradura", borde: "der", dist: 0, voltear: false, esquina: "inf-der" },
  { id: 4, tipo: "taca", clave: "con_freno", borde: "inf", dist: 0, voltear: false, esquina: "inf-izq" },
  { id: 5, tipo: "perforacion", dia: 10, x: 25, y: 200 },
  { id: 6, tipo: "perforacion", dia: 8, x: 65, y: 200 },
];

// ---- Página ----
export default function PlanosPage() {
  const [modo, setModo] = useState<"libre" | "milano">("libre");

  const [anchoTxt, setAnchoTxt] = useState("90");
  const [altoTxt, setAltoTxt] = useState("210"); // compartido: alto de la pieza libre Y de ambas piezas MILANO
  const [cliente, setCliente] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [elementos, setElementos] = useState<Elemento[]>(EJEMPLO);
  const [sel, setSel] = useState<number | null>(1);
  const [zoom, setZoom] = useState(1);

  // formulario "agregar" (solo modo libre)
  const [tipoSel, setTipoSel] = useState("taca:bisagra");
  const [hxTxt, setHxTxt] = useState("45");
  const [hyTxt, setHyTxt] = useState("100");
  const [borde, setBorde] = useState<Borde>("izq");
  const [distTxt, setDistTxt] = useState("15");
  const [voltear, setVoltear] = useState(false);
  const [esquinaSel, setEsquinaSel] = useState<Esquina>("inf-der");

  // sistema MILANO (solo modo milano) — cada pieza con su propio ancho y alto.
  const [anchoFijoTxt, setAnchoFijoTxt] = useState("80");
  const [altoFijoTxt, setAltoFijoTxt] = useState("210");
  const [anchoPuertaTxt, setAnchoPuertaTxt] = useState("80");
  const [altoPuertaTxt, setAltoPuertaTxt] = useState("209");
  const [manillon, setManillon] = useState<"der" | "izq">("der");

  const idRef = useRef(100);
  const escenaRef = useRef<HTMLDivElement>(null);
  const impresionRef = useRef<HTMLDivElement>(null);

  const W = Math.max(5, parseFloat(anchoTxt) || 90);
  const H = Math.max(5, parseFloat(altoTxt) || 210);
  const pieza: Pieza = { ancho: W, alto: H, elementos };
  const esHueco = tipoSel.startsWith("hole:");
  const esDeEsquina = !esHueco && TACAS[tipoSel.split(":")[1] as TacaClave].esquina;
  const bordeVertical = borde === "izq" || borde === "der";

  // La regla "1 cm menos" es sobre el ALTO: cambiar el alto del fijo autocompleta el
  // de la puerta (fijo − 1), sin bloquear que la vendedora lo edite después.
  function onAltoFijoChange(v: string) {
    setAltoFijoTxt(v);
    const n = parseFloat(v);
    if (!Number.isNaN(n)) setAltoPuertaTxt(String(n - 1));
  }

  const anchoFijo = Math.max(5, parseFloat(anchoFijoTxt) || 80);
  const altoFijo = Math.max(5, parseFloat(altoFijoTxt) || 210);
  const anchoPuerta = Math.max(5, parseFloat(anchoPuertaTxt) || 80);
  const altoPuerta = Math.max(5, parseFloat(altoPuertaTxt) || 209);
  const milano = useMemo(
    () => generarMilano({ anchoPuerta, altoPuerta, anchoFijo, altoFijo, manillon }),
    [anchoPuerta, altoPuerta, anchoFijo, altoFijo, manillon],
  );
  // Ambos modos entregan la MISMA hoja de taller: piezas lado a lado, cada elemento
  // rotulado sobre el plano (Ø en su agujero, nombre en su taca) y sin pie de notas —
  // los datos del cliente y de la pieza van en el encabezado de impresión.
  const piezasHoja: PiezaHoja[] =
    modo === "milano"
      ? [
          { pieza: milano.puerta, titulo: "PUERTA" },
          { pieza: milano.fijo, titulo: "PANEL FIJO" },
        ]
      : [{ pieza, titulo: descripcion || undefined }];

  function agregar() {
    const [k, v] = tipoSel.split(":");
    const id = idRef.current++;
    if (k === "hole") {
      const x = clamp(parseFloat(hxTxt) || 0, 0, W);
      const y = clamp(parseFloat(hyTxt) || 0, 0, H);
      setElementos((p) => [...p, { id, tipo: "perforacion", dia: parseInt(v, 10), x, y }]);
    } else if (TACAS[v as TacaClave].esquina) {
      setElementos((p) => [
        ...p,
        { id, tipo: "taca", clave: v as TacaClave, borde: "inf", dist: 0, voltear, esquina: esquinaSel },
      ]);
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
    // Siempre desde el bloque de impresión (HojaTecnica): el PNG sale con el mismo
    // estilo técnico que el PDF, aunque ese bloque esté oculto en pantalla.
    const svg = impresionRef.current?.querySelector("svg[data-diagrama]") as SVGSVGElement | null;
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
        const nombre = modo === "milano" ? `plano-milano-${fmt(anchoFijo)}x${fmt(altoFijo)}.png` : `plano-${fmt(W)}x${fmt(H)}.png`;
        descargar(u, nombre);
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
      : e.esquina
        ? `esquina ${ESQUINAS.find((q) => q.valor === e.esquina)!.nombre.toLowerCase()}${e.voltear ? " · volteada" : ""}`
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
          {/* ---- sidebar izquierda: modo + pieza/sistema + agregar ---- */}
          <aside className="flex flex-col gap-4">
            <div className="flex gap-1.5 rounded-[4px] border border-[#d8d8cf] bg-white p-1">
              <ModoTab active={modo === "libre"} onClick={() => setModo("libre")}>
                Pieza libre
              </ModoTab>
              <ModoTab active={modo === "milano"} onClick={() => setModo("milano")}>
                Sistema MILANO
              </ModoTab>
            </div>

            <Seccion titulo="Datos">
              <Campo label="Cliente (opcional)">
                <TxtInput value={cliente} onChange={setCliente} placeholder="Nombre" />
              </Campo>
              <Campo label="Descripción (opcional)">
                <TxtInput value={descripcion} onChange={setDescripcion} placeholder="Ej: puerta baño" />
              </Campo>
            </Seccion>

            {modo === "milano" && (
              <Seccion titulo="Sistema MILANO">
                <b className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6a6a60]">Panel fijo</b>
                <div className="flex gap-2">
                  <Campo label="Ancho fijo (cm)">
                    <NumInput value={anchoFijoTxt} onChange={setAnchoFijoTxt} />
                  </Campo>
                  <Campo label="Alto fijo (cm)">
                    <NumInput value={altoFijoTxt} onChange={onAltoFijoChange} />
                  </Campo>
                </div>
                <b className="mt-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6a6a60]">Puerta</b>
                <div className="flex gap-2">
                  <Campo label="Ancho puerta (cm)">
                    <NumInput value={anchoPuertaTxt} onChange={setAnchoPuertaTxt} />
                  </Campo>
                  <Campo label="Alto puerta (cm)">
                    <NumInput value={altoPuertaTxt} onChange={setAltoPuertaTxt} />
                  </Campo>
                </div>
                <Campo label="Manillón">
                  <Select value={manillon} onChange={(v) => setManillon(v as "der" | "izq")}>
                    <option value="der">Derecha</option>
                    <option value="izq">Izquierda</option>
                  </Select>
                </Campo>
                {milano.avisos.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1 rounded-[4px] border border-oro-dark/30 bg-oro-dark/10 p-2">
                    {milano.avisos.map((a, i) => (
                      <p key={i} className="text-[11px] leading-snug text-oro-dark">
                        ⚠ {a}
                      </p>
                    ))}
                  </div>
                )}
              </Seccion>
            )}

            {modo === "libre" && (
              <Seccion titulo="Pieza">
                <div className="flex gap-2">
                  <Campo label="Ancho (cm)">
                    <NumInput value={anchoTxt} onChange={setAnchoTxt} />
                  </Campo>
                  <Campo label="Alto (cm)">
                    <NumInput value={altoTxt} onChange={setAltoTxt} />
                  </Campo>
                </div>
                <div className="flex gap-2">
                  <BtnClaro onClick={cargarEjemplo}>Ejemplo</BtnClaro>
                  <BtnClaro onClick={limpiar}>Limpiar</BtnClaro>
                </div>
              </Seccion>
            )}

            {modo === "libre" && (
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
                ) : esDeEsquina ? (
                  <>
                    <Campo label="Esquina">
                      <Select value={esquinaSel} onChange={(v) => setEsquinaSel(v as Esquina)}>
                        {ESQUINAS.map((q) => (
                          <option key={q.valor} value={q.valor}>
                            {q.nombre}
                          </option>
                        ))}
                      </Select>
                    </Campo>
                    <label className="mb-2 flex items-center gap-2 text-[13px]">
                      <input type="checkbox" checked={voltear} onChange={(e) => setVoltear(e.target.checked)} />
                      Voltear la taca
                    </label>
                  </>
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
            )}
          </aside>

          {/* ---- centro: toolbar + plano ---- */}
          <main className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-[4px] border border-[#d8d8cf] bg-white px-3 py-2">
              <span className="text-[12px] font-semibold text-[#6a6a60]">Zoom</span>
              <BtnClaro onClick={() => setZoom((z) => clamp(+(z - 0.25).toFixed(2), 0.5, 2.5))}>–</BtnClaro>
              <span className="tabular w-12 text-center text-[13px]">{Math.round(zoom * 100)}%</span>
              <BtnClaro onClick={() => setZoom((z) => clamp(+(z + 0.25).toFixed(2), 0.5, 2.5))}>+</BtnClaro>
              <span className="ml-auto text-[12px] text-[#8a8a80]">
                {modo === "libre"
                  ? `${elementos.length} elemento${elementos.length === 1 ? "" : "s"}`
                  : `${milano.puerta.elementos.length + milano.fijo.elementos.length} perforaciones`}
              </span>
            </div>
            <div ref={escenaRef} className="flex justify-center overflow-auto rounded-[4px] border border-[#d8d8cf] bg-white p-4">
              <HojaTecnica piezas={piezasHoja} zoom={zoom} />
            </div>
          </main>

          {/* ---- sidebar derecha: lista + exportar ---- */}
          <aside className="flex flex-col gap-4">
            {modo === "libre" ? (
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
            ) : (
              <Seccion titulo="Perforaciones">
                <div className="flex flex-col gap-3">
                  {[
                    { nombre: "Puerta", pz: milano.puerta },
                    { nombre: "Panel fijo", pz: milano.fijo },
                  ].map(({ nombre, pz }) => (
                    <div key={nombre}>
                      <b className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6a6a60]">{nombre}</b>
                      <div className="flex flex-col gap-1">
                        {(pz.elementos as Perforacion[]).map((h) => (
                          <p key={h.id} className="tabular text-[12px] text-negro">
                            Ø{h.dia} · X {fmt(h.x)} · Y {fmt(h.y)} cm
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}

            <Seccion titulo="Exportar">
              <div className="flex flex-col gap-2">
                <Btn onClick={() => window.print()} className="w-full">
                  Imprimir plano (PDF)
                </Btn>
                <BtnClaro onClick={exportarPNG}>Descargar PNG</BtnClaro>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#8a8a80]">
                Todo visión, c/ freno y cerradura van siempre en una esquina (solo eliges cuál). Si una taca sale al
                revés, usa “Voltear”.
              </p>
            </Seccion>
          </aside>
        </div>
      </div>

      {/* ====== REPORTE DE IMPRESIÓN (solo al imprimir) ====== */}
      <div ref={impresionRef} className="hidden print:block [print-color-adjust:exact]">
        <div className="mb-4 flex items-center justify-between border-b-2 border-oro pb-3">
          <div className="flex items-center gap-3">
            <Logo size={46} />
            <div>
              <h1 className="font-display text-xl font-bold">
                Plano de perforación{modo === "milano" ? " · Sistema MILANO" : ""}
              </h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-oro-dark">Corporación VTR</p>
            </div>
          </div>
          <table className="text-[11px]">
            <tbody>
              {modo === "libre" ? (
                <tr>
                  <td className="pr-2 font-semibold text-[#6a6a60]">Pieza</td>
                  <td className="tabular">
                    {fmt(W)} × {fmt(H)} cm
                  </td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td className="pr-2 font-semibold text-[#6a6a60]">Puerta</td>
                    <td className="tabular">
                      {fmt(milano.puerta.ancho)} × {fmt(milano.puerta.alto)} cm
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-2 font-semibold text-[#6a6a60]">Panel fijo</td>
                    <td className="tabular">
                      {fmt(milano.fijo.ancho)} × {fmt(milano.fijo.alto)} cm
                    </td>
                  </tr>
                </>
              )}
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

        {/* la hoja es autosuficiente en ambos modos: plano a ancho completo, sin leyenda */}
        <div className="break-inside-avoid">
          <HojaTecnica piezas={piezasHoja} forPrint />
        </div>
      </div>
    </div>
  );
}

// ---- mini componentes de UI (locales) ----
function NumBadge({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
      className="inline-flex flex-none items-center justify-center rounded-full bg-oro font-bold text-white"
    >
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
// Tab de selección de modo (Pieza libre / Sistema MILANO).
function ModoTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex-1 rounded-[4px] border px-3 py-2 text-[12.5px] font-semibold transition",
        active ? "border-oro bg-negro text-white" : "border-transparent bg-white text-negro hover:border-oro",
      )}
    >
      {children}
    </button>
  );
}
