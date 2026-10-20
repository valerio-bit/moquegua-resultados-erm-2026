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
          de actas contabilizadas ({formatInt(unit.countedActs)} de {formatInt(unit.totalActs)})
        </span>
        <InfoTip label="actas contabilizadas">
          Un acta contabilizada ya fue sumada al cómputo de ONPE. Las actas con observaciones se envían al Jurado Electoral Especial
          (JEE) y no se suman hasta que este resuelve.
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
          {unit.jeeActs > 0 && `${formatInt(unit.jeeActs)} acta(s) enviada(s) al JEE. `}
          {unit.pendingActs > 0 && `${formatInt(unit.pendingActs)} pendiente(s). `}
          El resultado es provisional.
        </p>
      )}
    </div>
  );
}

/** Desglose de votos según el esquema de ONPE: emitidos = válidos + blancos + nulos. */
export function VoteBreakdown({ unit }: { unit: ElectionUnit }) {
  const rows: { label: string; value: number | null; tip?: string }[] = [
    { label: "Votos válidos", value: unit.validVotes, tip: "Votos por alguna organización política. Base de los porcentajes de candidaturas." },
    { label: "Votos en blanco", value: unit.blankVotes, tip: "Cédulas sin ninguna marca. No son ausentismo: el elector sí votó." },
    { label: "Votos nulos", value: unit.nullVotes, tip: "Cédulas marcadas de forma inválida. No son ausentismo: el elector sí votó." },
    { label: "Votos emitidos", value: unit.votesCast, tip: "Total de votos depositados: válidos + blancos + nulos (esquema publicado por ONPE)." },
    { label: "Electores hábiles", value: unit.eligibleVoters, tip: "Ciudadanos habilitados para votar en este ámbito (padrón)." },
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
          Votos impugnados: ONPE no los publica por separado en este servicio; las actas observadas se resuelven en el JEE.
          {unit.turnoutPct !== null && <> Participación en esta elección (emitidos ÷ hábiles, según ONPE): <span className="num font-medium text-ink">{formatPct(unit.turnoutPct)}</span>.</>}
        </p>
      </div>
    </dl>
  );
}

export function SourceNote({ unit }: { unit: ElectionUnit }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-ink-soft">
      Fuente: ONPE, cómputo con corte del {formatDateTime(unit.sourceTimestamp)}. Servicio consultado:{" "}
      <a href={unit.sources.candidates} className="break-all">
        {new URL(unit.sources.candidates).pathname}
      </a>
      .
    </p>
  );
}
