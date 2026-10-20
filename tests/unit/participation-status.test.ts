import { describe, expect, it } from "vitest";
import { computeParticipation } from "@/lib/transforms/participation";
import { competitionRanks, decideStatus, isJneSource } from "@/lib/transforms/status";

const base = {
  department: "Moquegua",
  ubigeo: "170000",
  sourceUrl: "https://resultadoelectoral.onpe.gob.pe/presentacion-backend/participacion-ciudadana/totales",
  sourceTimestamp: "2026-10-20T07:52:00.000Z",
  scope: "REGION" as const,
};

describe("participación y ausentismo", () => {
  it("sin pendientes: ausentes = hábiles − votaron y suma 100 %", () => {
    const p = computeParticipation({ ...base, eligibleVoters: 967, votersWhoVoted: 792, onpeAbsentees: 175, onpeTurnoutPct: 81.903, onpeAbsenteePct: 18.097 });
    expect(p.absentees).toBe(967 - 792);
    expect(p.pendingVoters).toBe(0);
    expect(p.provisional).toBe(false);
    expect(p.turnoutPct).toBeCloseTo(81.903, 3);
    expect(p.turnoutPct + p.absenteePct).toBeCloseTo(100, 2);
  });

  it("con actas pendientes no cuenta a esos electores como ausentes y marca el dato provisional", () => {
    const p = computeParticipation({ ...base, eligibleVoters: 166170, votersWhoVoted: 131211, onpeAbsentees: 34659, onpeTurnoutPct: 78.962, onpeAbsenteePct: 20.858 });
    expect(p.pendingVoters).toBe(300);
    expect(p.absentees).toBe(34659);
    expect(p.absentees + p.pendingVoters).toBe(p.eligibleVoters - p.votersWhoVoted);
    expect(p.provisional).toBe(true);
    expect(p.turnoutPct + p.absenteePct + p.pendingPct).toBeCloseTo(100, 1);
  });

  it("rechaza electores hábiles inválidos", () => {
    expect(() => computeParticipation({ ...base, eligibleVoters: 0, votersWhoVoted: 0, onpeAbsentees: 0, onpeTurnoutPct: 0, onpeAbsenteePct: 0 })).toThrow();
  });
});

const proclamations: { electionId: number; ubigeo: string; organizationCode: string; sourceUrl: string }[] = [];
const cands = (pcts: [string, number, number][]) => pcts.map(([organizationCode, votes, validVotePct]) => ({ organizationCode, votes, validVotePct }));

describe("estados electorales", () => {
  it("gobierno regional al 100 % sin nadie sobre el 30 %: segunda vuelta para los dos primeros", () => {
    const d = decideStatus({
      electionId: 1,
      ubigeo: "170000",
      countComplete: true,
      countedActsPct: 100,
      candidates: cands([["93", 30051, 26.018], ["94", 29054, 25.155], ["155", 20274, 17.553]]),
      secondRoundThresholdPct: 30,
      proclamations,
    });
    expect(d.outcome.kind).toBe("SEGUNDA_VUELTA");
    expect(d.statusByOrg.get("93")?.status).toBe("SEGUNDA_VUELTA");
    expect(d.statusByOrg.get("94")?.status).toBe("SEGUNDA_VUELTA");
    expect(d.statusByOrg.get("155")?.status).toBe("COMPUTO_ONPE");
  });

  it("gobierno regional con ≥ 30 %: primer lugar virtual, nunca 'electo'", () => {
    const d = decideStatus({ electionId: 1, ubigeo: "x", countComplete: true, countedActsPct: 100, candidates: cands([["1", 400, 40], ["2", 300, 30]]), secondRoundThresholdPct: 30, proclamations });
    expect(d.statusByOrg.get("1")?.status).toBe("PRIMER_LUGAR_VIRTUAL");
    expect(d.outcome.note).toMatch(/no es una proclamación/);
  });

  it("conteo incompleto: ningún estado definitivo (dato provisional)", () => {
    const d = decideStatus({ electionId: 4, ubigeo: "170106", countComplete: false, countedActsPct: 96.154, candidates: cands([["95", 2393, 44.038], ["100", 2126, 39.124]]), secondRoundThresholdPct: 30, proclamations });
    expect(d.outcome.kind).toBe("EN_COMPUTO");
    expect([...d.statusByOrg.values()].every((s) => s.status === "COMPUTO_ONPE")).toBe(true);
    expect(d.leaders).toEqual(["95"]);
  });

  it("alcaldía al 100 %: primer lugar virtual único", () => {
    const d = decideStatus({ electionId: 3, ubigeo: "170100", countComplete: true, countedActsPct: 100, candidates: cands([["93", 10, 50], ["94", 5, 25], ["95", 5, 25]]), secondRoundThresholdPct: 30, proclamations });
    expect(d.statusByOrg.get("93")?.status).toBe("PRIMER_LUGAR_VIRTUAL");
    expect(d.statusByOrg.get("94")?.status).toBe("COMPUTO_ONPE");
  });

  it("consejo regional: reparto proporcional, sin primer lugar virtual", () => {
    const d = decideStatus({ electionId: 2, ubigeo: "170100", countComplete: true, countedActsPct: 100, candidates: cands([["93", 10, 50], ["94", 10, 50]]), secondRoundThresholdPct: 30, proclamations });
    expect(d.outcome.kind).toBe("REPARTO_PROPORCIONAL");
    expect([...d.statusByOrg.values()].every((s) => s.status === "COMPUTO_ONPE")).toBe(true);
  });

  it("empate en el primer lugar no produce primer lugar virtual", () => {
    const d = decideStatus({ electionId: 4, ubigeo: "x", countComplete: true, countedActsPct: 100, candidates: cands([["1", 10, 50], ["2", 10, 50]]), secondRoundThresholdPct: 30, proclamations });
    expect(d.outcome.kind).toBe("EN_COMPUTO");
  });

  it("proclamado solo con fuente del JNE/JEE", () => {
    const args = { electionId: 3 as const, ubigeo: "170100", countComplete: true, countedActsPct: 100, candidates: cands([["93", 10, 60], ["94", 5, 40]]), secondRoundThresholdPct: 30 };
    const fake = decideStatus({ ...args, proclamations: [{ electionId: 3, ubigeo: "170100", organizationCode: "93", sourceUrl: "https://ejemplo.com/noticia" }] });
    expect(fake.statusByOrg.get("93")?.status).toBe("PRIMER_LUGAR_VIRTUAL");
    const real = decideStatus({ ...args, proclamations: [{ electionId: 3, ubigeo: "170100", organizationCode: "93", sourceUrl: "https://plataformaelectoral.jne.gob.pe/resolucion/1" }] });
    expect(real.statusByOrg.get("93")?.status).toBe("PROCLAMADO_JNE_JEE");
    expect(isJneSource("https://jne.gob.pe.evil.com/x")).toBe(false);
  });

  it("ranking de competencia con empates", () => {
    expect(competitionRanks([10, 30, 20, 20])).toEqual([4, 1, 2, 2]);
  });
});
