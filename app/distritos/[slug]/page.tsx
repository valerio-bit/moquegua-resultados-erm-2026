import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ResultsTable } from "@/components/ResultsTable";
import { ActsProgress, SourceNote, VoteBreakdown } from "@/components/ElectionFacts";
import { ParticipationBar } from "@/components/ParticipationBar";
import { getDistrictBySlug, getDistrictElection, getDistricts, getParticipation, getProvincial, orgMap } from "@/lib/data";
import { formatPct } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDistricts().map(({ district }) => ({ slug: district.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const x = getDistrictBySlug(slug);
  if (!x) return {};
  const de = getDistrictElection(x.district.ubigeo);
  const first = de?.results[0];
  return {
    title: `Distrito de ${x.district.displayName}`,
    description: x.district.hasDistrictElection
      ? `Resultados 2026 de la alcaldía distrital de ${x.district.displayName} (${x.province.displayName}, Moquegua): ${de?.results.length ?? 0} candidaturas${
          first ? `, encabeza ${first.organizationName} con ${formatPct(first.validVotePct)}` : ""
        }. Fuente: ONPE.`
      : `${x.district.displayName} es la capital de la provincia ${x.province.displayName}: participación y enlace a la alcaldía provincial. Fuente: ONPE.`,
    alternates: { canonical: `/distritos/${x.district.slug}/` },
  };
}

export default async function DistritoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = getDistrictBySlug(slug);
  if (!x) notFound();
  const { district: d, province: p } = x;
  const de = getDistrictElection(d.ubigeo);
  const part = getParticipation(d.ubigeo);
  const prov = getProvincial(p.ubigeo);
  const orgs = orgMap();

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs
          items={[
            { href: "/", label: "Inicio" },
            { href: "/provincias/", label: "Provincias" },
            { href: `/provincias/${p.slug}/`, label: p.displayName },
            { label: d.displayName },
          ]}
        />
        <h1 className="m-0 text-4xl">Distrito de {d.displayName}</h1>
        <p className="m-0 mt-1 text-ink-soft">Provincia de {p.displayName}, región Moquegua</p>
      </div>

      {d.hasDistrictElection && de ? (
        <>
          <section aria-labelledby="alcaldia-distrital" className="space-y-4">
            <h2 id="alcaldia-distrital" className="m-0 border-b border-rule-strong pb-2 text-2xl">
              Alcaldía distrital
            </h2>
            <p className="prose-note m-0 text-ink-soft">{de.unit.outcome.note}</p>
            <ResultsTable
              unit={de.unit}
              results={de.results}
              orgs={orgs}
              caption={`Alcaldía distrital de ${d.displayName}: ${de.results.length} candidaturas (cómputo ONPE).`}
            />
            <SourceNote unit={de.unit} />
          </section>
          <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div>
              <h2 className="m-0 mb-4 text-2xl">Votos</h2>
              <VoteBreakdown unit={de.unit} />
            </div>
            <div>
              <h2 className="m-0 mb-4 text-2xl">Avance de actas</h2>
              <ActsProgress unit={de.unit} />
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-sm border border-rule bg-surface p-5" aria-labelledby="capital">
          <h2 id="capital" className="m-0 text-2xl">
            Capital de la provincia {p.displayName}
          </h2>
          <p className="prose-note mb-0 mt-2">
            {d.displayName} es el distrito capital: su gobierno local es la Municipalidad Provincial de {p.displayName}, por lo que ONPE
            no presenta una alcaldía distrital separada. Consulta los{" "}
            <Link href={`/provincias/${p.slug}/`}>resultados de la alcaldía provincial</Link>
            {prov ? ` (${prov.results.length} candidaturas)` : ""}.
          </p>
        </section>
      )}

      {part && (
        <section aria-labelledby="participacion-dist">
          <h2 id="participacion-dist" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Participación y ausentismo
          </h2>
          <div className="mt-4">
            <ParticipationBar p={part} />
          </div>
        </section>
      )}
    </div>
  );
}
