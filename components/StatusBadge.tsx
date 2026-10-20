import type { ElectionResult, Status } from "@/lib/schemas";

const STYLE: Record<Status | "PARCIAL", { label: string; className: string; description: string }> = {
  COMPUTO_ONPE: {
    label: "Cómputo ONPE",
    className: "bg-st-computo-bg text-st-computo",
    description: "Votos según el cómputo de ONPE. No implica ningún resultado definitivo.",
  },
  PARCIAL: {
    label: "Primer lugar parcial",
    className: "bg-st-parcial-bg text-st-parcial",
    description: "Encabeza el cómputo, pero aún hay actas sin contabilizar (por ejemplo, enviadas al JEE).",
  },
  PRIMER_LUGAR_VIRTUAL: {
    label: "Primer lugar virtual",
    className: "bg-st-virtual-bg text-st-virtual",
    description: "Primer lugar con el 100 % de actas contabilizadas por ONPE. No es una proclamación: la hace el JEE/JNE.",
  },
  SEGUNDA_VUELTA: {
    label: "Segunda vuelta",
    className: "bg-st-segunda-bg text-st-segunda",
    description: "Ninguna fórmula alcanzó el 30 % de votos válidos: las dos más votadas van a una segunda elección.",
  },
  PROCLAMADO_JNE_JEE: {
    label: "Proclamado JNE/JEE",
    className: "bg-st-proclamado-bg text-st-proclamado",
    description: "Proclamado por el Jurado Electoral, con fuente verificable del JNE/JEE.",
  },
};

export function statusKey(r: Pick<ElectionResult, "status" | "isLeading">, countComplete: boolean): Status | "PARCIAL" {
  if (r.status === "COMPUTO_ONPE" && r.isLeading && !countComplete) return "PARCIAL";
  return r.status;
}

export function StatusBadge({ status }: { status: Status | "PARCIAL" }) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ${s.className}`}
      title={s.description}
      data-status={status}
    >
      {s.label}
      <span className="sr-only">. {s.description}</span>
    </span>
  );
}

export const STATUS_LEGEND = (Object.keys(STYLE) as (Status | "PARCIAL")[]).map((k) => ({ key: k, ...STYLE[k] }));
