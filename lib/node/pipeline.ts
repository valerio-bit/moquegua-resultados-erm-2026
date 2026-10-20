import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Dataset } from "@/lib/schemas";
import { buildDataset, type BuildIssue } from "@/lib/transforms/build-dataset";
import { validateDataset, type ValidationReport } from "@/lib/validation/validate";
import { sha256Hex } from "@/lib/hash";
import { compareDatasets, type DiffReport } from "@/lib/diff";
import {
  PROCESSED_DATASET,
  REPORTS_DIR,
  SNAPSHOT_DIR,
  listRawFolders,
  readJson,
  readRawFolder,
  readReferences,
  timestampId,
  writeJson,
} from "./io";

export interface SnapshotManifest {
  source: "ONPE";
  fetchedAt: string;
  records: number;
  sha256: string;
  validationPassed: boolean;
  publishable: boolean;
  snapshotId: string;
  snapshotHash: string;
  rawFolder: string;
  captureMethods: string[];
  sourceTimestampMin: string;
  sourceTimestampMax: string;
  generatedAt: string;
  buildIssues: BuildIssue[];
}

export interface PipelineResult {
  dataset: Dataset;
  report: ValidationReport;
  manifest: SnapshotManifest;
  snapshotFile: string;
  diff: DiffReport | null;
  published: boolean;
}

/** Construye el dataset desde una carpeta raw, crea snapshot + manifiesto y opcionalmente publica. */
export async function runPipeline(options: { rawFolder?: string; publish?: boolean; now?: Date }): Promise<PipelineResult> {
  const folders = listRawFolders();
  const rawFolder = options.rawFolder ?? folders[folders.length - 1];
  if (!rawFolder) throw new Error("No hay carpetas en data/raw. Ejecuta `npm run data:fetch` o `npm run data:import`.");
  const now = options.now ?? new Date();
  const snapshotId = timestampId(now);
  const refs = readReferences();
  const { dataset, issues } = await buildDataset({
    rawFolder,
    files: readRawFolder(rawFolder),
    ...refs,
    generatedAt: now.toISOString(),
    snapshotId,
  });
  return finalize(dataset, issues, options.publish ?? false, now);
}

/** Registra un dataset ya construido (p. ej., importado desde CSV) como snapshot. */
export async function finalize(dataset: Dataset, buildIssues: BuildIssue[], publish: boolean, now = new Date()): Promise<PipelineResult> {
  const report = await validateDataset(dataset, now.toISOString());
  const buildErrors = buildIssues.filter((i) => i.level === "error");
  const publishable = report.publishable && buildErrors.length === 0;

  const snapshotFile = path.join(SNAPSHOT_DIR, `${dataset.meta.snapshotId}.json`);
  const text = `${JSON.stringify(dataset, null, 2)}\n`;
  writeJson(snapshotFile, dataset, { exclusive: true });
  const manifest: SnapshotManifest = {
    source: "ONPE",
    fetchedAt: dataset.meta.generatedAt,
    records: dataset.results.length,
    sha256: await sha256Hex(text),
    validationPassed: publishable,
    publishable,
    snapshotId: dataset.meta.snapshotId,
    snapshotHash: dataset.meta.snapshotHash,
    rawFolder: dataset.meta.rawFolder,
    captureMethods: dataset.meta.captureMethods,
    sourceTimestampMin: dataset.meta.sourceTimestampMin,
    sourceTimestampMax: dataset.meta.sourceTimestampMax,
    generatedAt: now.toISOString(),
    buildIssues,
  };
  writeJson(path.join(SNAPSHOT_DIR, `${dataset.meta.snapshotId}.manifest.json`), manifest, { exclusive: true });
  writeJson(path.join(REPORTS_DIR, "validations", `${dataset.meta.snapshotId}.json`), { ...report, buildIssues });

  const previous = existsSync(PROCESSED_DATASET) ? readJson<Dataset>(PROCESSED_DATASET) : null;
  const diff = previous ? compareDatasets(previous, dataset) : null;

  let published = false;
  if (publish) {
    if (!publishable) {
      return { dataset, report, manifest, snapshotFile, diff, published };
    }
    copyFileSync(snapshotFile, PROCESSED_DATASET);
    writeJson(path.join(REPORTS_DIR, "validation-report.json"), { ...report, buildIssues });
    if (diff) writeJson(path.join(REPORTS_DIR, "last-publish-diff.json"), diff);
    published = true;
  }
  return { dataset, report, manifest, snapshotFile, diff, published };
}

export function printReport(report: ValidationReport, issues: BuildIssue[] = []): void {
  for (const i of issues) console.log(`${i.level === "error" ? "✖" : "⚠"} [${i.code}] ${i.message}${i.file ? ` (${i.file})` : ""}`);
  for (const c of report.checks) {
    const mark = c.passed ? "✔" : c.severity === "critical" ? "✖" : "⚠";
    console.log(`${mark} ${c.title} — ${c.checkedItems} comprobaciones${c.passed ? "" : `, ${c.failures.length} fallos`}`);
    for (const f of c.failures.slice(0, 5)) console.log(`    · ${f.ref}: ${f.message}`);
  }
  console.log(
    `\nResultado: ${report.summary.passed}/${report.summary.checks} controles OK · críticos fallidos: ${report.summary.failedCritical} · advertencias: ${report.summary.failedWarnings}`,
  );
}

export function readProcessed(): Dataset {
  if (!existsSync(PROCESSED_DATASET)) throw new Error("No existe data/processed/dataset.json. Ejecuta `npm run data:publish`.");
  return JSON.parse(readFileSync(PROCESSED_DATASET, "utf8")) as Dataset;
}
