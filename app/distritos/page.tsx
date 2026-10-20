import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PartyLogo } from "@/components/PartyLogo";
import { StatusBadge, statusKey } from "@/components/StatusBadge";
import { getDistrictElection, getParticipation, getProvinces, orgMap } from "@/lib/data";
import { formatPct } from "@/lib/format";
import { titleCase } from "@/lib/text";

export const metadata: Metadata = {
  title: "Distritos",
  description: "Resultados 2026 de las alcaldías distritales de Moquegua por provincia, con participación por distrito. Fuente: ONPE.",
  alternates: { canonical: "/distritos/" },
};

export default function DistritosPage() {
  const orgs = orgMap();
  const provinces = getProvinces();
  const withElection = provinces.flatMap((p) => p.districts).filter((d) => d.hasDistrictElection).length;
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Distritos" }]} />
      <div>
        <h1 className="m-0 text-4xl">Distritos de Moquegua</h1>
        <p className="prose-note mt-3 text-ink-soft">
          ONPE organiza {provinces.flatMap((p) => p.districts).length} distritos en tres provincias. {withElection} eligen alcaldía
          distrital; los distritos capitales (sede de cada provincia) son administrados por la municipalidad provincial, por lo que
          no tienen una alcaldía distrital aparte.
        </p>
      </div>
      {provinces.map((p) => (
        <section key={p.ubigeo} aria-labelledby={`prov-${p.slug}`}>
          <h2 id={`prov-${p.slug}`} className="m-0 border-b border-rule-strong pb-2 text-2xl">
            <Link href={`/provincias/${p.slug}/`} className="text-ink no-underline hover:underline">
              {p.displayName}
            </Link>
          </h2>
          <ul className="m-0 mt-2 grid list-none gap-x-8 p-0 sm:grid-cols-2">
            {p.districts.map((d) => {
              const de = getDistrictElection(d.ubigeo);
              const top = de?.results[0];
              const dp = getParticipation(d.ubigeo);
              const o = top ? orgs.get(top.organizationCode) : undefined;
              return (
                <li key={d.ubigeo} className="border-b border-rule py-3">
                  <Link href={`/distritos/${d.slug}/`} className="text-lg font-semibold">
                    {d.displayName}
                  </Link>
                  {d.hasDistrictElection && top && de ? (
                    <div className="mt-1.5 flex items-center gap-2 text-sm">
                      <PartyLogo org={o} fallbackName={top.organizationName} size={24} />
                      <span className="min-w-0">
                        {top.candidateName ? titleCase(top.candidateName) : "Sin nombre en ONPE"} · {o?.shortName ?? top.organizationName} ·{" "}
                        <span className="num">{formatPct(top.validVotePct)}</span>
                      </span>
                      <StatusBadge status={statusKey(top, de.unit.countComplete)} />
                    </div>
                  ) : (
                    <p className="m-0 mt-1 text-sm text-ink-soft">Capital provincial. Participación {dp ? formatPct(dp.turnoutPct) : "—"}.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
