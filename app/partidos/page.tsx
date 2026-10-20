import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PartyLogo } from "@/components/PartyLogo";
import { getPartyStats } from "@/lib/data";
import { formatInt, formatPct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Partidos",
  description:
    "Panel por organización política en Moquegua 2026: alcaldías provinciales y distritales encabezadas, jurisdicciones, candidaturas y votos por elección. Fuente: ONPE.",
  alternates: { canonical: "/partidos/" },
};

export default function PartidosPage() {
  const stats = getPartyStats();
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Partidos" }]} />
      <h1 className="m-0 text-4xl">Organizaciones políticas</h1>
      <p className="prose-note m-0 text-ink-soft">
        {stats.length} organizaciones obtuvieron votos en Moquegua. Los conteos de alcaldías son primeros lugares en el cómputo ONPE,
        no autoridades electas. Los votos se muestran por elección y circunscripción: sumar votos de circunscripciones distintas no
        produce un resultado electoral (ver la metodología en cada ficha).
      </p>
      <div className="table-wrap">
        <table className="data-table" data-testid="party-dashboard">
          <caption>Panel por organización, ordenado por alcaldías encabezadas.</caption>
          <thead>
            <tr>
              <th scope="col">Organización</th>
              <th scope="col" className="right">
                Alcaldías provinciales encabezadas
              </th>
              <th scope="col" className="right">
                Alcaldías distritales encabezadas
              </th>
              <th scope="col" className="right">
                Jurisdicciones con candidatura
              </th>
              <th scope="col" className="right">
                Candidaturas
              </th>
              <th scope="col" className="right">
                Gobierno regional
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.org.code}>
                <th scope="row" className="font-normal">
                  <span className="flex items-center gap-2.5">
                    <PartyLogo org={s.org} size={32} />
                    <Link href={`/partidos/${s.org.slug}/`} className="font-medium">
                      {s.org.displayName}
                    </Link>
                  </span>
                </th>
                <td className="right num">{s.provincialLeads.length}</td>
                <td className="right num">{s.districtLeads.length}</td>
                <td className="right num">{s.jurisdictions}</td>
                <td className="right num">{s.candidacies.length}</td>
                <td className="right num">
                  {s.governor ? `${formatPct(s.governor.validVotePct)} (${formatInt(s.governor.votes)})` : <span className="text-ink-faint">sin fórmula</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
