import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { InfoTip } from "@/components/InfoTip";
import { ParticipationBar } from "@/components/ParticipationBar";
import { getDataset, getParticipation, getProvinces } from "@/lib/data";
import { formatInt, formatPct } from "@/lib/format";
import type { Participation } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "Participación y ausentismo",
  description:
    "Participación electoral y ausentismo en Moquegua 2026: total regional, por provincia y por distrito, con electores hábiles, votantes y ausentes. Fuente: ONPE.",
  alternates: { canonical: "/participacion/" },
};

function Row({ p, name, href, level }: { p: Participation; name: string; href?: string; level: "province" | "district" }) {
  return (
    <tr data-ubigeo={p.ubigeo}>
      <th scope="row" className={level === "district" ? "pl-6 font-normal" : ""}>
        {href ? <Link href={href}>{name}</Link> : name}
      </th>
      <td className="right num">{formatInt(p.eligibleVoters)}</td>
      <td className="right num">{formatInt(p.votersWhoVoted)}</td>
      <td className="right num">{formatInt(p.absentees)}</td>
      <td className="right num font-semibold text-accent">{formatPct(p.turnoutPct)}</td>
      <td className="right num">{formatPct(p.absenteePct)}</td>
      <td className="right num">{p.pendingVoters > 0 ? <span className="text-st-parcial">{formatInt(p.pendingVoters)}</span> : "0"}</td>
    </tr>
  );
}

export default function ParticipacionPage() {
  const ds = getDataset();
  const region = getParticipation(ds.meta.departmentUbigeo);
  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Participación y ausentismo" }]} />
        <h1 className="m-0 text-4xl">Participación y ausentismo</h1>
      </div>

      {region && (
        <section aria-labelledby="region">
          <h2 id="region" className="m-0 border-b border-rule-strong pb-2 text-2xl">
            Región Moquegua
          </h2>
          <div className="mt-4">
            <ParticipationBar p={region} />
          </div>
        </section>
      )}

      <section aria-labelledby="detalle">
        <h2 id="detalle" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Por provincia y distrito
        </h2>
        <div className="table-wrap mt-4">
          <table className="data-table" data-testid="participation-table">
            <caption>
              Cuánta gente podía votar, cuánta votó y cuánta no fue (ONPE). «Pendientes» son electores de actas que aún no se cuentan.
            </caption>
            <thead>
              <tr>
                <th scope="col">Ámbito</th>
                <th scope="col" className="right">
                  Electores hábiles
                </th>
                <th scope="col" className="right">
                  Votaron
                </th>
                <th scope="col" className="right">
                  Ausentes
                </th>
                <th scope="col" className="right">
                  Participación
                </th>
                <th scope="col" className="right">
                  Ausentismo
                </th>
                <th scope="col" className="right">
                  Pendientes
                </th>
              </tr>
            </thead>
            <tbody>
              {getProvinces().map((p) => {
                const pp = getParticipation(p.ubigeo);
                return [
                  pp ? <Row key={p.ubigeo} p={pp} name={`Provincia ${p.displayName}`} href={`/provincias/${p.slug}/`} level="province" /> : null,
                  ...p.districts.map((d) => {
                    const dp = getParticipation(d.ubigeo);
                    return dp ? <Row key={d.ubigeo} p={dp} name={d.displayName} href={`/distritos/${d.slug}/`} level="district" /> : null;
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="definiciones" className="grid gap-6 md:grid-cols-2">
        <h2 id="definiciones" className="m-0 text-2xl md:col-span-2">
          Qué mide cada indicador
        </h2>
        <div>
          <h3 className="m-0 text-lg">
            Participación
            <InfoTip label="fórmula de participación">participación = votaron ÷ electores hábiles × 100</InfoTip>
          </h3>
          <p className="mt-1">De cada 100 personas que podían votar, cuántas votaron. Cuenta también el voto en blanco y nulo.</p>
        </div>
        <div>
          <h3 className="m-0 text-lg">
            Ausentismo
            <InfoTip label="fórmula de ausentismo">ausentes = hábiles − votaron; ausentismo = ausentes ÷ hábiles × 100</InfoTip>
          </h3>
          <p className="mt-1">
            Personas que podían votar y no fueron. No es lo mismo que voto en blanco o nulo: esa gente sí votó.
          </p>
        </div>
        <div>
          <h3 className="m-0 text-lg">Electores pendientes</h3>
          <p className="mt-1">
            Si un acta está en el Jurado Electoral Especial, ONPE todavía no cuenta a sus electores ni como votantes ni como ausentes. Los
            mostramos aparte y el dato queda como provisional.
          </p>
        </div>
        <div>
          <h3 className="m-0 text-lg">Base de cálculo</h3>
          <p className="mt-1">
            Son las cifras de participación de ONPE, que usan las actas de la elección de alcalde provincial. Cada elección muestra
            además su propia participación.
          </p>
        </div>
      </section>
    </div>
  );
}
