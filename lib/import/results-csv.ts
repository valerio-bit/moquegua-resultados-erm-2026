import { z } from "zod";
import { parseCsv, toCsv } from "@/lib/csv";
import {
  ElectionIdSchema,
  LevelSchema,
  type Dataset,
  type ElectionId,
  type ElectionResult,
  type ElectionUnit,
} from "@/lib/schemas";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import { round } from "@/lib/format";
import { competitionRanks, decideStatus } from "@/lib/transforms/status";
import { ELECTION_LEVEL, ELECTION_NAMES } from "@/lib/transforms/build-dataset";

/** Columnas del CSV de resultados (exportación e importación manual, Modo B). */
export const RESULTS_CSV_COLUMNS = [
  "electionId",
  "electionName",
  "level",
  "department",
  "province",
  "district",
  "ubigeo",
  "unitId",
  "candidateName",
  "organizationCode",
  "organizationName",
  "organizationShortName",
  "votes",
  "validVotePct",
  "emittedVotePct",
  "rank",
  "status",
  "validVotes",
  "blankVotes",
  "nullVotes",
  "challengedVotes",
  "votesCast",
  "eligibleVoters",
  "totalActs",
  "processedActs",
  "countedActs",
  "observedActs",
  "jeeActs",
  "sourceUrl",
  "sourceTimestamp",
  "snapshotHash",
] as const;

export function datasetToResultsCsv(ds: Dataset): string {
  return toCsv(ds.results as unknown as Record<string, unknown>[], [...RESULTS_CSV_COLUMNS]);
}

const intField = z.coerce.number().int().nonnegative();
const optInt = z.preprocess((v) => (v === "" || v === undefined ? undefined : v), intField.optional());

const CsvRowSchema = z.object({
  electionId: z.coerce.number().pipe(ElectionIdSchema),
  level: LevelSchema,
  province: z.string().optional(),
  district: z.string().optional(),
  ubigeo: z.string().regex(/^\d{6}$/, "ubigeo de 6 dígitos"),
  candidateName: z.string().default(""),
  organizationCode: z.string().min(1),
  organizationName: z.string().min(1),
  organizationShortName: z.string().optional(),
  votes: intField,
  validVotePct: z.coerce.number().min(0).max(100),
  emittedVotePct: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(100).optional()),
  validVotes: intField,
  blankVotes: optInt,
  nullVotes: optInt,
  challengedVotes: optInt,
  votesCast: intField,
  eligibleVoters: optInt,
  totalActs: intField,
  processedActs: optInt,
  countedActs: intField,
  jeeActs: optInt,
  sourceUrl: z.url({ message: "sourceUrl obligatorio y válido" }),
  sourceTimestamp: z.iso.datetime({ offset: true, message: "sourceTimestamp ISO 8601 obligatorio" }),
});

export interface CsvImportResult {
  dataset: Dataset | null;
  errors: string[];
  warnings: string[];
}

/**
 * Convierte un CSV de resultados en una nueva versión del dataset. El territorio, las
 * organizaciones y la participación se toman de la versión base; los estados se
 * recalculan (no se aceptan "proclamados" sin fuente JNE/JEE registrada).
 */
export async function importResultsCsv(text: string, base: Dataset, now = new Date()): Promise<CsvImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(text);
  } catch (e) {
    return { dataset: null, errors: [e instanceof Error ? e.message : String(e)], warnings };
  }
  const missing = ["electionId", "ubigeo", "organizationCode", "votes", "sourceUrl", "sourceTimestamp"].filter(
    (c) => rows.length > 0 && !(c in rows[0]!),
  );
  if (rows.length === 0) errors.push("El CSV no tiene filas.");
  if (missing.length) errors.push(`Faltan columnas obligatorias: ${missing.join(", ")}`);
  if (errors.length) return { dataset: null, errors, warnings };

  const parsed: z.infer<typeof CsvRowSchema>[] = [];
  rows.forEach((r, i) => {
    const res = CsvRowSchema.safeParse(r);
    if (res.success) parsed.push(res.data);
    else errors.push(`Fila ${i + 2}: ${res.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
  });
  if (errors.length) return { dataset: null, errors, warnings };

  const groups = new Map<string, typeof parsed>();
  for (const r of parsed) {
    const key = `${r.electionId}-${r.ubigeo}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const proclamations = base.results
    .filter((r) => r.status === "PROCLAMADO_JNE_JEE" && r.statusSourceUrl)
    .map((r) => ({ electionId: r.electionId, ubigeo: r.ubigeo, organizationCode: r.organizationCode, sourceUrl: r.statusSourceUrl! }));
  const orgBy = new Map(base.organizations.map((o) => [o.code, o]));
  const partBy = new Map(base.participation.map((p) => [p.ubigeo, p]));

  const elections: ElectionUnit[] = [];
  const draft: Omit<ElectionResult, "snapshotHash">[] = [];
  for (const [unitId, list] of groups) {
    const first = list[0]!;
    const electionId = first.electionId as ElectionId;
    const inconsistent = list.some(
      (r) => r.validVotes !== first.validVotes || r.votesCast !== first.votesCast || r.totalActs !== first.totalActs || r.countedActs !== first.countedActs,
    );
    if (inconsistent) errors.push(`${unitId}: los totales de la elección difieren entre filas.`);
    const jeeActs = first.jeeActs ?? 0;
    const processedActs = first.processedActs ?? first.totalActs;
    const pendingActs = first.totalActs - processedActs;
    const countComplete = first.countedActs === first.totalActs && jeeActs === 0 && pendingActs === 0;
    const countedActsPct = first.totalActs > 0 ? round((first.countedActs / first.totalActs) * 100) : 0;
    const ranks = competitionRanks(list.map((r) => r.votes));
    const decision = decideStatus({
      electionId,
      ubigeo: first.ubigeo,
      countComplete,
      countedActsPct,
      candidates: list.map((r) => ({ organizationCode: r.organizationCode, votes: r.votes, validVotePct: r.validVotePct })),
      secondRoundThresholdPct: base.meta.secondRoundRule.thresholdPct,
      proclamations,
    });
    const stamp = list.map((r) => r.sourceTimestamp).sort().at(-1)!;
    const eligible = first.eligibleVoters ?? partBy.get(first.ubigeo)?.eligibleVoters ?? null;
    const provUbigeo = electionId === 1 ? undefined : first.ubigeo.slice(0, 4) + "00";
    elections.push({
      id: unitId,
      electionId,
      electionName: ELECTION_NAMES[electionId],
      level: ELECTION_LEVEL[electionId],
      ubigeo: first.ubigeo,
      department: "Moquegua",
      province: first.province || undefined,
      district: first.district || undefined,
      provinceUbigeo: provUbigeo,
      validVotes: first.validVotes,
      blankVotes: first.blankVotes ?? null,
      nullVotes: first.nullVotes ?? null,
      challengedVotes: first.challengedVotes ?? null,
      votesCast: first.votesCast,
      eligibleVoters: eligible,
      turnoutPct: eligible ? round((first.votesCast / eligible) * 100) : null,
      totalActs: first.totalActs,
      countedActs: first.countedActs,
      countedActsPct,
      jeeActs,
      pendingActs,
      processedActs,
      countComplete,
      outcome: decision.outcome,
      sources: { totals: first.sourceUrl, candidates: first.sourceUrl },
      sourceTimestamp: stamp,
      capturedAt: now.toISOString(),
      captureMethod: "manual-import",
    });
    list.forEach((r, i) => {
      const st = decision.statusByOrg.get(r.organizationCode) ?? { status: "COMPUTO_ONPE" as const };
      const org = orgBy.get(r.organizationCode);
      draft.push({
        electionId,
        electionName: ELECTION_NAMES[electionId],
        level: ELECTION_LEVEL[electionId],
        department: "Moquegua",
        province: r.province || undefined,
        district: r.district || undefined,
        candidateName: r.candidateName,
        organizationName: r.organizationName,
        organizationShortName: r.organizationShortName || org?.shortName,
        organizationLogo: org?.logo?.file,
        votes: r.votes,
        validVotePct: r.validVotePct,
        rank: ranks[i]!,
        validVotes: r.validVotes,
        blankVotes: r.blankVotes,
        nullVotes: r.nullVotes,
        challengedVotes: r.challengedVotes,
        votesCast: r.votesCast,
        eligibleVoters: eligible ?? undefined,
        totalActs: r.totalActs,
        processedActs,
        countedActs: r.countedActs,
        observedActs: jeeActs,
        jeeActs,
        status: st.status,
        sourceUrl: r.sourceUrl,
        sourceTimestamp: r.sourceTimestamp,
        unitId,
        ubigeo: r.ubigeo,
        organizationCode: r.organizationCode,
        emittedVotePct: r.emittedVotePct,
        candidateNameMissing: r.candidateName === "",
        isLeading: decision.leaders.includes(r.organizationCode),
        statusNote: st.note,
        statusSourceUrl: st.sourceUrl,
      });
    });
  }
  if (errors.length) return { dataset: null, errors, warnings };
  for (const code of new Set(draft.map((r) => r.organizationCode))) {
    if (!orgBy.has(code)) warnings.push(`Organización ${code} no existe en la versión base: se mostrará sin logo ni nombre de presentación.`);
  }
  const order = (x: { electionId: number; ubigeo: string }) => `${x.electionId}-${x.ubigeo}`;
  elections.sort((a, b) => order(a).localeCompare(order(b)));
  draft.sort((a, b) => order(a).localeCompare(order(b)) || a.rank - b.rank || a.organizationCode.localeCompare(b.organizationCode));

  const organizations = base.organizations.filter((o) => draft.some((r) => r.organizationCode === o.code));
  const snapshotHash = await sha256Hex(
    canonicalJson({ territory: base.territory, organizations, elections, results: draft, participation: base.participation }),
  );
  const stamps = [...elections.map((e) => e.sourceTimestamp), ...base.participation.map((p) => p.sourceTimestamp)].sort();
  const iso = now.toISOString();
  const dataset: Dataset = {
    ...base,
    meta: {
      ...base.meta,
      generatedAt: iso,
      snapshotId: `${iso.slice(0, 10)}_${iso.slice(11, 13)}-${iso.slice(14, 16)}-${iso.slice(17, 19)}`,
      rawFolder: "importación CSV",
      captureMethods: ["manual-import"],
      sourceTimestampMin: stamps[0]!,
      sourceTimestampMax: stamps.at(-1)!,
      snapshotHash,
    },
    organizations,
    elections,
    results: draft.map((r) => ({ ...r, snapshotHash })),
  };
  return { dataset, errors, warnings };
}
