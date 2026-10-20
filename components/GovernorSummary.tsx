import Link from "next/link";
import { getDataset, getGovernor, orgMap } from "@/lib/data";
import { formatActsPct, formatPct } from "@/lib/format";
import { titleCase } from "@/lib/text";
import { ThresholdChart } from "./ThresholdChart";
import { StatusBadge } from "./StatusBadge";

const dateFmt = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function governorHeadline(kind: string): string {
  switch (kind) {
    case "SEGUNDA_VUELTA":
      return "El Gobierno Regional se define en segunda vuelta";
    case "PRIMER_LUGAR_VIRTUAL":
      return "Gobierno Regional: hay un primer lugar virtual";
    case "PROCLAMADO":
      return "Gobierno Regional: fórmula proclamada";
    default:
      return "Gobierno Regional: cómputo en curso";
  }
}

export function GovernorSummary({ headingLevel = 2, showLink = true }: { headingLevel?: 1 | 2; showLink?: boolean }) {
  const { unit, results } = getGovernor();
  const { meta } = getDataset();
  const orgs = orgMap();
  const rule = meta.secondRoundRule;
  const runoff = results.filter((r) => r.status === "SEGUNDA_VUELTA");
  const top = results[0];
  const H = headingLevel === 1 ? "h1" : "h2";
  const name = (code: string) => orgs.get(code)?.displayName ?? code;

  return (
    <section aria-labelledby="gobierno-regional-titulo" className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
      <div>
        <p className="m-0 mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          Gobernador y vicegobernador regional
          {unit.outcome.kind === "SEGUNDA_VUELTA" && <StatusBadge status="SEGUNDA_VUELTA" />}
        </p>
        <H id="gobierno-regional-titulo" className="m-0 text-3xl leading-tight sm:text-4xl">
          {governorHeadline(unit.outcome.kind)}
        </H>
        {unit.outcome.kind === "SEGUNDA_VUELTA" && runoff.length === 2 ? (
          <div className="prose-note mt-4 space-y-3 text-[1.0625rem]">
            <p className="m-0">
              Con el {formatActsPct(unit.countedActsPct)} de actas contabilizadas por ONPE, ninguna fórmula alcanza el {rule.thresholdPct} % de
              votos válidos que exige la ley para ganar en primera vuelta.
            </p>
            <ol className="m-0 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-st-segunda">
              {runoff.map((r) => (
                <li key={r.organizationCode}>
                  <strong>{titleCase(r.candidateName)}</strong> ({name(r.organizationCode)}):{" "}
                  <span className="num">{formatPct(r.validVotePct)}</span>
                </li>
              ))}
            </ol>
            <p className="m-0">
              Ambas fórmulas irían a la segunda elección regional del {dateFmt.format(new Date(`${rule.electionDate}T00:00:00Z`))},{" "}
              según la regla oficializada por el JNE (<a href={rule.sourceUrl}>fuente</a>). <strong>Aún no hay gobernador electo</strong>: falta la
              proclamación del Jurado Electoral y la segunda votación.
            </p>
          </div>
        ) : (
          <p className="prose-note mt-4 text-[1.0625rem]">
            {top ? (
              <>
                Encabeza el cómputo {titleCase(top.candidateName)} ({name(top.organizationCode)}) con {formatPct(top.validVotePct)} de votos
                válidos. {unit.outcome.note}
              </>
            ) : (
              unit.outcome.note
            )}
          </p>
        )}
        {showLink && (
          <p className="mt-5">
            <Link href="/gobierno-regional/" className="font-semibold">
              Ver las {results.length} fórmulas y el detalle de votos
            </Link>
          </p>
        )}
      </div>
      <div className="rounded-sm border border-rule bg-surface p-4 sm:p-5">
        <ThresholdChart results={results} orgs={orgs} threshold={rule.thresholdPct} />
      </div>
    </section>
  );
}
