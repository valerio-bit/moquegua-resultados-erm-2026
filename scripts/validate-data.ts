/**
 * Valida el dataset publicado (data/processed/dataset.json) y escribe reports/validation-report.json.
 * Termina con código 1 si alguna validación crítica falla: así `npm run build` no genera
 * una versión publicable con totales que no cuadran.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { validateDataset } from "@/lib/validation/validate";
import { PROCESSED_DATASET, REPORTS_DIR, parseArgs, readJson, writeJson } from "@/lib/node/io";
import { printReport } from "@/lib/node/pipeline";

async function main() {
  const { flags } = parseArgs();
  if (!existsSync(PROCESSED_DATASET)) {
    console.error("✖ Falta data/processed/dataset.json. Ejecuta `npm run data:publish`.");
    process.exitCode = 1;
    return;
  }
  const dataset = readJson(PROCESSED_DATASET);
  const report = await validateDataset(dataset);
  const reportFile = path.join(REPORTS_DIR, "validation-report.json");
  const previous = existsSync(reportFile) ? readJson<{ buildIssues?: unknown[] }>(reportFile) : {};
  writeJson(reportFile, { ...report, buildIssues: previous.buildIssues ?? [] });
  if (!flags.has("quiet") || !report.publishable) printReport(report);
  else console.log(`Validación OK (${report.summary.passed}/${report.summary.checks} controles) · ${report.snapshotId}`);
  if (!report.publishable) {
    console.error("✖ Validación crítica fallida: no se puede generar una versión publicable.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
