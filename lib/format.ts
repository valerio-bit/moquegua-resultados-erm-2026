const intFmt = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pctShortFmt = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 131406 -> "131,406" (convención es-PE, la misma que usa ONPE). */
export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return intFmt.format(value);
}

/** Porcentaje con 3 decimales, como lo publica ONPE: 26.018 -> "26.018 %". */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${pctFmt.format(value)} %`;
}

const pctTrimFmt = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** Avance de actas: hasta 3 decimales sin ceros sobrantes (100 -> "100 %", 96.154 -> "96.154 %"). */
export function formatActsPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${pctTrimFmt.format(value)} %`;
}

/** Porcentaje con 1 decimal para rótulos breves: 26.018 -> "26.0 %". */
export function formatPctShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${pctShortFmt.format(value)} %`;
}

const dateTimeFmt = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO -> "20 de octubre de 2026, 08:30 (hora de Lima)". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${dateTimeFmt.format(date)} (hora de Lima)`;
}

/** Redondeo para comparar porcentajes calculados con los publicados (3 decimales). */
export function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
