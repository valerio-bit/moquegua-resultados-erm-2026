import Link from "next/link";
import { getParticipation, getProvincial, getProvinces, orgMap } from "@/lib/data";
import { formatActsPct, formatPct } from "@/lib/format";
import { titleCase } from "@/lib/text";
import { PartyLogo } from "./PartyLogo";
import { StatusBadge, statusKey } from "./StatusBadge";

/** Las tres provincias en paralelo: primer lugar provincial, actas y participación. */
export function ProvinceSummary() {
  const orgs = orgMap();
  return (
    <ul className="m-0 grid list-none gap-0 p-0 md:grid-cols-3 md:divide-x md:divide-rule">
      {getProvinces().map((p, i) => {
        const prov = getProvincial(p.ubigeo);
        const part = getParticipation(p.ubigeo);
        const first = prov?.results[0];
        const second = prov?.results[1];
        const org = first ? orgs.get(first.organizationCode) : undefined;
        return (
          <li key={p.ubigeo} className={`py-5 md:px-6 ${i === 0 ? "md:pl-0" : ""} ${i > 0 ? "border-t border-rule md:border-t-0" : ""}`}>
            <h3 className="m-0 text-xl">
              <Link href={`/provincias/${p.slug}/`} className="text-ink no-underline hover:underline">
                {p.displayName}
              </Link>
            </h3>
            <p className="m-0 mt-0.5 text-sm text-ink-soft">Alcaldía provincial</p>
            {first && prov ? (
              <div className="mt-4 flex items-start gap-3">
                <PartyLogo org={org} fallbackName={first.organizationName} size={44} />
                <div className="min-w-0">
                  <p className="m-0 font-semibold leading-snug">{first.candidateName ? titleCase(first.candidateName) : "Sin nombre en ONPE"}</p>
                  <p className="m-0 text-sm text-ink-soft">{org?.displayName ?? first.organizationName}</p>
                  <p className="m-0 mt-1 flex flex-wrap items-center gap-2">
                    <span className="num text-lg font-semibold">{formatPct(first.validVotePct)}</span>
                    <StatusBadge status={statusKey(first, prov.unit.countComplete)} />
                  </p>
                  {second && (
                    <p className="m-0 mt-1 text-sm text-ink-soft">
                      Segundo: {orgs.get(second.organizationCode)?.shortName ?? second.organizationName}, {formatPct(second.validVotePct)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Sin datos.</p>
            )}
            <dl className="m-0 mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-ink-soft">Actas contabilizadas</dt>
                <dd className="num m-0 font-semibold">{prov ? formatActsPct(prov.unit.countedActsPct) : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Participación</dt>
                <dd className="num m-0 font-semibold">{part ? formatPct(part.turnoutPct) : "—"}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
