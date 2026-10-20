import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProvinceTabs } from "@/components/ProvinceTabs";
import { ResultsTable } from "@/components/ResultsTable";
import { ActsProgress, SourceNote, VoteBreakdown } from "@/components/ElectionFacts";
import { ParticipationBar } from "@/components/ParticipationBar";
import { PartyLogo } from "@/components/PartyLogo";
import { StatusBadge, statusKey } from "@/components/StatusBadge";
import { getCouncil, getDistrictElection, getParticipation, getProvinceBySlug, getProvinces, getProvincial, orgMap } from "@/lib/data";
import { formatPct } from "@/lib/format";
import { titleCase } from "@/lib/text";

export const dynamicParams = false;

export function generateStaticParams() {
  return getProvinces().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProvinceBySlug(slug);
  if (!p) return {};
  const prov = getProvincial(p.ubigeo);
  const first = prov?.results[0];
  return {
    title: `Provincia de ${p.displayName}`,
    description: `Resultados 2026 de la alcaldía provincial de ${p.displayName} (Moquegua): ${prov?.results.length ?? 0} candidaturas${
      first ? `, encabeza ${first.organizationName} con ${formatPct(first.validVotePct)}` : ""
    }. Distritos, participación y Consejo Regional. Fuente: ONPE.`,
    alternates: { canonical: `/provincias/${p.slug}/` },
    openGraph: { title: `Provincia de ${p.displayName} — Resultados 2026` },
  };
}

export default async function ProvinciaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProvinceBySlug(slug);
  if (!p) notFound();
  const prov = getProvincial(p.ubigeo);
  const council = getCouncil(p.ubigeo);
  const part = getParticipation(p.ubigeo);
  const orgs = orgMap();
  const first = prov?.results[0];
  const firstOrg = first ? orgs.get(first.organizationCode) : undefined;

  return (
    <div className="space-y-12">
      <div className="space-y-5">
        <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { href: "/provincias/", label: "Provincias" }, { label: p.displayName }]} />
        <ProvinceTabs current={p.slug} />
        <h1 className="m-0 text-4xl">Provincia de {p.displayName}</h1>
      </div>

      {prov && first && (
        <section aria-labelledby="primer-lugar" className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 id="primer-lugar" className="m-0 text-2xl">
              Alcaldía provincial
            </h2>
            <div className="mt-4 flex items-start gap-4 rounded-sm border border-rule bg-surface p-4">
              <PartyLogo org={firstOrg} fallbackName={first.organizationName} size={64} />
              <div>
                <p className="m-0 text-sm text-ink-soft">Va primero (conteo ONPE)</p>
                <p className="m-0 font-serif text-2xl font-semibold leading-tight">
                  {first.candidateName ? titleCase(first.candidateName) : "Sin nombre en ONPE"}
                </p>
                <p className="m-0 text-ink-soft">{firstOrg?.displayName ?? first.organizationName}</p>
                <p className="m-0 mt-2 flex flex-wrap items-center gap-2">
                  <span className="num text-xl font-semibold">{formatPct(first.validVotePct)}</span>
                  <StatusBadge status={statusKey(first, prov.unit.countComplete)} />
                </p>
                <p className="m-0 mt-2 text-sm text-ink-soft">{prov.unit.outcome.note}</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="m-0 text-2xl">Avance de actas</h2>
            <div className="mt-4">
              <ActsProgress unit={prov.unit} />
            </div>
          </div>
        </section>
      )}

      {prov && (
        <section aria-labelledby="candidatos-provinciales">
          <h2 id="candidatos-provinciales" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Todas las candidaturas provinciales
          </h2>
          <div className="mt-4">
            <ResultsTable
              unit={prov.unit}
              results={prov.results}
              orgs={orgs}
              caption={`Alcaldía provincial de ${p.displayName}: ${prov.results.length} candidaturas (cómputo ONPE).`}
            />
          </div>
          <SourceNote unit={prov.unit} />
          <div className="mt-8">
            <VoteBreakdown unit={prov.unit} />
          </div>
        </section>
      )}

      <section aria-labelledby="distritos">
        <h2 id="distritos" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Distritos de {p.displayName}
        </h2>
        <div className="table-wrap mt-4">
          <table className="data-table">
            <caption>Quién va primero en cada distrito y cuánta gente votó.</caption>
            <thead>
              <tr>
                <th scope="col">Distrito</th>
                <th scope="col">Primer lugar (alcaldía distrital)</th>
                <th scope="col" className="right">
                  % válidos
                </th>
                <th scope="col">Estado</th>
                <th scope="col" className="right">
                  Participación
                </th>
              </tr>
            </thead>
            <tbody>
              {p.districts.map((d) => {
                const de = getDistrictElection(d.ubigeo);
                const top = de?.results[0];
                const dp = getParticipation(d.ubigeo);
                const o = top ? orgs.get(top.organizationCode) : undefined;
                return (
                  <tr key={d.ubigeo}>
                    <th scope="row">
                      <Link href={`/distritos/${d.slug}/`}>{d.displayName}</Link>
                    </th>
                    <td>
                      {d.hasDistrictElection && top ? (
                        <span className="flex items-center gap-2">
                          <PartyLogo org={o} fallbackName={top.organizationName} size={26} />
                          <span>
                            {top.candidateName ? titleCase(top.candidateName) : "Sin nombre en ONPE"}
                            <span className="block text-xs text-ink-soft">{o?.displayName ?? top.organizationName}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-ink-soft">Capital: aquí gobierna la municipalidad provincial</span>
                      )}
                    </td>
                    <td className="right num">{top ? formatPct(top.validVotePct) : "—"}</td>
                    <td>{top && de ? <StatusBadge status={statusKey(top, de.unit.countComplete)} /> : "—"}</td>
                    <td className="right num">{dp ? formatPct(dp.turnoutPct) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 space-y-3">
          {p.districts
            .filter((d) => d.hasDistrictElection)
            .map((d) => {
              const de = getDistrictElection(d.ubigeo);
              if (!de) return null;
              return (
                <details key={d.ubigeo} className="rounded-sm border border-rule bg-surface">
                  <summary className="cursor-pointer px-4 py-3 font-semibold">
                    Resultados distritales de {d.displayName} ({de.results.length} candidaturas)
                  </summary>
                  <div className="border-t border-rule px-4 py-4">
                    <ResultsTable unit={de.unit} results={de.results} orgs={orgs} caption={`Alcaldía distrital de ${d.displayName}.`} />
                    <SourceNote unit={de.unit} />
                  </div>
                </details>
              );
            })}
        </div>
      </section>

      {part && (
        <section aria-labelledby="participacion-prov">
          <h2 id="participacion-prov" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Participación y ausentismo
          </h2>
          <div className="mt-4">
            <ParticipationBar p={part} />
          </div>
        </section>
      )}

      {council && (
        <section aria-labelledby="consejo-prov">
          <h2 id="consejo-prov" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Consejo Regional en {p.displayName}
          </h2>
          <p className="prose-note mt-3 text-sm text-ink-soft">
            Votos por lista en esta provincia. El Jurado Electoral reparte los asientos.
          </p>
          <ResultsTable unit={council.unit} results={council.results} orgs={orgs} showCandidate={false} caption={`Consejo Regional, ${p.displayName}.`} />
          <SourceNote unit={council.unit} />
        </section>
      )}
    </div>
  );
}
