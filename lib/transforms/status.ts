import type { ElectionId, OutcomeKind, Status } from "@/lib/schemas";

export interface StatusCandidate {
  organizationCode: string;
  votes: number;
  validVotePct: number;
}

export interface ProclamationRef {
  electionId: number;
  ubigeo: string;
  organizationCode: string;
  sourceUrl: string;
  resolution?: string;
}

export interface StatusDecision {
  outcome: { kind: OutcomeKind; organizationCodes: string[]; note: string; sourceUrl?: string };
  statusByOrg: Map<string, { status: Status; note?: string; sourceUrl?: string }>;
  leaders: string[];
}

/** Una proclamación solo se acepta si la fuente es del JNE (jne.gob.pe y subdominios). */
export function isJneSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "jne.gob.pe" || host.endsWith(".jne.gob.pe");
  } catch {
    return false;
  }
}

/** Ranking de competencia: empates comparten puesto (1, 2, 2, 4). */
export function competitionRanks(votes: number[]): number[] {
  return votes.map((v) => 1 + votes.filter((other) => other > v).length);
}

export function decideStatus(params: {
  electionId: ElectionId;
  ubigeo: string;
  countComplete: boolean;
  countedActsPct: number;
  candidates: StatusCandidate[];
  secondRoundThresholdPct: number;
  proclamations: ProclamationRef[];
}): StatusDecision {
  const { electionId, ubigeo, countComplete, candidates } = params;
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const statusByOrg = new Map<string, { status: Status; note?: string; sourceUrl?: string }>();
  for (const c of candidates) statusByOrg.set(c.organizationCode, { status: "COMPUTO_ONPE" });

  const top = sorted[0];
  const leaders = top ? sorted.filter((c) => c.votes === top.votes).map((c) => c.organizationCode) : [];

  // 1) Proclamación con respaldo verificable del JNE/JEE.
  const procl = params.proclamations.filter(
    (p) => p.electionId === electionId && p.ubigeo === ubigeo && isJneSource(p.sourceUrl),
  );
  if (procl.length > 0) {
    for (const p of procl) {
      if (statusByOrg.has(p.organizationCode)) {
        statusByOrg.set(p.organizationCode, {
          status: "PROCLAMADO_JNE_JEE",
          note: p.resolution ? `Proclamación: ${p.resolution}` : "Proclamación JNE/JEE",
          sourceUrl: p.sourceUrl,
        });
      }
    }
    return {
      outcome: {
        kind: "PROCLAMADO",
        organizationCodes: procl.map((p) => p.organizationCode),
        note: "Resultado proclamado por el Jurado Electoral (ver fuente JNE/JEE).",
        sourceUrl: procl[0]?.sourceUrl,
      },
      statusByOrg,
      leaders,
    };
  }

  const partial = `Cómputo ONPE al ${params.countedActsPct.toLocaleString("es-PE", { maximumFractionDigits: 3 })} % de actas contabilizadas; resultado aún no definitivo.`;

  // 2) Consejo regional: listas con reparto proporcional (no se calcula aquí).
  if (electionId === 2) {
    return {
      outcome: {
        kind: "REPARTO_PROPORCIONAL",
        organizationCodes: leaders,
        note: countComplete
          ? "Votación por listas. La asignación de consejeros la realiza el Jurado Electoral; este sitio no calcula escaños."
          : `${partial} La asignación de consejeros la realiza el Jurado Electoral.`,
      },
      statusByOrg,
      leaders,
    };
  }

  if (!countComplete || leaders.length !== 1 || !top) {
    return {
      outcome: {
        kind: "EN_COMPUTO",
        organizationCodes: leaders,
        note: leaders.length > 1 ? "Empate en el primer lugar según el cómputo ONPE." : partial,
      },
      statusByOrg,
      leaders,
    };
  }

  // 3) Gobierno regional: umbral del 30 % de votos válidos.
  if (electionId === 1) {
    if (top.validVotePct >= params.secondRoundThresholdPct) {
      statusByOrg.set(top.organizationCode, {
        status: "PRIMER_LUGAR_VIRTUAL",
        note: `Supera el ${params.secondRoundThresholdPct} % de votos válidos en el cómputo ONPE al 100 %. Pendiente de proclamación por el JEE/JNE.`,
      });
      return {
        outcome: {
          kind: "PRIMER_LUGAR_VIRTUAL",
          organizationCodes: [top.organizationCode],
          note: "Primer lugar en el cómputo ONPE al 100 %; no es una proclamación.",
        },
        statusByOrg,
        leaders,
      };
    }
    const second = sorted[1];
    const third = sorted[2];
    if (!second || (third && third.votes === second.votes)) {
      return {
        outcome: {
          kind: "EN_COMPUTO",
          organizationCodes: leaders,
          note: "Nadie alcanza el umbral y no es posible determinar el segundo lugar (empate).",
        },
        statusByOrg,
        leaders,
      };
    }
    const note = `Ninguna fórmula alcanza el ${params.secondRoundThresholdPct} % de votos válidos en el cómputo ONPE al 100 %: corresponde segunda elección entre las dos más votadas. Pendiente de proclamación y convocatoria oficial del JNE.`;
    statusByOrg.set(top.organizationCode, { status: "SEGUNDA_VUELTA", note });
    statusByOrg.set(second.organizationCode, { status: "SEGUNDA_VUELTA", note });
    return {
      outcome: { kind: "SEGUNDA_VUELTA", organizationCodes: [top.organizationCode, second.organizationCode], note },
      statusByOrg,
      leaders,
    };
  }

  // 4) Alcaldías: mayoría simple, una sola vuelta.
  statusByOrg.set(top.organizationCode, {
    status: "PRIMER_LUGAR_VIRTUAL",
    note: "Primer lugar en el cómputo ONPE al 100 % de actas. Pendiente de proclamación por el JEE.",
  });
  return {
    outcome: {
      kind: "PRIMER_LUGAR_VIRTUAL",
      organizationCodes: [top.organizationCode],
      note: "Primer lugar en el cómputo ONPE al 100 %; no es una proclamación.",
    },
    statusByOrg,
    leaders,
  };
}
