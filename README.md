# vtr-planos

Generador de **planos de perforación de vidrio** de Corporación VTR. App web 100% cliente
(sin backend), hermana de [`vtr-cortes`](../vtr-cortes): mismo stack y andamiaje.

Pensada para las vendedoras: arman **una pieza** de vidrio, le colocan las perforaciones y
tacas, y sacan el plano listo para la zona de perforación (imprimir o PNG).

## Qué hace

- Pieza rectangular con origen **(0,0) en la esquina inferior izquierda**.
- **Perforaciones** redondas: se elige el Ø de la paleta real (5–70 mm) y se coloca por
  coordenada X (desde la izquierda) e Y (desde abajo), en cm.
- **Tacas** (escotaduras del canto) con geometría **real calcada de Figma**: clip, todo
  visión, cerradura, todo visión c/ freno, bisagra pared/vidrio y bisagra cierre suave.
  Se apoyan sobre un borde; la cota va de la esquina **al inicio** de la taca. Cerradura y
  con freno son de esquina (distancia 0). Hay opción de **voltear**.
- Dibujo SVG **a escala real** con grid, cotas y cuadro de rótulo.
- Exporta **PDF** (vía imprimir del navegador) y **PNG**.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict.
- Tailwind v4 (tokens VTR en `src/app/globals.css`, sin `tailwind.config`).
- **Cero dependencias de runtime**: el dibujo es SVG inline; el PNG se hace con
  `XMLSerializer` + `<canvas>`; el PDF con `window.print()`.

## Estructura

```
src/
├── app/
│   ├── layout.tsx      fuentes (Montserrat + Inter) y metadata
│   ├── globals.css     tokens VTR (negro + oro, radios 4px)
│   └── page.tsx        UI (3 columnas) + render del plano + exportación
├── components/ui.tsx   kit VTR (cx, Logo, Btn)
└── lib/planos/         lógica pura (sin React)
    ├── modelo.ts       tipos: Pieza, Perforacion, Taca; Ø y bordes
    ├── tacas.ts        biblioteca de tacas (geometría real de Figma)
    └── geometria.ts    transforms de colocación borde/esquina + cotas
```

Las formas de las tacas se calcan del archivo de Figma **"perforaciones de vidrio"**
(fileKey `4S4kAD1weUJeRWzzKTYE5Y`). Regla clave: no se inventan formas — solo geometría real.

## Correr en local

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Push a `main` → Vercel lo detecta como Next.js y despliega solo. Sin variables de entorno
(app 100% cliente).

## Pendiente / próximos pasos

- Confirmar la **orientación** de cada taca por borde (voltear/rotar según el herraje real).
- Fase 2: varias piezas por trabajo, DXF para CNC, guardar/cargar.
