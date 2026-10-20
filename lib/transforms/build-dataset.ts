import {
  CaptureFileSchema,
  OnpeParticipacionTotalesSchema,
  OnpeParticipantesSchema,
  OnpeTotalesSchema,
  type Capture,
  type Dataset,
  type DistrictRef,
  type ElectionId,
  type ElectionResult,
  type ElectionUnit,
  type Level,
  type Organization,
  type Participation,
  type ProvinceRef,
  type Territory,
} from "@/lib/schemas";
import type { LogoManifestRow, OrganizationRefRow, ProclamationRow } from "@/lib/csv";
import { cleanCandidateName, slugify, titleCase } from "@/lib/text";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import { round } from "@/lib/format";
import { competitionRanks, decideStatus } from "./status";
import { computeParticipation } from "./participation";

export const ELECTION_NAMES: Record<ElectionId, string> = {
  1: "Gobernador y vicegobernador regional",
  2: "Consejo regional",
  3: "Alcaldía provincial",
  4: "Alcaldía distrital",
};

export const ELECTION_LEVEL: Record<ElectionId, Level> = {
  1: "REGIONAL",
  2: "REGIONAL",
  3: "PROVINCIAL",
  4: "DISTRICT",
};

export const BLANK_CODES = new Set(["80"]);
export const NULL_CODES = new Set(["81"]);
const BLANK_NAME = "VOTOS EN BLANCO";
const NULL_NAME = "VOTOS NULOS";
const CHALLENGED_NAME = "VOTOS IMPUGNADOS";

export interface RulesRef {
  regionalSecondRound: {
    electionId: number;
    thresholdPct: number;
    rule: string;
    electionDate: string;
    sourceTitle: string;
    sourceUrl: string;
  };
}

export interface TerritoryRef {
  source: string;
  department: { ubigeo: string; name: string };
  districtElectionOptions: Record<string, string[]>;
  note: string;
}

export interface BuildInput {
  rawFolder: string;
  files: { name: string; content: unknown }[];
  organizationsRef: OrganizationRefRow[];
  logos: LogoManifestRow[];
  proclamations: ProclamationRow[];
  rules: RulesRef;
  territoryRef: TerritoryRef;
  generatedAt: string;
  snapshotId: string;
}

export interface BuildIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  file?: string;
}

export interface BuildOutput {
  dataset: Dataset;
  issues: BuildIssue[];
}

interface FlatCapture extends Capture {
  file: string;
  capturedAt: string;
  pageTimestamp?: string;
  captureMethod: string;
}

const pad6 = (n: number | string) => String(n).padStart(6, "0");

function scopeUbigeo(c: Capture): string | undefined {
  return c.scope?.district ?? c.scope?.province ?? c.scope?.department;
}

/** Reglas de territorio: se parte del registro MOQUEGUA del catálogo ONPE, nunca de un código fijo. */
function buildTerritory(ubigeoCapture: FlatCapture | undefined, ref: TerritoryRef, issues: BuildIssue[]): Territory {
  if (!ubigeoCapture) throw new Error("Falta la captura del catálogo de ubigeos de ONPE (assets/ubig/v1.json).");
  const rows: { code: string; parent: string; name: string }[] = [];
  const response = ubigeoCapture.response;
  if (!Array.isArray(response)) throw new Error("El catálogo de ubigeos no es una lista.");
  for (const item of response) {
    if (typeof item === "string") {
      const [code, parent, , name] = item.split("|");
      if (code && parent !== undefined && name) rows.push({ code, parent: pad6(parent), name });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.c_ubigeo === "string" && typeof o.c_nombre === "string") {
        rows.push({ code: o.c_ubigeo, parent: pad6(String(o.n_ubigeo_padre ?? "0")), name: o.c_nombre });
      }
    }
  }
  const deptCandidates = rows.filter((r) => r.name === "MOQUEGUA" && r.parent === "000000");
  if (deptCandidates.length !== 1) throw new Error("No se pudo identificar un único departamento MOQUEGUA en el catálogo ONPE.");
  const dept = deptCandidates[0]!;
  if (dept.code !== ref.department.ubigeo) {
    issues.push({
      level: "error",
      code: "UBIGEO_REF_MISMATCH",
      message: `El catálogo ONPE identifica MOQUEGUA con ${dept.code} pero la referencia indica ${ref.department.ubigeo}.`,
    });
  }
  const provinces: ProvinceRef[] = rows
    .filter((r) => r.parent === dept.code)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((p) => {
      const options = ref.districtElectionOptions[p.code] ?? [];
      const districts: DistrictRef[] = rows
        .filter((r) => r.parent === p.code)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((d) => {
          const hasDistrictElection = options.includes(d.name);
          return {
            ubigeo: d.code,
            name: d.name,
            displayName: titleCase(d.name),
            slug: slugify(d.name),
            hasDistrictElection,
            isProvincialCapital: !hasDistrictElection,
          };
        });
      return { ubigeo: p.code, name: p.name, displayName: titleCase(p.name), slug: slugify(p.name), districts };
    });
  return {
    department: { ubigeo: dept.code, name: dept.name, displayName: titleCase(dept.name) },
    provinces,
    source: ref.source,
  };
}

function pickLatest(captures: FlatCapture[], issues: BuildIssue[], label: string): FlatCapture | undefined {
  if (captures.length <= 1) return captures[0];
  const sorted = [...captures].sort((a, b) => {
    const ta = Date.parse(a.capturedAt);
    const tb = Date.parse(b.capturedAt);
    return ta !== tb ? tb - ta : b.file.localeCompare(a.file);
  });
  issues.push({
    level: "warning",
    code: "MULTIPLE_CUTS",
    message: `${label}: ${captures.length} cortes capturados; se usa el más reciente (${sorted[0]!.capturedAt}, ${sorted[0]!.file}). Los anteriores se conservan en data/raw.`,
  });
  return sorted[0];
}

export async function buildDataset(input: BuildInput): Promise<BuildOutput> {
  const issues: BuildIssue[] = [];
  const flat: FlatCapture[] = [];
  const methods = new Set<string>();

  for (const f of input.files) {
    const parsed = CaptureFileSchema.safeParse(f.content);
    if (!parsed.success) {
      issues.push({
        level: "error",
        code: "CAPTURE_SCHEMA",
        message: `Archivo con formato inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        file: f.name,
      });
      continue;
    }
    methods.add(parsed.data.captureMethod);
    for (const c of parsed.data.captures) {
      flat.push({
        ...c,
        file: f.name,
        capturedAt: parsed.data.capturedAt,
        pageTimestamp: parsed.data.pageTimestamp,
        captureMethod: parsed.data.captureMethod,
      });
    }
  }

  const territory = buildTerritory(
    flat.find((c) => c.sourceUrl.includes("/assets/ubig/")),
    input.territoryRef,
    issues,
  );
  const deptUbigeo = territory.department.ubigeo;

  const provinceByUbigeo = new Map(territory.provinces.map((p) => [p.ubigeo, p]));
  const districtByUbigeo = new Map<string, { d: DistrictRef; p: ProvinceRef }>();
  for (const p of territory.provinces) for (const d of p.districts) districtByUbigeo.set(d.ubigeo, { d, p });

  // Agrupar capturas por tipo + elección + ámbito
  const groups = new Map<string, FlatCapture[]>();
  for (const c of flat) {
    if (!c.kind) continue;
    const key = `${c.kind}|${c.electionId ?? ""}|${scopeUbigeo(c) ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const get = (kind: string, electionId: number | "", ubigeo: string) =>
    pickLatest(groups.get(`${kind}|${electionId}|${ubigeo}`) ?? [], issues, `${kind} elección ${electionId || "-"} ámbito ${ubigeo}`);

  /* ---------------- Participación ---------------- */
  const participation: Participation[] = [];
  for (const [key, list] of groups) {
    if (!key.startsWith("participacion-totales|")) continue;
    const c = pickLatest(list, issues, key)!;
    const parsed = OnpeParticipacionTotalesSchema.safeParse(c.response);
    if (!parsed.success) {
      issues.push({ level: "error", code: "PARTICIPATION_SCHEMA", message: `Participación inválida (${key})`, file: c.file });
      continue;
    }
    const d = parsed.data.data;
    const ub = scopeUbigeo(c)!;
    const dist = districtByUbigeo.get(ub);
    const prov = provinceByUbigeo.get(ub) ?? dist?.p;
    const scope: Participation["scope"] = c.scope?.district ? "DISTRICT" : c.scope?.province ? "PROVINCE" : "REGION";
    if (!c.pageTimestamp) {
      issues.push({
        level: "warning",
        code: "PARTICIPATION_TIMESTAMP",
        message: `Participación ${ub}: la respuesta no trae fecha; se usa la hora de captura.`,
        file: c.file,
      });
    }
    participation.push(
      computeParticipation({
        eligibleVoters: d.totalElectoresHabiles,
        votersWhoVoted: d.totalAsistentes,
        onpeAbsentees: d.totalAusentes,
        onpeTurnoutPct: d.porcentajeAsistentes,
        onpeAbsenteePct: d.porcentajeAusentes,
        scope,
        department: territory.department.displayName,
        province: scope !== "REGION" ? prov?.displayName : undefined,
        district: scope === "DISTRICT" ? dist?.d.displayName : undefined,
        ubigeo: ub,
        sourceUrl: c.sourceUrl,
        sourceTimestamp: new Date(c.pageTimestamp ?? c.capturedAt).toISOString(),
      }),
    );
  }
  participation.sort((a, b) => a.ubigeo.localeCompare(b.ubigeo));
  const participationByUbigeo = new Map(participation.map((p) => [p.ubigeo, p]));

  /* ---------------- Organizaciones ---------------- */
  const orgRef = new Map(input.organizationsRef.map((o) => [o.code, o]));
  const logoByCode = new Map(input.logos.map((l) => [l.organization_code, l]));

  /* ---------------- Elecciones ---------------- */
  const elections: ElectionUnit[] = [];
  const draftResults: Omit<ElectionResult, "snapshotHash">[] = [];
  const orgNames = new Map<string, string>();
  const proclamations = input.proclamations.map((p) => ({
    electionId: Number(p.election_id),
    ubigeo: p.ubigeo,
    organizationCode: p.organization_code,
    sourceUrl: p.source_url,
    resolution: p.resolution,
  }));

  for (const [key, list] of groups) {
    if (!key.startsWith("totales|")) continue;
    const [, eidText, ub] = key.split("|");
    const electionId = Number(eidText) as ElectionId;
    if (![1, 2, 3, 4].includes(electionId) || !ub) continue;
    const totCap = pickLatest(list, issues, key)!;
    const partCap = get("participantes", electionId, ub);
    const ubicCap = get("ubicacion-geografica", electionId, ub);

    const tot = OnpeTotalesSchema.safeParse(totCap.response);
    if (!tot.success) {
      issues.push({ level: "error", code: "TOTALS_SCHEMA", message: `Totales inválidos (${key})`, file: totCap.file });
      continue;
    }
    if (!partCap) {
      issues.push({ level: "error", code: "MISSING_CANDIDATES", message: `Faltan candidatos para ${key}` });
      continue;
    }
    const parts = OnpeParticipantesSchema.safeParse(partCap.response);
    if (!parts.success) {
      issues.push({ level: "error", code: "CANDIDATES_SCHEMA", message: `Candidatos inválidos (${key})`, file: partCap.file });
      continue;
    }

    const t = tot.data.data;
    const dist = districtByUbigeo.get(ub);
    const prov = provinceByUbigeo.get(ub) ?? dist?.p;
    if (electionId === 4 && dist && !dist.d.hasDistrictElection) {
      issues.push({
        level: "error",
        code: "CAPITAL_DUPLICATED",
        message: `Se capturó alcaldía distrital para ${dist.d.name}, capital administrada por la municipalidad provincial.`,
      });
    }

    let blankVotes: number | null = null;
    let nullVotes: number | null = null;
    let challengedVotes: number | null = null;
    if (ubicCap) {
      const ubic = OnpeParticipantesSchema.safeParse(ubicCap.response);
      if (ubic.success) {
        for (const row of ubic.data.data) {
          const code = String(row.codigoAgrupacionPolitica);
          const name = row.nombreAgrupacionPolitica.trim().toUpperCase();
          if (BLANK_CODES.has(code) || name === BLANK_NAME) blankVotes = row.totalVotosValidos;
          else if (NULL_CODES.has(code) || name === NULL_NAME) nullVotes = row.totalVotosValidos;
          else if (name === CHALLENGED_NAME) challengedVotes = row.totalVotosValidos;
        }
      } else {
        issues.push({ level: "error", code: "BLANKNULL_SCHEMA", message: `Desglose blancos/nulos inválido (${key})`, file: ubicCap.file });
      }
    } else {
      issues.push({ level: "warning", code: "MISSING_BLANKNULL", message: `Sin desglose de blancos/nulos para ${key}.` });
    }

    const pendingActs = t.pendientesJee;
    const jeeActs = t.enviadasJee;
    const countComplete = t.contabilizadas === t.totalActas && jeeActs === 0 && pendingActs === 0;
    const eligible = participationByUbigeo.get(ub)?.eligibleVoters ?? null;
    const level = ELECTION_LEVEL[electionId];
    const provinceName = prov?.displayName;
    const districtName = electionId === 4 ? dist?.d.displayName : undefined;

    const rows = parts.data.data.filter((r) => {
      const code = String(r.codigoAgrupacionPolitica);
      return !BLANK_CODES.has(code) && !NULL_CODES.has(code);
    });
    const ranks = competitionRanks(rows.map((r) => r.totalVotosValidos));
    const candidates = rows.map((r) => ({
      organizationCode: String(r.codigoAgrupacionPolitica),
      votes: r.totalVotosValidos,
      validVotePct: r.porcentajeVotosValidos ?? round((r.totalVotosValidos / t.totalVotosValidos) * 100),
    }));
    const decision = decideStatus({
      electionId,
      ubigeo: ub,
      countComplete,
      countedActsPct: t.actasContabilizadas,
      candidates,
      secondRoundThresholdPct: input.rules.regionalSecondRound.thresholdPct,
      proclamations,
    });

    const unitId = `${electionId}-${ub}`;
    const sourceTimestamp = t.fechaActualizacion;
    elections.push({
      id: unitId,
      electionId,
      electionName: ELECTION_NAMES[electionId],
      level,
      ubigeo: ub,
      department: "Moquegua",
      province: electionId === 1 ? undefined : provinceName,
      district: districtName,
      provinceUbigeo: electionId === 1 ? undefined : prov?.ubigeo,
      validVotes: t.totalVotosValidos,
      blankVotes,
      nullVotes,
      challengedVotes,
      votesCast: t.totalVotosEmitidos,
      eligibleVoters: eligible,
      turnoutPct: t.participacionCiudadana,
      totalActs: t.totalActas,
      countedActs: t.contabilizadas,
      countedActsPct: t.actasContabilizadas,
      jeeActs,
      pendingActs,
      processedActs: t.totalActas - pendingActs,
      countComplete,
      outcome: decision.outcome,
      sources: { totals: totCap.sourceUrl, candidates: partCap.sourceUrl, blankNull: ubicCap?.sourceUrl },
      sourceTimestamp,
      capturedAt: totCap.capturedAt,
      captureMethod: totCap.captureMethod,
    });

    rows.forEach((r, i) => {
      const code = String(r.codigoAgrupacionPolitica);
      orgNames.set(code, r.nombreAgrupacionPolitica);
      const { name, normalizedFrom } = cleanCandidateName(r.nombreCandidato);
      const st = decision.statusByOrg.get(code) ?? { status: "COMPUTO_ONPE" as const };
      const ref = orgRef.get(code);
      const logo = logoByCode.get(code);
      draftResults.push({
        electionId,
        electionName: ELECTION_NAMES[electionId],
        level,
        department: "Moquegua",
        province: electionId === 1 ? undefined : provinceName,
        district: districtName,
        candidateName: name,
        organizationName: r.nombreAgrupacionPolitica,
        organizationShortName: ref?.short_name || undefined,
        organizationLogo: logo ? `/logos/partidos/${logo.filename}` : undefined,
        votes: r.totalVotosValidos,
        validVotePct: candidates[i]!.validVotePct,
        rank: ranks[i]!,
        validVotes: t.totalVotosValidos,
        blankVotes: blankVotes ?? undefined,
        nullVotes: nullVotes ?? undefined,
        challengedVotes: challengedVotes ?? undefined,
        votesCast: t.totalVotosEmitidos,
        eligibleVoters: eligible ?? undefined,
        totalActs: t.totalActas,
        processedActs: t.totalActas - pendingActs,
        countedActs: t.contabilizadas,
        observedActs: jeeActs,
        jeeActs,
        status: st.status,
        sourceUrl: partCap.sourceUrl,
        sourceTimestamp,
        unitId,
        ubigeo: ub,
        organizationCode: code,
        emittedVotePct: r.porcentajeVotosEmitidos,
        candidateNameMissing: name === "",
        nameNormalizedFrom: normalizedFrom,
        isLeading: decision.leaders.includes(code),
        statusNote:
          st.note ??
          (electionId === 2
            ? "Lista de candidatos al consejo regional: ONPE no publica los nombres en este servicio."
            : name === ""
              ? "ONPE publica votos para esta organización sin consignar el nombre del candidato."
              : undefined),
        statusSourceUrl: st.sourceUrl,
      });
    });
  }

  // Comprobar cobertura de alcaldías distritales según la jerarquía ONPE
  for (const p of territory.provinces) {
    for (const d of p.districts) {
      if (d.hasDistrictElection && !elections.some((e) => e.electionId === 4 && e.ubigeo === d.ubigeo)) {
        issues.push({ level: "error", code: "MISSING_DISTRICT", message: `Falta la alcaldía distrital de ${d.name} (${d.ubigeo}).` });
      }
    }
    for (const eid of [2, 3] as const) {
      if (!elections.some((e) => e.electionId === eid && e.ubigeo === p.ubigeo)) {
        issues.push({ level: "error", code: "MISSING_PROVINCE", message: `Falta ${ELECTION_NAMES[eid]} de ${p.name}.` });
      }
    }
  }
  if (!elections.some((e) => e.electionId === 1 && e.ubigeo === deptUbigeo)) {
    issues.push({ level: "error", code: "MISSING_REGION", message: "Falta la elección de gobernador regional." });
  }

  const order = (e: { electionId: number; ubigeo: string }) => `${e.electionId}-${e.ubigeo}`;
  elections.sort((a, b) => order(a).localeCompare(order(b)));
  draftResults.sort((a, b) => order(a).localeCompare(order(b)) || a.rank - b.rank || a.organizationCode.localeCompare(b.organizationCode));

  const organizations: Organization[] = [...orgNames.entries()]
    .map(([code, onpeName]) => {
      const ref = orgRef.get(code);
      if (!ref) {
        issues.push({ level: "warning", code: "ORG_WITHOUT_REF", message: `Organización ${code} (${onpeName}) sin nombre de presentación en data/reference/organizaciones.csv.` });
      }
      const logo = logoByCode.get(code);
      return {
        code,
        name: onpeName,
        displayName: ref?.display_name || titleCase(onpeName),
        shortName: ref?.short_name || undefined,
        slug: slugify(ref?.display_name || onpeName),
        logo: logo
          ? {
              file: `/logos/partidos/${logo.filename}`,
              sourceUrl: logo.source_url,
              sha256: logo.sha256,
              verified: logo.verified === "true",
              sourceKind: logo.source_kind,
            }
          : undefined,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));

  const stamps = [...elections.map((e) => e.sourceTimestamp), ...participation.map((p) => p.sourceTimestamp)].sort(
    (a, b) => Date.parse(a) - Date.parse(b),
  );

  const hashBasis = canonicalJson({ territory, organizations, elections, results: draftResults, participation });
  const snapshotHash = await sha256Hex(hashBasis);
  const results: ElectionResult[] = draftResults.map((r) => ({ ...r, snapshotHash }));

  const rule = input.rules.regionalSecondRound;
  const dataset: Dataset = {
    schemaVersion: 1,
    meta: {
      source: "ONPE",
      sourceName: "Oficina Nacional de Procesos Electorales (ONPE)",
      sourceHome: "https://resultadoelectoral.onpe.gob.pe/main/alcance-electoral",
      processName: "Elecciones Regionales y Municipales 2026 (ERM2026)",
      processId: 4,
      electionDate: "2026-10-04",
      department: "Moquegua",
      departmentUbigeo: deptUbigeo,
      generatedAt: input.generatedAt,
      snapshotId: input.snapshotId,
      rawFolder: input.rawFolder,
      captureMethods: [...methods].sort(),
      sourceTimestampMin: stamps[0] ?? input.generatedAt,
      sourceTimestampMax: stamps[stamps.length - 1] ?? input.generatedAt,
      snapshotHash,
      secondRoundRule: {
        thresholdPct: rule.thresholdPct,
        electionDate: rule.electionDate,
        sourceTitle: rule.sourceTitle,
        sourceUrl: rule.sourceUrl,
      },
      notes: [
        "Cifras del cómputo ONPE. Un primer lugar en el cómputo no equivale a autoridad electa o proclamada.",
        "Solo se marca una candidatura como proclamada si existe una fuente verificable del JNE/JEE en data/reference/proclamaciones-jne.csv.",
        "Cada ámbito conserva su propia fecha y hora de corte ONPE (sourceTimestamp).",
      ],
    },
    territory,
    organizations,
    elections,
    results,
    participation,
  };
  return { dataset, issues };
}
