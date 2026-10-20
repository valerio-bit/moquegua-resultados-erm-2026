import Link from "next/link";
import { GovernorSummary } from "@/components/GovernorSummary";
import { ProvinceSummary } from "@/components/ProvinceSummary";
import { ParticipationBar } from "@/components/ParticipationBar";
import { PartyLogo } from "@/components/PartyLogo";
import { SearchBox } from "@/components/SearchBox";
import { TerritorySelector } from "@/components/TerritorySelector";
import { getDataset, getGovernor, getParticipation, getPartyStats, getProvinces } from "@/lib/data";
import { buildSearchIndex } from "@/lib/search";
import { formatActsPct, formatDateTime } from "@/lib/format";
import { SITE_NAME, SOURCE_LINE } from "@/lib/site";

export default function HomePage() {
  const ds = getDataset();
  const gov = getGovernor();
  const region = getParticipation(ds.meta.departmentUbigeo);
  const stats = getPartyStats().filter((s) => s.provincialLeads.length + s.districtLeads.length > 0);
  const totalMayoralties = ds.elections.filter((e) => e.electionId === 3 || e.electionId === 4).length;
  const complete = ds.elections.filter((e) => (e.electionId === 3 || e.electionId === 4) && e.countComplete).length;
  const territory = getProvinces().map((p) => ({
    slug: p.slug,
    name: p.displayName,
    districts: p.districts.map((d) => ({ slug: d.slug, name: d.displayName })),
  }));

  return (
    <div className="space-y-14">
      <header className="border-b border-rule pb-6">
        <h1 className="m-0 font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">{SITE_NAME}</h1>
        <div className="mt-4 grid gap-x-8 gap-y-2 text-sm text-ink-soft sm:grid-cols-3">
          <p className="m-0">
            <span className="block text-ink-faint">Última actualización</span>
            <span className="font-medium text-ink">{formatDateTime(ds.meta.sourceTimestampMax)}</span>
          </p>
          <p className="m-0">
            <span className="block text-ink-faint">Avance de actas, gobierno regional</span>
            <span className="num font-medium text-ink">
              {formatActsPct(gov.unit.countedActsPct)} ({gov.unit.countedActs} de {gov.unit.totalActs})
            </span>
          </p>
          <p className="m-0">
            <span className="block text-ink-faint">Fuente</span>
            <span className="font-medium text-ink">{SOURCE_LINE}</span>
          </p>
        </div>
      </header>

      <GovernorSummary />

      <section aria-labelledby="explorar" className="rounded-sm border border-rule bg-surface p-4 sm:p-6">
        <h2 id="explorar" className="m-0 mb-4 text-2xl">
          Busca o elige un territorio
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <SearchBox index={buildSearchIndex(ds)} />
          <TerritorySelector provinces={territory} />
        </div>
      </section>

      <section aria-labelledby="provincias-titulo">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule-strong pb-2">
          <h2 id="provincias-titulo" className="m-0 text-2xl">
            Las tres provincias
          </h2>
          <Link href="/provincias/" className="text-sm font-semibold">
            Ver provincias y distritos
          </Link>
        </div>
        <ProvinceSummary />
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="alcaldias-partido">
          <h2 id="alcaldias-partido" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Alcaldías por partido
          </h2>
          <div className="table-wrap mt-3">
            <table className="data-table">
              <caption>
                Primeros lugares en el cómputo ONPE de {totalMayoralties} alcaldías ({complete} con actas al 100 %). No son autoridades
                electas ni proclamadas.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Organización</th>
                  <th scope="col" className="right">
                    Provinciales
                  </th>
                  <th scope="col" className="right">
                    Distritales
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.org.code}>
                    <th scope="row" className="font-normal">
                      <span className="flex items-center gap-2.5">
                        <PartyLogo org={s.org} size={28} />
                        <Link href={`/partidos/${s.org.slug}/`} className="text-ink no-underline hover:underline">
                          {s.org.displayName}
                        </Link>
                      </span>
                    </th>
                    <td className="right num">{s.provincialLeads.length}</td>
                    <td className="right num">{s.districtLeads.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            <Link href="/partidos/">Ver el panel de todas las organizaciones</Link>
          </p>
        </section>

        <section aria-labelledby="participacion-titulo">
          <h2 id="participacion-titulo" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Participación y ausentismo
          </h2>
          <div className="mt-4">{region ? <ParticipationBar p={region} /> : <p>Sin datos de participación.</p>}</div>
          <p className="mt-4 text-sm">
            <Link href="/participacion/">Ver participación por provincia y distrito</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
