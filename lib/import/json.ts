import { CaptureFileSchema, DatasetSchema, type Dataset } from "@/lib/schemas";
import { buildDataset, type BuildIssue, type RulesRef, type TerritoryRef } from "@/lib/transforms/build-dataset";
import type { LogoManifestRow, OrganizationRefRow } from "@/lib/csv";
import { mergeIntoBase } from "./merge";

export type JsonKind = "dataset" | "capture" | "onpe-response" | "unknown";

/** Identifica qué tipo de JSON se está importando. */
export function classifyJson(value: unknown): JsonKind {
  if (!value || typeof value !== "object") return "unknown";
  const o = value as Record<string, unknown>;
  if (o.schemaVersion === 1 && Array.isArray(o.results)) return "dataset";
  if (Array.isArray(o.captures)) return "capture";
  if ("data" in o && "success" in o) return "onpe-response";
  return "unknown";
}

/** Referencias necesarias para transformar capturas, reconstruidas desde una versión publicada. */
export function referencesFromDataset(ds: Dataset) {
  const organizationsRef: OrganizationRefRow[] = ds.organizations.map((o) => ({
    code: o.code,
    onpe_name: o.name,
    display_name: o.displayName,
    short_name: o.shortName ?? "",
    note: "",
  }));
  const logos: LogoManifestRow[] = ds.organizations
    .filter((o) => o.logo)
    .map((o) => ({
      organization_name: o.name,
      organization_code: o.code,
      filename: o.logo!.file.split("/").pop()!,
      source_url: o.logo!.sourceUrl,
      source_kind: o.logo!.sourceKind,
      downloaded_at: "",
      sha256: o.logo!.sha256,
      format: "",
      license_or_usage_note: "",
      verified: String(o.logo!.verified),
    }));
  const territoryRef: TerritoryRef = {
    source: ds.territory.source,
    department: { ubigeo: ds.territory.department.ubigeo, name: ds.territory.department.name },
    districtElectionOptions: Object.fromEntries(
      ds.territory.provinces.map((p) => [p.ubigeo, p.districts.filter((d) => d.hasDistrictElection).map((d) => d.name)]),
    ),
    note: "Derivado de la versión publicada.",
  };
  const rules: RulesRef = {
    regionalSecondRound: {
      electionId: 1,
      thresholdPct: ds.meta.secondRoundRule.thresholdPct,
      rule: "",
      electionDate: ds.meta.secondRoundRule.electionDate,
      sourceTitle: ds.meta.secondRoundRule.sourceTitle,
      sourceUrl: ds.meta.secondRoundRule.sourceUrl,
    },
  };
  const proclamations = ds.results
    .filter((r) => r.status === "PROCLAMADO_JNE_JEE" && r.statusSourceUrl)
    .map((r) => ({
      election_id: String(r.electionId),
      ubigeo: r.ubigeo,
      organization_code: r.organizationCode,
      candidate_name: r.candidateName,
      resolution: r.statusNote ?? "",
      resolution_date: "",
      source_url: r.statusSourceUrl!,
      checked_at: "",
    }));
  return { organizationsRef, logos, territoryRef, rules, proclamations };
}

export interface JsonImportResult {
  dataset: Dataset | null;
  errors: string[];
  warnings: string[];
  issues: BuildIssue[];
}

/**
 * Importa archivos JSON (Modo B): un dataset completo exportado por este sitio, o uno o
 * varios archivos de capturas ONPE (formato data/raw). Las capturas necesitan incluir
 * el catálogo de ubigeos; si falta, se reutiliza el territorio de la versión base.
 */
export async function importJsonFiles(files: { name: string; content: unknown }[], base: Dataset, now = new Date()): Promise<JsonImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const kinds = files.map((f) => ({ ...f, kind: classifyJson(f.content) }));
  const datasets = kinds.filter((k) => k.kind === "dataset");
  const captures = kinds.filter((k) => k.kind === "capture");
  for (const k of kinds) {
    if (k.kind === "onpe-response")
      errors.push(`${k.name}: es una respuesta ONPE suelta. Envuélvela en el formato de captura (captures[] con sourceUrl, kind y scope) para saber a qué ámbito pertenece.`);
    if (k.kind === "unknown") errors.push(`${k.name}: formato JSON no reconocido.`);
  }
  if (datasets.length > 1 || (datasets.length === 1 && captures.length > 0))
    errors.push("Importa un único dataset, o bien solo archivos de captura.");
  if (errors.length) return { dataset: null, errors, warnings, issues: [] };

  if (datasets.length === 1) {
    const parsed = DatasetSchema.safeParse(datasets[0]!.content);
    if (!parsed.success) {
      return {
        dataset: null,
        errors: parsed.error.issues.slice(0, 20).map((i) => `${datasets[0]!.name}: ${i.path.join(".")}: ${i.message}`),
        warnings,
        issues: [],
      };
    }
    return { dataset: parsed.data, errors, warnings, issues: [] };
  }

  for (const c of captures) {
    const r = CaptureFileSchema.safeParse(c.content);
    if (!r.success) errors.push(`${c.name}: ${r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  if (errors.length) return { dataset: null, errors, warnings, issues: [] };

  const files2 = captures.map((c) => ({ name: c.name, content: c.content }));
  const hasCatalog = files2.some((f) =>
    (f.content as { captures: { sourceUrl: string }[] }).captures.some((c) => c.sourceUrl.includes("/assets/ubig/")),
  );
  if (!hasCatalog) {
    warnings.push("Las capturas no incluyen el catálogo de ubigeos; se reutiliza el territorio de la versión publicada.");
    files2.push({
      name: "territorio-base.json",
      content: {
        captureMethod: "manual-import",
        capturedAt: now.toISOString(),
        captures: [
          {
            sourceUrl: "https://resultadoelectoral.onpe.gob.pe/assets/ubig/v1.json",
            note: "Reconstruido desde la versión publicada",
            response: [
              `${base.territory.department.ubigeo}|0|NACION|${base.territory.department.name}`,
              ...base.territory.provinces.flatMap((p) => [
                `${p.ubigeo}|${base.territory.department.ubigeo}|-|${p.name}`,
                ...p.districts.map((d) => `${d.ubigeo}|${p.ubigeo}|-|${d.name}`),
              ]),
            ],
          },
        ],
      },
    });
  }
  const iso = now.toISOString();
  const { dataset, issues } = await buildDataset({
    rawFolder: "importación manual",
    files: files2,
    ...referencesFromDataset(base),
    generatedAt: iso,
    snapshotId: `${iso.slice(0, 10)}_${iso.slice(11, 13)}-${iso.slice(14, 16)}-${iso.slice(17, 19)}`,
  });
  // Una importación parcial no es un error: lo que falta se conserva de la versión base.
  const PARTIAL_CODES = new Set(["MISSING_DISTRICT", "MISSING_PROVINCE", "MISSING_REGION"]);
  for (const i of issues) {
    if (i.level === "error" && !PARTIAL_CODES.has(i.code)) errors.push(`[${i.code}] ${i.message}`);
    else if (!PARTIAL_CODES.has(i.code)) warnings.push(`[${i.code}] ${i.message}`);
  }
  if (errors.length) return { dataset: null, errors, warnings, issues };
  if (dataset.elections.length === 0 && dataset.participation.length === 0) {
    return { dataset: null, errors: ["Las capturas no contienen resultados ni participación."], warnings, issues };
  }
  const merged = await mergeIntoBase(base, dataset);
  if (merged.keptUnits > 0) {
    warnings.push(
      `Importación parcial: se reemplazan ${merged.replacedUnits.length} elecciones y se conservan ${merged.keptUnits} de la versión publicada con su propio corte.`,
    );
  }
  return { dataset: merged.dataset, errors, warnings, issues };
}
