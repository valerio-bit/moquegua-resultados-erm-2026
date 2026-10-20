/* eslint-disable @next/next/no-img-element -- exportación estática: imágenes sin optimizador */
import type { Organization } from "@/lib/schemas";
import { asset } from "@/lib/site";

function initials(name: string): string {
  const words = name
    .replace(/[-–,]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["del", "las", "los", "para", "por"].includes(w.toLowerCase()));
  return (words.length >= 2 ? words.slice(0, 3).map((w) => w[0]) : [name.slice(0, 2)]).join("").toUpperCase();
}

/**
 * Símbolo de la organización. Si no existe un activo verificado se muestra un rótulo
 * tipográfico con las iniciales (nunca un logo redibujado).
 */
export function PartyLogo({
  org,
  fallbackName,
  size = 36,
}: {
  org?: Organization;
  fallbackName?: string;
  size?: number;
}) {
  const name = org?.displayName ?? fallbackName ?? "Organización";
  if (org?.logo) {
    return (
      <img
        src={asset(org.logo.file)}
        alt={`Símbolo de ${name}`}
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-sm border border-rule bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${name} (sin símbolo verificado)`}
      title="Sin símbolo verificado: se muestra un rótulo tipográfico"
      className="inline-flex shrink-0 items-center justify-center rounded-sm border border-dashed border-rule-strong bg-surface font-sans text-[0.65rem] font-bold text-ink-soft"
      style={{ width: size, height: size }}
    >
      {initials(org?.shortName ?? name)}
    </span>
  );
}
