import type { Participation } from "@/lib/schemas";
import { round } from "@/lib/format";

export interface ParticipationInput {
  eligibleVoters: number;
  votersWhoVoted: number;
  /** Ausentes según ONPE: solo cuenta electores de actas contabilizadas. */
  onpeAbsentees: number;
  onpeTurnoutPct: number;
  onpeAbsenteePct: number;
  scope: Participation["scope"];
  department: string;
  province?: string;
  district?: string;
  ubigeo: string;
  sourceUrl: string;
  sourceTimestamp: string;
}

/**
 * Calcula participación y ausentismo sin confundir conceptos:
 * - ausentismo = electores hábiles que no votaron (no incluye blancos, nulos ni impugnados);
 * - "pendientes" = electores de actas aún no contabilizadas (p. ej., enviadas al JEE).
 *   Mientras existan, el dato es provisional y no se suman a los ausentes.
 *
 * Con pendientes = 0 se cumple exactamente: ausentes = hábiles − votaron.
 */
export function computeParticipation(input: ParticipationInput): Participation {
  const { eligibleVoters, votersWhoVoted, onpeAbsentees } = input;
  if (eligibleVoters <= 0) throw new Error(`Electores hábiles inválidos en ${input.ubigeo}`);
  const notVoted = eligibleVoters - votersWhoVoted;
  const pendingVoters = Math.max(0, notVoted - onpeAbsentees);
  const absentees = notVoted - pendingVoters;
  return {
    eligibleVoters,
    votersWhoVoted,
    absentees,
    turnoutPct: round((votersWhoVoted / eligibleVoters) * 100),
    absenteePct: round((absentees / eligibleVoters) * 100),
    scope: input.scope,
    department: input.department,
    province: input.province,
    district: input.district,
    sourceTimestamp: input.sourceTimestamp,
    ubigeo: input.ubigeo,
    pendingVoters,
    pendingPct: round((pendingVoters / eligibleVoters) * 100),
    provisional: pendingVoters > 0,
    onpeTurnoutPct: input.onpeTurnoutPct,
    onpeAbsenteePct: input.onpeAbsenteePct,
    sourceUrl: input.sourceUrl,
    basis:
      "ONPE, módulo Participación ciudadana (actas de la elección municipal provincial). Asistentes y ausentes solo consideran actas contabilizadas.",
  };
}
