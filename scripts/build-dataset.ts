/**
 * Construye el dataset normalizado desde una carpeta de data/raw.
 *
 *   npm run data:build                 # última carpeta raw → snapshot + validación
 *   npm run data:build -- --raw 2026-10-20_07-47-00
 *   npm run data:publish               # además publica en data/processed/dataset.json si no hay fallos críticos
 */
import { parseArgs } from "@/lib/node/io";
import { printReport, runPipeline } from "@/lib/node/pipeline";

async function main() {
  const { flags, values } = parseArgs();
  const publish = flags.has("publish");
  const result = await runPipeline({ rawFolder: values.get("raw"), publish });
  printReport(result.report, result.manifest.buildIssues);
  console.log(`\nSnapshot: ${result.snapshotFile}`);
  console.log(`Registros: ${result.manifest.records} · hash ${result.manifest.snapshotHash}`);
  if (result.diff) {
    const c = result.diff.counts;
    console.log(
      `Cambios frente a la versión publicada: +${c.added} −${c.removed} ~${c.modified} (votos ${c.votesChanged}, porcentajes ${c.pctChanged}, estados ${c.statusChanged}); elecciones con cambios: ${result.diff.units.length}`,
    );
  }
  if (publish) {
    if (result.published) console.log("Publicado en data/processed/dataset.json ✔");
    else {
      console.error("✖ No se publicó: hay validaciones críticas fallidas o errores de construcción.");
      process.exitCode = 1;
    }
  } else if (!result.manifest.publishable) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
