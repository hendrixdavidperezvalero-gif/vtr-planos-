// vtr-cortes — mini kit de UI con estética VTR (subconjunto del kit de belen-web:
// solo lo que usa el optimizador). Geométrico (radios 4px), negro + oro.
import Image from "next/image";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <Image src="/logo-vtr.png" alt="VTR" width={size} height={size} priority className="object-contain" />
  );
}

// Botón con estética VTR. variant: primary (oro) | ghost | danger.
export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-default";
  const variants = {
    primary: "bg-oro text-negro hover:bg-oro-dark shadow-[0_4px_12px_rgba(200,152,46,0.3)]",
    ghost: "bg-white/5 text-white border border-white/15 hover:border-oro",
    danger: "bg-[color:var(--color-pausa)]/15 text-[color:var(--color-pausa)] border border-[color:var(--color-pausa)]/40 hover:bg-[color:var(--color-pausa)]/25",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cx(base, variants[variant], className)}>
      {children}
    </button>
  );
}
