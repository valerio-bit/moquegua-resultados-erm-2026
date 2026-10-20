import Link from "next/link";
import type { ElectionResult, ElectionUnit, Organization } from "@/lib/schemas";
import { formatInt, formatPct } from "@/lib/format";
import { titleCase } from "@/lib/text";
import { PartyLogo } from "./PartyLogo";
import { StatusBadge, statusKey } from "./StatusBadge";

export function CandidateName({ r }: { r: ElectionResult }) {
  if (r.electionId === 2) return <span className="text-ink-soft">Lista regional</span>;
  if (r.candidateNameMissing)
    return (
      <span className="text-ink-soft" title={r.statusNote}>
        Sin nombre en ONPE
      </span>
    );
  return (
    <span title={r.nameNormalizedFrom ? `Texto original en ONPE: ${r.nameNormalizedFrom}` : undefined}>
      {titleCase(r.candidateName)}
    </span>
  );
}

/** Tabla semántica con todas las candidaturas de una elección. */
export function ResultsTable({
  unit,
  results,
  orgs,
  caption,
  showCandidate = true,
}: {
  unit: ElectionUnit;
  results: ElectionResult[];
  orgs: Map<string, Organization>;
  caption: string;
  showCandidate?: boolean;
}) {
  const max = Math.max(...results.map((r) => r.validVotePct), 1);
  return (
    <div className="table-wrap">
      <table className="data-table" data-testid={`results-${unit.id}`}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-12">
              Puesto
            </th>
            {showCandidate && <th scope="col">Candidatura</th>}
            <th scope="col">Organización política</th>
            <th scope="col" className="right">
              Votos
            </th>
            <th scope="col" className="right min-w-40">
              % votos válidos
            </th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const org = orgs.get(r.organizationCode);
            const key = statusKey(r, unit.countComplete);
            return (
              <tr key={r.organizationCode} data-org={r.organizationCode}>
                <td className="num font-semibold text-ink-soft">{r.rank}</td>
                {showCandidate && (
                  <th scope="row" className="font-medium">
                    <CandidateName r={r} />
                  </th>
                )}
                <td>
                  <span className="flex items-center gap-2.5">
                    <PartyLogo org={org} fallbackName={r.organizationName} size={32} />
                    {org ? (
                      <Link href={`/partidos/${org.slug}/`} className="text-ink no-underline hover:underline">
                        {org.displayName}
                      </Link>
                    ) : (
                      r.organizationName
                    )}
                  </span>
                </td>
                <td className="right num">{formatInt(r.votes)}</td>
                <td className="right">
                  <span className="flex items-center justify-end gap-2">
                    <span className="num whitespace-nowrap">{formatPct(r.validVotePct)}</span>
                    <span aria-hidden="true" className="hidden h-2 w-20 bg-paper sm:block">
                      <span
                        className={`block h-2 ${r.isLeading ? "bg-bar-lead" : "bg-bar"}`}
                        style={{ width: `${(r.validVotePct / max) * 100}%` }}
                      />
                    </span>
                  </span>
                </td>
                <td>
                  <StatusBadge status={key} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
