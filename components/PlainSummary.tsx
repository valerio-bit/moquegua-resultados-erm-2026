import Link from "next/link";
import { getDataset, getGovernor, getParticipation, getProvinces, getProvincial, orgMap } from "@/lib/data";
import { formatInt, formatPctShort } from "@/lib/format";
import { titleCase } from "@/lib/text";

const dateFmt = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", timeZone: "UTC" });

/** Resumen en lenguaje sencillo de todo Moquegua. Cada frase sale de los datos publicados. */
export function PlainSummary() {
  const ds = getDataset();
  const orgs = orgMap();
  const short = (code: string) => orgs.get(code)?.shortName ?? orgs.get(code)?.displayName ?? code;
  const gov = getGovernor();
  const rule = ds.meta.secondRoundRule;
  const runoff = gov.results.filter((r) => r.status === "SEGUNDA_VUELTA");
  const top = gov.results[0];

  let governor: string;
  if (gov.unit.outcome.kind === "SEGUNDA_VUELTA" && runoff.length === 2) {
    governor = `Nadie llegó al ${rule.thresholdPct} % de votos válidos. ${short(runoff[0]!.organizationCode)} (${formatPctShort(runoff[0]!.validVotePct)}) y ${short(runoff[1]!.organizationCode)} (${formatPctShort(runoff[1]!.validVotePct)}) irían a segunda vuelta el ${dateFmt.format(new Date(`${rule.electionDate}T00:00:00Z`))}.`;
  } else if (top) {
    governor = `Va primero ${short(top.organizationCode)} con ${formatPctShort(top.validVotePct)}. ${gov.unit.countComplete ? "Falta la proclamación." : "Todavía se están contando actas."}`;
  } else governor = "Sin datos todavía.";

  const districtLeads = new Map<string, number>();
  const districtUnits = ds.elections.filter((e) => e.electionId === 4);
  for (const e of districtUnits) for (const code of e.outcome.organizationCodes) districtLeads.set(code, (districtLeads.get(code) ?? 0) + 1);
  const ranking = [...districtLeads.entries()].sort((a, b) => b[1] - a[1]);
  const shown = ranking.slice(0, 3).map(([code, n]) => `${short(code)} en ${n}`);
  const rest = ranking.slice(3).reduce((a, [, n]) => a + n, 0);

  const region = getParticipation(ds.meta.departmentUbigeo);
  const proclaimed = ds.results.filter((r) => r.status === "PROCLAMADO_JNE_JEE").length;

  return (
    <section aria-labelledby="pocas-palabras" className="rounded-sm border-l-4 border-accent bg-surface px-5 py-4" data-testid="plain-summary">
      <h2 id="pocas-palabras" className="m-0 text-2xl">
        Moquegua en pocas palabras
      </h2>
      <ul className="m-0 mt-3 list-none space-y-2.5 p-0 text-[1.0625rem] leading-relaxed">
        <li>
          <strong>Gobernador regional.</strong> {governor}{" "}
          <Link href="/gobierno-regional/" className="text-sm">
            Ver detalle
          </Link>
        </li>
        <li>
          <strong>Alcaldes provinciales.</strong>{" "}
          {getProvinces()
            .map((p) => {
              const prov = getProvincial(p.ubigeo);
              const first = prov?.results[0];
              if (!prov || !first) return `${p.displayName}: sin datos`;
              const who = first.candidateName ? `${titleCase(first.candidateName)} (${short(first.organizationCode)})` : short(first.organizationCode);
              return `en ${p.displayName} va primero ${who}${prov.unit.countComplete ? "" : ", pero falta contar actas"}`;
            })
            .join("; ")
            .replace(/^en/, "En")}
          .
        </li>
        <li>
          <strong>Alcaldes distritales.</strong> Hay {districtUnits.length} distritos con alcaldía propia. Van primero {shown.join(", ")}
          {rest > 0 ? ` y otros partidos en ${rest}` : ""}.
        </li>
        {region && (
          <li>
            <strong>Participación.</strong> Votó el {formatPctShort(region.turnoutPct)} de los {formatInt(region.eligibleVoters)} electores.{" "}
            {formatInt(region.absentees)} no fueron a votar
            {region.pendingVoters > 0 ? ` y faltan contar ${formatInt(region.pendingVoters)} electores de actas observadas` : ""}.
          </li>
        )}
        <li>
          <strong>Ojo.</strong> Ir primero en el conteo no es haber ganado.{" "}
          {proclaimed === 0
            ? "Nadie ha sido proclamado todavía: eso lo hace el Jurado Electoral."
            : `El Jurado Electoral ya proclamó ${proclaimed} candidatura(s); el resto sigue pendiente.`}
        </li>
      </ul>
    </section>
  );
}
