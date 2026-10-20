"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { ExplorerData, ExplorerRow } from "@/lib/explorer";
import { formatInt, formatPct } from "@/lib/format";
import { titleCase } from "@/lib/text";
import { PartyLogo } from "./PartyLogo";
import { StatusBadge } from "./StatusBadge";
import { InfoTip } from "./InfoTip";
import type { Status } from "@/lib/schemas";

const ELECTIONS = [
  { value: "", label: "Todas las elecciones" },
  { value: "1", label: "Gobierno regional" },
  { value: "2", label: "Consejo regional" },
  { value: "3", label: "Alcaldía provincial" },
  { value: "4", label: "Alcaldía distrital" },
];

function readParams() {
  if (typeof window === "undefined") return { partido: "", provincia: "", eleccion: "" };
  const q = new URLSearchParams(window.location.search);
  return { partido: q.get("partido") ?? "", provincia: q.get("provincia") ?? "", eleccion: q.get("eleccion") ?? "" };
}

export function ExplorerClient({ data }: { data: ExplorerData }) {
  const [partido, setPartido] = useState("");
  const [provincia, setProvincia] = useState("");
  const [eleccion, setEleccion] = useState("");
  const ids = { p: useId(), v: useId(), e: useId() };

  useEffect(() => {
    const q = readParams();
    // Sincroniza el estado con la URL compartida (?partido=…); solo al cargar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPartido(q.partido);
    setProvincia(q.provincia);
    setEleccion(q.eleccion);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (partido) q.set("partido", partido);
    if (provincia) q.set("provincia", provincia);
    if (eleccion) q.set("eleccion", eleccion);
    const qs = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [partido, provincia, eleccion]);

  const orgBySlug = useMemo(() => new Map(data.orgs.map((o) => [o.slug, o])), [data.orgs]);
  const orgByCode = useMemo(() => new Map(data.orgs.map((o) => [o.code, o])), [data.orgs]);
  const selected = partido ? orgBySlug.get(partido) : undefined;
  const logoOf = (code: string) => {
    const o = orgByCode.get(code);
    return o ? { displayName: o.name, shortName: o.shortName, logo: o.logo ? { file: o.logo } : undefined } : undefined;
  };

  const rows = data.rows.filter(
    (r) =>
      (!provincia || r.provinceSlug === provincia) &&
      (!eleccion || String(r.electionId) === eleccion) &&
      (!selected || r.candidates.some((c) => c.org === selected.code)),
  );
  const groups: { name: string; rows: ExplorerRow[] }[] = [];
  for (const r of rows) {
    const g = groups.find((x) => x.name === r.provinceName);
    if (g) g.rows.push(r);
    else groups.push({ name: r.provinceName, rows: [r] });
  }

  const mine = selected ? rows.map((r) => r.candidates.find((c) => c.org === selected.code)!).filter(Boolean) : [];
  const leads = mine.filter((c) => c.leading).length;

  return (
    <div className="space-y-8">
      <form className="grid gap-3 rounded-sm border border-rule bg-surface p-4 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <div>
          <label htmlFor={ids.p} className="mb-1.5 block text-sm font-medium">
            Partido u organización
          </label>
          <select id={ids.p} value={partido} onChange={(e) => setPartido(e.target.value)} className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2.5" data-testid="explorer-party">
            <option value="">Todos los partidos</option>
            {data.orgs.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.v} className="mb-1.5 block text-sm font-medium">
            Provincia
          </label>
          <select id={ids.v} value={provincia} onChange={(e) => setProvincia(e.target.value)} className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2.5" data-testid="explorer-province">
            <option value="">Todas las provincias</option>
            {data.provinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.e} className="mb-1.5 block text-sm font-medium">
            Elección
          </label>
          <select id={ids.e} value={eleccion} onChange={(e) => setEleccion(e.target.value)} className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2.5" data-testid="explorer-election">
            {ELECTIONS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      {selected && (
        <section aria-labelledby="resumen-partido" className="flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="explorer-summary">
          <h2 id="resumen-partido" className="m-0 flex items-center gap-3 text-2xl">
            <PartyLogo org={logoOf(selected.code)} size={44} />
            {selected.name}
          </h2>
          <p className="m-0 text-sm">
            Postula en <strong className="num">{mine.length}</strong> elecciones y va primero en <strong className="num">{leads}</strong>.{" "}
            <Link href={`/partidos/${selected.slug}/`}>Ver ficha del partido</Link>
          </p>
        </section>
      )}

      <p className="m-0 mb-2 text-sm text-ink-soft" aria-live="polite" data-testid="explorer-count">
        {rows.length} elecciones. «% de hábiles» = votos ÷ personas que podían votar (cálculo nuestro). ONPE calcula sus porcentajes
        sobre votos válidos.
      </p>

      {groups.length === 0 && <p>No hay resultados con esos filtros. Prueba con «Todas las provincias».</p>}

      {groups.map((g) => (
        <section key={g.name} aria-labelledby={`grupo-${g.name}`}>
          <h2 id={`grupo-${g.name}`} className="m-0 border-b border-rule-strong pb-2 text-2xl">
            {g.name === "Región Moquegua" ? g.name : `Provincia ${g.name}`}
          </h2>
          <div className="table-wrap mt-3">
            <table className="data-table text-[0.8125rem]" data-testid="explorer-table">
              <caption>
                Quién va primero{selected ? `, cómo le va a ${selected.name}` : ""} y cuánta gente votó (conteo ONPE).
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ámbito</th>
                  <th scope="col">Primer lugar</th>
                  {selected && <th scope="col">{selected.shortName ?? selected.name}</th>}
                  <th scope="col" className="right">
                    Hábiles
                  </th>
                  <th scope="col" className="right">
                    Emitidos
                    <InfoTip label="emitidos">
                      Todos los votos de esta elección: válidos + blancos + nulos.
                    </InfoTip>
                  </th>
                  <th scope="col" className="right">
                    Válidos
                  </th>
                  <th scope="col" className="right">
                    Blancos
                  </th>
                  <th scope="col" className="right">
                    Nulos
                  </th>
                  <th scope="col" className="right">
                    Ausentes
                    <InfoTip label="ausentes">
                      Personas que podían votar y no fueron (ONPE). Quien vota en blanco o nulo sí votó.
                    </InfoTip>
                  </th>
                  <th scope="col" className="right">
                    <abbr title="Participación (votaron ÷ hábiles)" className="no-underline">Particip.</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const top = r.candidates[0];
                  const own = selected ? r.candidates.find((c) => c.org === selected.code) : undefined;
                  const topOrg = top ? orgByCode.get(top.org) : undefined;
                  return (
                    <tr key={r.unitId} data-unit={r.unitId}>
                      <th scope="row" className="min-w-32 font-medium">
                        <Link href={r.href}>{r.jurisdiction}</Link>
                        <span className="block text-xs font-normal text-ink-soft">{r.electionName}</span>
                      </th>
                      <td className="min-w-48">
                        {top && (
                          <span className="flex items-start gap-2">
                            <PartyLogo org={logoOf(top.org)} fallbackName={top.org} size={26} />
                            <span>
                              <span className="block">{topOrg?.shortName ?? topOrg?.name}</span>
                              {top.candidate && <span className="block text-xs text-ink-soft">{titleCase(top.candidate)}</span>}
                              <span className="num block">
                                {formatInt(top.votes)} votos · {formatPct(top.validPct)}
                              </span>
                              <span className="mt-0.5 block">
                                <StatusBadge status={top.status as Status | "PARCIAL"} />
                              </span>
                            </span>
                          </span>
                        )}
                      </td>
                      {selected && (
                        <td className="min-w-40" data-testid="explorer-own">
                          {own ? (
                            <span className="block">
                              <span className="block font-semibold">Puesto {own.rank}</span>
                              <span className="num block">{formatInt(own.votes)} votos</span>
                              <span className="num block text-xs text-ink-soft">
                                {formatPct(own.validPct)} de válidos · {formatPct(own.eligiblePct)} de hábiles
                              </span>
                            </span>
                          ) : (
                            <span className="text-ink-faint">No compite</span>
                          )}
                        </td>
                      )}
                      <td className="right num">{formatInt(r.eligible)}</td>
                      <td className="right num">{formatInt(r.votesCast)}</td>
                      <td className="right num">{formatInt(r.valid)}</td>
                      <td className="right num">{formatInt(r.blank)}</td>
                      <td className="right num">{formatInt(r.nul)}</td>
                      <td className="right num">
                        {formatInt(r.absentees)}
                        {r.pending > 0 && <span className="block text-xs text-st-parcial">+{formatInt(r.pending)} pendientes</span>}
                      </td>
                      <td className="right num">{formatPct(r.turnoutPct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
