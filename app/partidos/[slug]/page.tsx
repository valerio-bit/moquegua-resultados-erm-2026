import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PartyLogo } from "@/components/PartyLogo";
import { CandidateName } from "@/components/ResultsTable";
import { StatusBadge, statusKey } from "@/components/StatusBadge";
import { getDataset, getOrganizationBySlug, getOrganizations, getPartyStats, jurisdictionHref, jurisdictionLabel } from "@/lib/data";
import { formatInt, formatPct } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return getOrganizations().map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) return {};
  const s = getPartyStats().find((x) => x.org.code === org.code);
  return {
    title: org.displayName,
    description: `${org.displayName} en las elecciones 2026 de Moquegua: ${s?.candidacies.length ?? 0} candidaturas, ${s?.provincialLeads.length ?? 0} alcaldías provinciales y ${s?.districtLeads.length ?? 0} distritales encabezadas en el cómputo ONPE.`,
    alternates: { canonical: `/partidos/${org.slug}/` },
  };
}

export default async function PartidoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) notFound();
  const s = getPartyStats().find((x) => x.org.code === org.code)!;
  const units = new Map(getDataset().elections.map((e) => [e.id, e]));
  const rows = [...s.candidacies].sort((a, b) => a.electionId - b.electionId || a.ubigeo.localeCompare(b.ubigeo));

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { href: "/partidos/", label: "Partidos" }, { label: org.displayName }]} />
        <div className="flex items-center gap-4">
          <PartyLogo org={org} size={72} />
          <div>
            <h1 className="m-0 text-3xl sm:text-4xl">{org.displayName}</h1>
            <p className="m-0 text-sm text-ink-soft">Nombre en ONPE: {org.name}</p>
          </div>
        </div>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {[
          ["Alcaldías provinciales encabezadas", s.provincialLeads.length],
          ["Alcaldías distritales encabezadas", s.districtLeads.length],
          ["Jurisdicciones con candidatura", s.jurisdictions],
          ["Candidaturas", s.candidacies.length],
        ].map(([label, value]) => (
          <div key={label as string} className="border-t border-rule pt-2">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="num m-0 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="candidaturas">
        <h2 id="candidaturas" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Candidaturas y resultados
        </h2>
        <div className="table-wrap mt-4">
          <table className="data-table">
            <caption>Cada fila es una elección en una circunscripción distinta (cómputo ONPE).</caption>
            <thead>
              <tr>
                <th scope="col">Elección</th>
                <th scope="col">Ámbito</th>
                <th scope="col">Candidatura</th>
                <th scope="col" className="right">
                  Votos
                </th>
                <th scope="col" className="right">
                  % válidos
                </th>
                <th scope="col" className="right">
                  Puesto
                </th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unitId}>
                  <td>{r.electionName}</td>
                  <th scope="row" className="font-normal">
                    <Link href={jurisdictionHref(r)}>{jurisdictionLabel(r)}</Link>
                  </th>
                  <td>
                    <CandidateName r={r} />
                  </td>
                  <td className="right num">{formatInt(r.votes)}</td>
                  <td className="right num">{formatPct(r.validVotePct)}</td>
                  <td className="right num">{r.rank}</td>
                  <td>
                    <StatusBadge status={statusKey(r, units.get(r.unitId)?.countComplete ?? false)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="votos-eleccion">
        <h2 id="votos-eleccion" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Votos por tipo de elección
        </h2>
        <p className="prose-note mt-3 text-sm text-ink-soft">
          Metodología: la columna «Suma descriptiva» agrega votos obtenidos en circunscripciones distintas (por ejemplo, varios
          distritos). No es el resultado de una única elección ni sirve para comparar fuerzas entre circunscripciones de distinto
          tamaño; solo el gobierno regional es una elección única en toda la región.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <caption>Votos válidos de {org.displayName} por tipo de elección.</caption>
            <thead>
              <tr>
                <th scope="col">Elección</th>
                <th scope="col" className="right">
                  Circunscripciones
                </th>
                <th scope="col" className="right">
                  Suma descriptiva de votos
                </th>
              </tr>
            </thead>
            <tbody>
              {s.votesByElection.map((v) => (
                <tr key={v.electionId}>
                  <th scope="row" className="font-normal">
                    {v.electionName}
                  </th>
                  <td className="right num">{v.circunscriptions}</td>
                  <td className="right num">{formatInt(v.votes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {org.logo && (
        <section aria-labelledby="simbolo" className="text-sm text-ink-soft">
          <h2 id="simbolo" className="m-0 text-xl text-ink">
            Procedencia del símbolo
          </h2>
          <p className="prose-note mb-0 mt-2 break-words">
            Archivo descargado sin modificaciones de <a href={org.logo.sourceUrl}>{org.logo.sourceUrl}</a> ({org.logo.sourceKind === "onpe-interface" ? "activo público de la interfaz de ONPE" : org.logo.sourceKind}). SHA-256: <span className="break-all font-mono text-xs">{org.logo.sha256}</span>. Verificado: {org.logo.verified ? "sí" : "no"}.
          </p>
        </section>
      )}
    </div>
  );
}
