/**
 * MODO B — Importación manual de archivos exportados o copiados de la fuente pública.
 *
 *   npm run data:import -- capturas.json [mas-capturas.json] [--publish]
 *   npm run data:import -- resultados.csv [--publish]
 *   npm run data:import -- dataset.json [--publish]
 *
 * Cada archivo se valida antes de aceptarse. Los originales se guardan en data/raw/<UTC>/
 * y se genera un snapshot nuevo (nunca se sobrescriben los anteriores).
 */
import path from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { importJsonFiles } from "@/lib/import/json";
import { importResultsCsv } from "@/lib/import/results-csv";
import { RAW_DIR, parseArgs, timestampId } from "@/lib/node/io";
import { finalize, printReport, readProcessed } from "@/lib/node/pipeline";
import type { Dataset } from "@/lib/schemas";

async function main() {
  const { flags, positional } = parseArgs();
  if (positional.length === 0) {
    console.error("Uso: npm run data:import -- <archivo.json|archivo.csv> [...] [--publish]");
    process.exitCode = 1;
    return;
  }
  const base = readProcessed();
  const now = new Date();
  const csvFiles = positional.filter((f) => f.toLowerCase().endsWith(".csv"));
  const jsonFiles = positional.filter((f) => f.toLowerCase().endsWith(".json"));
  const other = positional.filter((f) => !csvFiles.includes(f) && !jsonFiles.includes(f));
  if (other.length) throw new Error(`Formato no admitido: ${other.join(", ")} (solo .json y .csv)`);
  if (csvFiles.length && jsonFiles.length) throw new Error("Importa CSV o JSON por separado.");
  if (csvFiles.length > 1) throw new Error("Importa un único CSV de resultados por vez.");
  for (const f of positional) if (!existsSync(f)) throw new Error(`No existe ${f}`);

  let dataset: Dataset | null = null;
  let errors: string[] = [];
  let warnings: string[] = [];
  if (csvFiles.length === 1) {
    ({ dataset, errors, warnings } = await importResultsCsv(readFileSync(csvFiles[0]!, "utf8"), base, now));
  } else {
    const files = jsonFiles.map((f) => {
      try {
        return { name: path.basename(f), content: JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) as unknown };
      } catch {
        throw new Error(`${f}: JSON mal formado`);
      }
    });
    ({ dataset, errors, warnings } = await importJsonFiles(files, base, now));
  }
  for (const w of warnings) console.warn(`⚠ ${w}`);
  if (errors.length || !dataset) {
    for (const e of errors) console.error(`✖ ${e}`);
    console.error("Importación rechazada: corrige los archivos y vuelve a intentarlo.");
    process.exitCode = 1;
    return;
  }

  const rawId = timestampId(now);
  const rawDir = path.join(RAW_DIR, rawId);
  if (existsSync(rawDir)) throw new Error(`La carpeta ${rawDir} ya existe; no se sobrescribe.`);
  mkdirSync(rawDir, { recursive: true });
  for (const f of positional) copyFileSync(f, path.join(rawDir, path.basename(f)));
  dataset = { ...dataset, meta: { ...dataset.meta, rawFolder: rawId, snapshotId: rawId } };

  const result = await finalize(dataset, [], flags.has("publish"), now);
  printReport(result.report);
  if (result.diff) {
    const c = result.diff.counts;
    console.log(`Cambios: +${c.added} −${c.removed} ~${c.modified} · estados ${c.statusChanged} · elecciones con cambios ${result.diff.units.length}`);
  }
  console.log(`Originales: data/raw/${rawId}/ · Snapshot: ${result.snapshotFile}`);
  if (flags.has("publish") && !result.published) {
    console.error("✖ No se publicó: hay validaciones críticas fallidas.");
    process.exitCode = 1;
  } else if (result.published) console.log("Publicado en data/processed/dataset.json ✔");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
