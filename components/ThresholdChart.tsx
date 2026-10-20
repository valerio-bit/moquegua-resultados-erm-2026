import type { ElectionResult, Organization } from "@/lib/schemas";
import { formatPctShort } from "@/lib/format";
import { titleCase } from "@/lib/text";
import { PartyLogo } from "./PartyLogo";

/**
 * Barras horizontales de % de votos válidos con la línea del umbral legal (30 %).
 * Muestra de un vistazo por qué hay (o no) segunda vuelta regional.
 */
export function ThresholdChart({
  results,
  orgs,
  threshold,
  limit = 6,
}: {
  results: ElectionResult[];
  orgs: Map<string, Organization>;
  threshold: number;
  limit?: number;
}) {
  const rows = [...results].sort((a, b) => b.votes - a.votes).slice(0, limit);
  const top = rows[0]?.validVotePct ?? 0;
  const scaleMax = Math.max(threshold + 10, Math.ceil((top + 5) / 5) * 5);
  const x = (v: number) => `${(v / scaleMax) * 100}%`;
  const runoff = rows.filter((r) => r.status === "SEGUNDA_VUELTA");
  const summary =
    runoff.length === 2
      ? `Ninguna fórmula alcanza el ${threshold} % de votos válidos. ${runoff
          .map((r) => `${orgs.get(r.organizationCode)?.displayName ?? r.organizationName}: ${formatPctShort(r.validVotePct)}`)
          .join("; ")}.`
      : `Primer lugar: ${formatPctShort(top)} de votos válidos.`;

  return (
    <figure className="m-0" aria-label={`Gráfico de votos válidos con el umbral del ${threshold} %. ${summary}`}>
      <div className="relative [--lw:6.75rem] [--vw:4.25rem] sm:[--lw:11rem] sm:[--vw:4.5rem]" role="img" aria-label={summary}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed border-st-segunda"
          style={{ left: `calc(var(--lw) + (100% - var(--lw) - var(--vw)) * ${threshold / scaleMax})` }}
        >
          <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-sm bg-st-segunda px-1.5 py-0.5 text-[0.7rem] font-semibold text-white">
            Umbral {threshold} %
          </span>
        </div>
        <ol className="m-0 list-none space-y-2.5 p-0 pt-7">
          {rows.map((r) => {
            const org = orgs.get(r.organizationCode);
            const highlighted = r.status === "SEGUNDA_VUELTA" || r.status === "PRIMER_LUGAR_VIRTUAL";
            return (
              <li key={r.organizationCode} className="grid grid-cols-[var(--lw)_1fr_var(--vw)] items-center gap-0">
                <span className="flex min-w-0 items-center gap-2 pr-3">
                  <PartyLogo org={org} fallbackName={r.organizationName} size={26} />
                  <span className="min-w-0 truncate text-sm" title={titleCase(r.candidateName)}>
                    {org?.shortName ?? org?.displayName ?? r.organizationName}
                  </span>
                </span>
                <span className="relative h-5 bg-surface">
                  <span
                    className={`absolute inset-y-0 left-0 ${highlighted ? "bg-st-segunda" : "bg-bar"}`}
                    style={{ width: x(r.validVotePct) }}
                  />
                </span>
                <span className={`num whitespace-nowrap pl-2 text-right text-sm ${highlighted ? "font-semibold text-ink" : "text-ink-soft"}`}>
                  {formatPctShort(r.validVotePct)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="mt-3 text-sm text-ink-soft">
        % de votos válidos según ONPE. La línea marca el {threshold} % que hace falta para ganar sin segunda vuelta.
        {results.length > limit && ` Se ven los ${limit} primeros de ${results.length}.`}
      </figcaption>
    </figure>
  );
}
