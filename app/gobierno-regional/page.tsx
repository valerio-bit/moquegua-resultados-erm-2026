import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GovernorSummary } from "@/components/GovernorSummary";
import { ResultsTable } from "@/components/ResultsTable";
import { ActsProgress, SourceNote, VoteBreakdown } from "@/components/ElectionFacts";
import { getCouncil, getGovernor, getProvinces, orgMap } from "@/lib/data";
import { formatInt } from "@/lib/format";

export const metadata: Metadata = {
  title: "Gobierno Regional",
  description:
    "Resultados de la elección de gobernador y vicegobernador regional de Moquegua 2026: todas las fórmulas, votos, porcentajes, segunda vuelta y Consejo Regional por provincia. Fuente: ONPE.",
  alternates: { canonical: "/gobierno-regional/" },
};

export default function GobiernoRegionalPage() {
  const { unit, results } = getGovernor();
  const orgs = orgMap();
  return (
    <div className="space-y-12">
      <div>
        <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Gobierno Regional" }]} />
        <GovernorSummary headingLevel={1} showLink={false} />
      </div>

      <section aria-labelledby="formulas">
        <h2 id="formulas" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Todas las fórmulas
        </h2>
        <div className="mt-4">
          <ResultsTable
            unit={unit}
            results={results}
            orgs={orgs}
            caption={`Gobernador regional de Moquegua: ${results.length} fórmulas, de más a menos votos (conteo ONPE).`}
          />
        </div>
        <SourceNote unit={unit} />
      </section>

      <section aria-labelledby="votos" className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 id="votos" className="m-0 mb-4 text-2xl">
            Cómo votó la gente
          </h2>
          <VoteBreakdown unit={unit} />
        </div>
        <div>
          <h2 className="m-0 mb-4 text-2xl">Avance de actas</h2>
          <ActsProgress unit={unit} />
        </div>
      </section>

      <section aria-labelledby="consejo">
        <h2 id="consejo" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Consejo Regional
        </h2>
        <p className="prose-note mt-3 text-ink-soft">
          El consejo regional se vota por listas en cada provincia. Aquí ves los votos de cada lista. El Jurado Electoral reparte los
          asientos; nosotros no los calculamos.
        </p>
        <div className="mt-6 space-y-10">
          {getProvinces().map((p) => {
            const c = getCouncil(p.ubigeo);
            if (!c) return null;
            return (
              <div key={p.ubigeo}>
                <h3 className="m-0 mb-3 text-xl">
                  Provincia de <Link href={`/provincias/${p.slug}/`}>{p.displayName}</Link>
                </h3>
                <ResultsTable
                  unit={c.unit}
                  results={c.results}
                  orgs={orgs}
                  showCandidate={false}
                  caption={`Consejo Regional, circunscripción ${p.displayName}: votos por lista. Válidos ${formatInt(c.unit.validVotes)}, blancos ${formatInt(c.unit.blankVotes)}, nulos ${formatInt(c.unit.nullVotes)}.`}
                />
                <SourceNote unit={c.unit} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
