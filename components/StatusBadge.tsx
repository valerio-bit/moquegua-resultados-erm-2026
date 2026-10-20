import type { ElectionResult, Status } from "@/lib/schemas";

const STYLE: Record<Status | "PARCIAL", { label: string; className: string; description: string }> = {
  COMPUTO_ONPE: {
    label: "Cómputo ONPE",
    className: "bg-st-computo-bg text-st-computo",
    description: "Votos contados por ONPE. Todavía no es un resultado final.",
  },
  PARCIAL: {
    label: "Primer lugar parcial",
    className: "bg-st-parcial-bg text-st-parcial",
    description: "Va primero, pero faltan actas por contar. Puede cambiar.",
  },
  PRIMER_LUGAR_VIRTUAL: {
    label: "Primer lugar virtual",
    className: "bg-st-virtual-bg text-st-virtual",
    description: "Va primero con todas las actas contadas. Falta que el Jurado Electoral lo proclame.",
  },
  SEGUNDA_VUELTA: {
    label: "Segunda vuelta",
    className: "bg-st-segunda-bg text-st-segunda",
    description: "Nadie llegó al 30 % de votos válidos. Los dos más votados van a otra votación.",
  },
  PROCLAMADO_JNE_JEE: {
    label: "Proclamado JNE/JEE",
    className: "bg-st-proclamado-bg text-st-proclamado",
    description: "El Jurado Electoral ya lo proclamó. Hay una fuente del JNE que lo respalda.",
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
