import type { ElectionUnit } from "@/lib/schemas";
import { formatActsPct, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { InfoTip } from "./InfoTip";

/** Avance de actas: contabilizadas, enviadas al JEE y pendientes. */
export function ActsProgress({ unit }: { unit: ElectionUnit }) {
  const pct = (n: number) => (unit.totalActs ? (n / unit.totalActs) * 100 : 0);
  return (
    <div>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="num text-2xl font-semibold text-ink">{formatActsPct(unit.countedActsPct)}</span>
        <span className="text-ink-soft">
          de actas contadas ({formatInt(unit.countedActs)} de {formatInt(unit.totalActs)})
        </span>
        <InfoTip label="actas contabilizadas">
          Un acta contada ya está sumada por ONPE. Las actas con problemas van al Jurado Electoral Especial (JEE) y se suman cuando
          este decide.
        </InfoTip>
      </p>
      <div
        className="mt-2 flex h-2.5 w-full overflow-hidden bg-rule"
        role="img"
        aria-label={`${formatInt(unit.countedActs)} actas contabilizadas, ${formatInt(unit.jeeActs)} enviadas al JEE, ${formatInt(unit.pendingActs)} pendientes`}
      >
        <span className="h-full bg-accent" style={{ width: `${pct(unit.countedActs)}%` }} />
        <span className="h-full bg-st-parcial" style={{ width: `${pct(unit.jeeActs)}%` }} />
      </div>
      {(unit.jeeActs > 0 || unit.pendingActs > 0) && (
        <p className="mt-1.5 text-sm text-st-parcial">
          {unit.jeeActs > 0 && `${formatInt(unit.jeeActs)} acta(s) en el JEE. `}
          {unit.pendingActs > 0 && `${formatInt(unit.pendingActs)} por contar. `}
          El resultado aún puede cambiar.
        </p>
      )}
    </div>
  );
}

/** Desglose de votos según el esquema de ONPE: emitidos = válidos + blancos + nulos. */
export function VoteBreakdown({ unit }: { unit: ElectionUnit }) {
  const rows: { label: string; value: number | null; tip?: string }[] = [
    { label: "Votos válidos", value: unit.validVotes, tip: "Votos por algún partido. Con ellos se calculan los porcentajes." },
    { label: "Votos en blanco", value: unit.blankVotes, tip: "Cédula sin marcar. Esa persona sí votó." },
    { label: "Votos nulos", value: unit.nullVotes, tip: "Cédula mal marcada. Esa persona sí votó." },
    { label: "Votos emitidos", value: unit.votesCast, tip: "Todos los votos: válidos + blancos + nulos." },
    { label: "Electores hábiles", value: unit.eligibleVoters, tip: "Personas que podían votar aquí." },
  ];
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((r) => (
        <div key={r.label} className="border-t border-rule pt-2">
          <dt className="whitespace-nowrap text-sm text-ink-soft">
            {r.label}
            {r.tip && <InfoTip label={r.label}>{r.tip}</InfoTip>}
          </dt>
          <dd className="num m-0 text-lg font-semibold">{formatInt(r.value)}</dd>
          {r.label !== "Votos válidos" && r.label !== "Electores hábiles" && r.value !== null && unit.votesCast > 0 && r.label !== "Votos emitidos" && (
            <dd className="num m-0 text-xs text-ink-soft">{formatPct((r.value / unit.votesCast) * 100)} de emitidos</dd>
          )}
        </div>
      ))}
      <div className="col-span-2 border-t border-rule pt-2 sm:col-span-3 lg:col-span-5">
        <p className="m-0 text-sm text-ink-soft">
          ONPE no publica aparte los votos impugnados.
          {unit.turnoutPct !== null && <> Participación en esta elección: <span className="num font-medium text-ink">{formatPct(unit.turnoutPct)}</span>.</>}
        </p>
      </div>
    </dl>
  );
}

export function SourceNote({ unit }: { unit: ElectionUnit }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-ink-soft">
      Fuente: ONPE, conteo al {formatDateTime(unit.sourceTimestamp)}. Servicio:{" "}
      <a href={unit.sources.candidates} className="break-all">
        {new URL(unit.sources.candidates).pathname}
      </a>
      .
    </p>
  );
}
