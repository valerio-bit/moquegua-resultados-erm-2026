import {
  DatasetSchema,
  ElectionResultSchema,
  ParticipationSchema,
  type Dataset,
  type ElectionResult,
} from "@/lib/schemas";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import { isJneSource } from "@/lib/transforms/status";

export type Severity = "critical" | "warning";

export interface CheckFailure {
  ref: string;
  message: string;
}

export interface CheckResult {
  id: string;
  title: string;
  severity: Severity;
  passed: boolean;
  checkedItems: number;
  failures: CheckFailure[];
}

export interface ValidationReport {
  generatedAt: string;
  snapshotId: string;
  snapshotHash: string;
  passed: boolean;
  publishable: boolean;
  summary: { checks: number; passed: number; failedCritical: number; failedWarnings: number };
  checks: CheckResult[];
}

/** Tolerancia para porcentajes publicados con 3 decimales. */
export const PCT_TOLERANCE = 0.0011;
/** Tolerancia para "participación + ausentismo + pendientes ≈ 100 %". */
export const SUM100_TOLERANCE = 0.01;

class Check {
  failures: CheckFailure[] = [];
  items = 0;
  constructor(
    public id: string,
    public title: string,
    public severity: Severity,
  ) {}
  test(ok: boolean, ref: string, message: string) {
    this.items += 1;
    if (!ok) this.failures.push({ ref, message });
  }
  result(): CheckResult {
    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      passed: this.failures.length === 0,
      checkedItems: this.items,
      failures: this.failures.slice(0, 200),
    };
  }
}

const refOf = (r: Pick<ElectionResult, "unitId" | "organizationCode">) => `${r.unitId}/${r.organizationCode}`;

export async function validateDataset(input: unknown, now = new Date().toISOString()): Promise<ValidationReport> {
  const checks: Check[] = [];
  const add = (id: string, title: string, severity: Severity) => {
    const c = new Check(id, title, severity);
    checks.push(c);
    return c;
  };

  const schema = add("schema", "Estructura del dataset (Zod)", "critical");
  const parsed = DatasetSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 50)) schema.test(false, issue.path.join("."), issue.message);
    // Validación por registro para dar mensajes útiles aunque el conjunto falle
    const raw = (input ?? {}) as Partial<Dataset>;
    const c1 = add("01-source-url", "Todo registro tiene sourceUrl", "critical");
    const c2 = add("02-source-timestamp", "Todo registro tiene sourceTimestamp", "critical");
    for (const [i, r] of (Array.isArray(raw.results) ? raw.results : []).entries()) {
      const one = ElectionResultSchema.safeParse(r);
      const issues = one.success ? [] : one.error.issues;
      c1.test(!issues.some((x) => x.path[0] === "sourceUrl"), `results[${i}]`, "sourceUrl ausente o inválido");
      c2.test(!issues.some((x) => x.path[0] === "sourceTimestamp"), `results[${i}]`, "sourceTimestamp ausente o inválido");
    }
    for (const [i, p] of (Array.isArray(raw.participation) ? raw.participation : []).entries()) {
      const one = ParticipationSchema.safeParse(p);
      const issues = one.success ? [] : one.error.issues;
      c2.test(!issues.some((x) => x.path[0] === "sourceTimestamp"), `participation[${i}]`, "sourceTimestamp ausente o inválido");
    }
    return finish(checks, now, "—", "—");
  }
  schema.test(true, "dataset", "ok");
  const ds = parsed.data;

  const c1 = add("01-source-url", "Todo registro tiene sourceUrl", "critical");
  const c2 = add("02-source-timestamp", "Todo registro tiene sourceTimestamp", "critical");
  const c3 = add("03-votes-non-negative", "Votos mayores o iguales a 0", "critical");
  const c4 = add("04-pct-range", "Porcentajes entre 0 y 100", "critical");
  const c5 = add("05-rank", "Ranking coherente con los votos", "critical");
  const c6 = add("06-sum-valid", "Suma de candidaturas = votos válidos", "critical");
  const c7 = add("07-cast-reconciliation", "Válidos + blancos + nulos (+ impugnados) = votos emitidos (esquema ONPE)", "critical");
  const c8 = add("08-eligible-ge-voted", "Electores hábiles ≥ ciudadanos que votaron", "critical");
  const c9 = add("09-absentees", "Ausentes = hábiles − votaron (descontando electores pendientes de actas no contabilizadas)", "critical");
  const c10 = add("10-sum-100", "Participación + ausentismo (+ pendientes) ≈ 100 %", "critical");
  const c11 = add("11-proclamation-source", "PROCLAMADO_JNE_JEE solo con fuente JNE/JEE", "critical");
  const c12 = add("12-publish-gate", "Totales cuadran entre niveles territoriales", "critical");
  const cPct = add("pct-recompute", "Porcentaje publicado = votos / válidos × 100", "critical");
  const cStatus = add("status-rules", "Estados coherentes con el avance de actas y la regla del 30 %", "critical");
  const cUnique = add("unique-records", "Sin registros duplicados", "critical");
  const cHash = add("snapshot-hash", "Hash SHA-256 del snapshot íntegro", "critical");
  const cCoverage = add("coverage", "Cobertura territorial completa (3 provincias y todos los distritos con elección)", "critical");
  const cBlankNull = add("blank-null-available", "Desglose de blancos y nulos disponible", "warning");
  const cOnpePct = add("onpe-participation-pct", "Participación calculada = porcentaje publicado por ONPE", "warning");
  const cCross = add("cross-election", "Votos emitidos de gobernador = suma de emitidos del consejo regional (si ambos están al 100 %)", "warning");

  const units = new Map(ds.elections.map((e) => [e.id, e]));
  const resultsByUnit = new Map<string, ElectionResult[]>();
  const seen = new Set<string>();
  for (const r of ds.results) {
    c1.test(Boolean(r.sourceUrl), refOf(r), "sin sourceUrl");
    c2.test(Boolean(r.sourceTimestamp), refOf(r), "sin sourceTimestamp");
    c3.test(r.votes >= 0, refOf(r), `votos negativos (${r.votes})`);
    c4.test(r.validVotePct >= 0 && r.validVotePct <= 100, refOf(r), `porcentaje fuera de rango (${r.validVotePct})`);
    cUnique.test(!seen.has(refOf(r)), refOf(r), "registro duplicado");
    seen.add(refOf(r));
    resultsByUnit.set(r.unitId, [...(resultsByUnit.get(r.unitId) ?? []), r]);
    const unit = units.get(r.unitId);
    cUnique.test(Boolean(unit), refOf(r), "el registro no pertenece a ninguna elección del dataset");
    if (unit && unit.validVotes > 0) {
      const expected = (r.votes / unit.validVotes) * 100;
      cPct.test(
        Math.abs(expected - r.validVotePct) <= PCT_TOLERANCE,
        refOf(r),
        `publicado ${r.validVotePct} % vs calculado ${expected.toFixed(4)} %`,
      );
    }
    c11.test(
      r.status !== "PROCLAMADO_JNE_JEE" || (Boolean(r.statusSourceUrl) && isJneSource(r.statusSourceUrl!)),
      refOf(r),
      "marcado como proclamado sin fuente verificable del JNE/JEE",
    );
  }
  for (const p of ds.participation) {
    c1.test(Boolean(p.sourceUrl), `participacion/${p.ubigeo}`, "sin sourceUrl");
    c2.test(Boolean(p.sourceTimestamp), `participacion/${p.ubigeo}`, "sin sourceTimestamp");
  }

  const threshold = ds.meta.secondRoundRule.thresholdPct;
  for (const unit of ds.elections) {
    const rows = resultsByUnit.get(unit.id) ?? [];
    c1.test(Boolean(unit.sources.totals && unit.sources.candidates), unit.id, "sin fuentes");
    c2.test(Boolean(unit.sourceTimestamp), unit.id, "sin sourceTimestamp");
    c3.test(
      [unit.validVotes, unit.votesCast, unit.blankVotes ?? 0, unit.nullVotes ?? 0].every((n) => n >= 0),
      unit.id,
      "totales negativos",
    );
    c4.test(unit.countedActsPct >= 0 && unit.countedActsPct <= 100, unit.id, "avance de actas fuera de rango");

    // 5. Ranking
    const sorted = [...rows].sort((a, b) => b.votes - a.votes);
    sorted.forEach((r) => {
      const expectedRank = 1 + rows.filter((o) => o.votes > r.votes).length;
      c5.test(r.rank === expectedRank, refOf(r), `rank ${r.rank}, esperado ${expectedRank}`);
    });

    // 6. Suma de candidaturas
    const sum = rows.reduce((acc, r) => acc + r.votes, 0);
    c6.test(sum === unit.validVotes, unit.id, `suma candidaturas ${sum} ≠ válidos ${unit.validVotes}`);

    // 7. Conciliación con emitidos
    if (unit.blankVotes === null || unit.nullVotes === null) {
      cBlankNull.test(false, unit.id, "sin desglose de blancos/nulos: no se puede conciliar con emitidos");
      c7.test(unit.validVotes <= unit.votesCast, unit.id, "válidos mayores que emitidos");
    } else {
      cBlankNull.test(true, unit.id, "ok");
      const total = unit.validVotes + unit.blankVotes + unit.nullVotes + (unit.challengedVotes ?? 0);
      c7.test(total === unit.votesCast, unit.id, `válidos+blancos+nulos = ${total} ≠ emitidos ${unit.votesCast}`);
    }

    // 8. Hábiles ≥ votaron
    if (unit.eligibleVoters !== null) {
      c8.test(unit.eligibleVoters >= unit.votesCast, unit.id, `hábiles ${unit.eligibleVoters} < emitidos ${unit.votesCast}`);
    }

    // Reglas de estado
    const second = rows.filter((r) => r.status === "SEGUNDA_VUELTA");
    const virtual = rows.filter((r) => r.status === "PRIMER_LUGAR_VIRTUAL");
    if (second.length > 0) {
      const top = sorted[0];
      cStatus.test(
        unit.electionId === 1 && unit.countComplete && second.length === 2 && Boolean(top) && top!.validVotePct < threshold,
        unit.id,
        "SEGUNDA_VUELTA solo aplica al gobierno regional, con actas al 100 % y sin fórmula con ≥ umbral",
      );
    }
    if (virtual.length > 0) {
      cStatus.test(unit.countComplete, unit.id, "PRIMER_LUGAR_VIRTUAL con conteo incompleto (dato provisional)");
      cStatus.test(virtual.length === 1 && virtual[0]!.rank === 1, unit.id, "PRIMER_LUGAR_VIRTUAL debe ser único y en el puesto 1");
    }
    if (unit.electionId === 1 && unit.countComplete && sorted[0] && sorted[0].validVotePct < threshold) {
      cStatus.test(second.length === 2, unit.id, "Ninguna fórmula supera el umbral pero no se marcó segunda vuelta");
    }
    if (unit.electionId === 2) {
      cStatus.test(virtual.length === 0 && second.length === 0, unit.id, "El consejo regional no tiene primer lugar virtual ni segunda vuelta");
    }
  }

  // 8-10. Participación
  for (const p of ds.participation) {
    const ref = `participacion/${p.ubigeo}`;
    c8.test(p.eligibleVoters >= p.votersWhoVoted, ref, `hábiles ${p.eligibleVoters} < votaron ${p.votersWhoVoted}`);
    c9.test(
      p.absentees + p.pendingVoters === p.eligibleVoters - p.votersWhoVoted,
      ref,
      `ausentes ${p.absentees} + pendientes ${p.pendingVoters} ≠ hábiles − votaron (${p.eligibleVoters - p.votersWhoVoted})`,
    );
    if (p.pendingVoters === 0) {
      c9.test(p.absentees === p.eligibleVoters - p.votersWhoVoted, ref, "sin pendientes, ausentes debe ser hábiles − votaron");
    }
    c9.test(!(p.pendingVoters > 0 && !p.provisional), ref, "con electores pendientes el dato debe marcarse provisional");
    const total = p.turnoutPct + p.absenteePct + p.pendingPct;
    c10.test(Math.abs(total - 100) <= SUM100_TOLERANCE, ref, `suma ${total.toFixed(3)} %`);
    cOnpePct.test(Math.abs(p.turnoutPct - p.onpeTurnoutPct) <= PCT_TOLERANCE, ref, `calculado ${p.turnoutPct} vs ONPE ${p.onpeTurnoutPct}`);
    cOnpePct.test(Math.abs(p.absenteePct - p.onpeAbsenteePct) <= PCT_TOLERANCE, ref, `ausentismo calculado ${p.absenteePct} vs ONPE ${p.onpeAbsenteePct}`);
  }

  // 12. Totales entre niveles
  const partBy = new Map(ds.participation.map((p) => [p.ubigeo, p]));
  const region = partBy.get(ds.meta.departmentUbigeo);
  for (const prov of ds.territory.provinces) {
    const pp = partBy.get(prov.ubigeo);
    cCoverage.test(Boolean(pp), `participacion/${prov.ubigeo}`, `sin participación de ${prov.name}`);
    const ds2 = prov.districts.map((d) => partBy.get(d.ubigeo));
    ds2.forEach((d, i) => cCoverage.test(Boolean(d), `participacion/${prov.districts[i]!.ubigeo}`, "sin participación distrital"));
    if (pp && ds2.every(Boolean)) {
      const sum = (k: "eligibleVoters" | "votersWhoVoted" | "absentees") => ds2.reduce((a, d) => a + d![k], 0);
      c12.test(sum("eligibleVoters") === pp.eligibleVoters, prov.ubigeo, `hábiles distritos ${sum("eligibleVoters")} ≠ provincia ${pp.eligibleVoters}`);
      c12.test(sum("votersWhoVoted") === pp.votersWhoVoted, prov.ubigeo, `votaron distritos ${sum("votersWhoVoted")} ≠ provincia ${pp.votersWhoVoted}`);
      c12.test(sum("absentees") === pp.absentees, prov.ubigeo, `ausentes distritos ${sum("absentees")} ≠ provincia ${pp.absentees}`);
    }
    for (const eid of [2, 3]) {
      cCoverage.test(units.has(`${eid}-${prov.ubigeo}`), `${eid}-${prov.ubigeo}`, "elección provincial faltante");
    }
    for (const d of prov.districts) {
      if (d.hasDistrictElection) cCoverage.test(units.has(`4-${d.ubigeo}`), `4-${d.ubigeo}`, `alcaldía distrital faltante (${d.name})`);
      else cCoverage.test(!units.has(`4-${d.ubigeo}`), `4-${d.ubigeo}`, `alcaldía distrital duplicada para capital ${d.name}`);
    }
  }
  cCoverage.test(ds.territory.provinces.length === 3, "provincias", `se esperaban 3 provincias, hay ${ds.territory.provinces.length}`);
  cCoverage.test(units.has(`1-${ds.meta.departmentUbigeo}`), "gobernador", "falta la elección regional");
  if (region) {
    const provs = ds.territory.provinces.map((p) => partBy.get(p.ubigeo)).filter(Boolean);
    if (provs.length === ds.territory.provinces.length) {
      const sum = (k: "eligibleVoters" | "votersWhoVoted" | "absentees") => provs.reduce((a, p) => a + p![k], 0);
      c12.test(sum("eligibleVoters") === region.eligibleVoters, "region", `hábiles provincias ${sum("eligibleVoters")} ≠ región ${region.eligibleVoters}`);
      c12.test(sum("votersWhoVoted") === region.votersWhoVoted, "region", `votaron provincias ${sum("votersWhoVoted")} ≠ región ${region.votersWhoVoted}`);
      c12.test(sum("absentees") === region.absentees, "region", `ausentes provincias ${sum("absentees")} ≠ región ${region.absentees}`);
    }
  }
  const gov = units.get(`1-${ds.meta.departmentUbigeo}`);
  const councils = ds.territory.provinces.map((p) => units.get(`2-${p.ubigeo}`));
  if (gov?.countComplete && councils.every((c) => c?.countComplete)) {
    const s = councils.reduce((a, c) => a + (c?.votesCast ?? 0), 0);
    cCross.test(s === gov.votesCast, "1 vs 2", `consejo ${s} ≠ gobernador ${gov.votesCast}`);
  }

  // Integridad del hash
  const { snapshotHash, ...meta } = ds.meta;
  void meta;
  const basis = canonicalJson({
    territory: ds.territory,
    organizations: ds.organizations,
    elections: ds.elections,
    results: ds.results.map(({ snapshotHash: h, ...rest }) => {
      void h;
      return rest;
    }),
    participation: ds.participation,
  });
  const recomputed = await sha256Hex(basis);
  cHash.test(recomputed === snapshotHash, "meta.snapshotHash", `hash declarado ${snapshotHash.slice(0, 12)}… ≠ recalculado ${recomputed.slice(0, 12)}…`);
  cHash.test(ds.results.every((r) => r.snapshotHash === snapshotHash), "results[].snapshotHash", "registros con hash distinto al del snapshot");

  return finish(checks, now, ds.meta.snapshotId, snapshotHash);
}

function finish(checks: Check[], now: string, snapshotId: string, snapshotHash: string): ValidationReport {
  const results = checks.map((c) => c.result());
  const failedCritical = results.filter((r) => !r.passed && r.severity === "critical").length;
  const failedWarnings = results.filter((r) => !r.passed && r.severity === "warning").length;
  return {
    generatedAt: now,
    snapshotId,
    snapshotHash,
    passed: failedCritical === 0 && failedWarnings === 0,
    publishable: failedCritical === 0,
    summary: {
      checks: results.length,
      passed: results.filter((r) => r.passed).length,
      failedCritical,
      failedWarnings,
    },
    checks: results,
  };
}
