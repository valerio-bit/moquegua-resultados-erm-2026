import JSZip from "jszip";
import type { Dataset } from "@/lib/schemas";
import { toCsv } from "@/lib/csv";
import { datasetToResultsCsv } from "@/lib/import/results-csv";
import { sha256Hex } from "@/lib/hash";
import type { ValidationReport } from "@/lib/validation/validate";
import type { DiffReport } from "@/lib/diff";

export const PARTICIPATION_CSV_COLUMNS = [
  "scope",
  "ubigeo",
  "department",
  "province",
  "district",
  "eligibleVoters",
  "votersWhoVoted",
  "absentees",
  "pendingVoters",
  "turnoutPct",
  "absenteePct",
  "pendingPct",
  "provisional",
  "onpeTurnoutPct",
  "onpeAbsenteePct",
  "sourceUrl",
  "sourceTimestamp",
];

export function datasetToParticipationCsv(ds: Dataset): string {
  return toCsv(ds.participation as unknown as Record<string, unknown>[], PARTICIPATION_CSV_COLUMNS);
}

export interface SnapshotManifestLite {
  source: "ONPE";
  fetchedAt: string;
  records: number;
  sha256: string;
  validationPassed: boolean;
  snapshotId: string;
  snapshotHash: string;
}

export async function snapshotManifest(ds: Dataset, report: ValidationReport | null): Promise<{ text: string; manifest: SnapshotManifestLite }> {
  const text = `${JSON.stringify(ds, null, 2)}\n`;
  return {
    text,
    manifest: {
      source: "ONPE",
      fetchedAt: ds.meta.generatedAt,
      records: ds.results.length,
      sha256: await sha256Hex(text),
      validationPassed: Boolean(report?.publishable),
      snapshotId: ds.meta.snapshotId,
      snapshotHash: ds.meta.snapshotHash,
    },
  };
}

/** Paquete descargable con la versión, su validación y la comparación. */
export async function buildExportZip(ds: Dataset, report: ValidationReport | null, diff: DiffReport | null): Promise<Blob> {
  const zip = new JSZip();
  const { text, manifest } = await snapshotManifest(ds, report);
  const folder = zip.folder(`moquegua-erm-2026_${ds.meta.snapshotId}`)!;
  folder.file("dataset.json", text);
  folder.file(`snapshots/${ds.meta.snapshotId}.json`, text);
  folder.file(`snapshots/${ds.meta.snapshotId}.manifest.json`, JSON.stringify(manifest, null, 2));
  folder.file("resultados.csv", datasetToResultsCsv(ds));
  folder.file("participacion.csv", datasetToParticipationCsv(ds));
  if (report) folder.file("validation-report.json", JSON.stringify(report, null, 2));
  if (diff) folder.file("comparacion.json", JSON.stringify(diff, null, 2));
  folder.file(
    "LEEME.txt",
    [
      "Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE).",
      `Snapshot ${ds.meta.snapshotId} · SHA-256 del contenido ${ds.meta.snapshotHash}`,
      `Validación: ${report ? (report.publishable ? "sin fallos críticos" : "CON FALLOS CRÍTICOS (no publicable)") : "no ejecutada"}`,
      "Para publicar: copia dataset.json en data/processed/dataset.json del proyecto, ejecuta npm run build y despliega.",
    ].join("\n"),
  );
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
