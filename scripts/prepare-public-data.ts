/**
 * Copia los datos abiertos de la versión publicada a public/datos/ para que el sitio
 * estático los ofrezca como descarga y el panel "Actualizar / Publicar" pueda leerlos.
 */
import path from "node:path";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { datasetToResultsCsv } from "@/lib/import/results-csv";
import { datasetToParticipationCsv } from "@/lib/export";
import { LOGO_MANIFEST, PROCESSED_DATASET, REPORTS_DIR, ROOT } from "@/lib/node/io";
import { readProcessed } from "@/lib/node/pipeline";

const out = path.join(ROOT, "public", "datos");
mkdirSync(out, { recursive: true });
const ds = readProcessed();
copyFileSync(PROCESSED_DATASET, path.join(out, "dataset.json"));
writeFileSync(path.join(out, "resultados.csv"), `﻿${datasetToResultsCsv(ds)}\n`, "utf8");
writeFileSync(path.join(out, "participacion.csv"), `﻿${datasetToParticipationCsv(ds)}\n`, "utf8");
const report = path.join(REPORTS_DIR, "validation-report.json");
if (existsSync(report)) copyFileSync(report, path.join(out, "validation-report.json"));
if (existsSync(LOGO_MANIFEST)) copyFileSync(LOGO_MANIFEST, path.join(out, "logos-manifest.csv"));
console.log(`Datos abiertos listos en public/datos/ (snapshot ${ds.meta.snapshotId})`);
