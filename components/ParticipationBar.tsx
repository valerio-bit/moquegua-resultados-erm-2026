import type { Participation } from "@/lib/schemas";
import { formatDateTime, formatInt, formatPct } from "@/lib/format";
import { InfoTip } from "./InfoTip";

/** Participación, ausentismo y electores pendientes (si los hay) en una barra apilada. */
export function ParticipationBar({ p, compact = false }: { p: Participation; compact?: boolean }) {
  const label = `Participación ${formatPct(p.turnoutPct)}, ausentismo ${formatPct(p.absenteePct)}${p.pendingVoters > 0 ? `, pendientes ${formatPct(p.pendingPct)}` : ""}`;
  return (
    <div data-testid={`participation-${p.ubigeo}`}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="m-0 text-sm text-ink-soft">
            Participación
            <InfoTip label="participación">
              Personas que votaron ÷ personas que podían votar. Incluye votos en blanco y nulos.
            </InfoTip>
          </p>
          <p className="num m-0 text-2xl font-semibold text-accent">{formatPct(p.turnoutPct)}</p>
          {!compact && <p className="num m-0 text-sm text-ink-soft">{formatInt(p.votersWhoVoted)} votaron</p>}
        </div>
        <div>
          <p className="m-0 text-sm text-ink-soft">
            Ausentismo
            <InfoTip label="ausentismo">
              Personas que no fueron a votar ÷ personas que podían votar. No confundir con voto en blanco o nulo: esa gente sí
              votó.
            </InfoTip>
          </p>
          <p className="num m-0 text-2xl font-semibold">{formatPct(p.absenteePct)}</p>
          {!compact && <p className="num m-0 text-sm text-ink-soft">{formatInt(p.absentees)} no votaron</p>}
        </div>
        {!compact && (
          <div>
            <p className="m-0 text-sm text-ink-soft">Electores hábiles</p>
            <p className="num m-0 text-2xl font-semibold">{formatInt(p.eligibleVoters)}</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex h-3 w-full overflow-hidden bg-rule" role="img" aria-label={label}>
        <span className="h-full bg-accent" style={{ width: `${p.turnoutPct}%` }} />
        <span className="h-full bg-ink-faint" style={{ width: `${p.absenteePct}%` }} />
        <span className="h-full bg-st-parcial" style={{ width: `${p.pendingPct}%` }} />
      </div>
      {p.provisional && (
        <p className="mt-2 text-sm text-st-parcial">
          Dato provisional: faltan contar {formatInt(p.pendingVoters)} electores ({formatPct(p.pendingPct)}) de actas observadas. No se
          cuentan como ausentes.
        </p>
      )}
      {!compact && (
        <p className="mt-2 text-xs text-ink-soft">
          Fuente: ONPE, participación ciudadana, datos al {formatDateTime(p.sourceTimestamp)}. Solo cuenta actas ya contadas.
        </p>
      )}
    </div>
  );
}
