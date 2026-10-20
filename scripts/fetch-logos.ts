/**
 * Descarga los símbolos de las organizaciones que aparecen en los resultados de Moquegua.
 *
 * Prioridad de fuentes:
 *   1. JNE (sroppublico.jne.gob.pe/Consulta/Simbolo/GetSimbolo/{id}). El buscador del JNE
 *      está protegido con CAPTCHA, por lo que el id de cada organización debe registrarlo
 *      una persona en data/reference/jne-simbolos.csv (code,jne_id,checked_by,checked_at).
 *      Este script NO intenta resolver ni evadir el CAPTCHA.
 *   2. Sitio oficial de la organización: data/reference/logos-oficiales.csv (code,url,checked_at).
 *   3. Activo público de la interfaz de ONPE: /assets/img-reales/partidos/{código 8 dígitos}.png
 *
 * No se redibuja ni se inventa ningún logo. Si no hay activo verificable, se registra
 * verified=false y la interfaz usa un rótulo tipográfico con el nombre del partido.
 */
import path from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildDataset } from "@/lib/transforms/build-dataset";
import { LOGO_MANIFEST_COLUMNS, parseCsv, toCsv, type LogoManifestRow } from "@/lib/csv";
import { sha256Hex } from "@/lib/hash";
import { LOGO_DIR, LOGO_MANIFEST, REFERENCE_DIR, listRawFolders, readRawFolder, readReferences, timestampId } from "@/lib/node/io";

const ONPE_ASSET = (code: string) =>
  `https://resultadoelectoral.onpe.gob.pe/assets/img-reales/partidos/${code.padStart(8, "0")}.png`;
const JNE_SYMBOL = (id: string) => `https://sroppublico.jne.gob.pe/Consulta/Simbolo/GetSimbolo/${encodeURIComponent(id)}`;
const MIN_INTERVAL_MS = 800;
const MAX_BYTES = 2_000_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function detectFormat(bytes: Uint8Array): "png" | "jpg" | "webp" | "svg" | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) return "webp";
  const head = new TextDecoder().decode(bytes.slice(0, 200)).trim().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return null;
}

async function download(url: string): Promise<{ bytes: Uint8Array; format: string } | { error: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "moquegua-resultados-erm-2026 (visualizacion independiente; logos)" } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    if (res.headers.get("x-amzn-waf-action")) return { error: "bloqueado por WAF (no se evade)" };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return { error: `tamaño inválido (${bytes.length} bytes)` };
    const format = detectFormat(bytes);
    if (!format) return { error: "el contenido no es una imagen reconocible" };
    return { bytes, format };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function readOptionalCsv(name: string): Record<string, string>[] {
  const file = path.join(REFERENCE_DIR, name);
  return existsSync(file) ? parseCsv(readFileSync(file, "utf8")) : [];
}

async function main() {
  const folders = listRawFolders();
  const rawFolder = folders[folders.length - 1];
  if (!rawFolder) throw new Error("No hay capturas en data/raw.");
  const refs = readReferences();
  const { dataset } = await buildDataset({
    rawFolder,
    files: readRawFolder(rawFolder),
    ...refs,
    logos: [],
    generatedAt: new Date().toISOString(),
    snapshotId: timestampId(),
  });
  const jne = new Map(readOptionalCsv("jne-simbolos.csv").map((r) => [r.code, r]));
  const official = new Map(readOptionalCsv("logos-oficiales.csv").map((r) => [r.code, r]));
  mkdirSync(LOGO_DIR, { recursive: true });

  const rows: LogoManifestRow[] = [];
  for (const org of dataset.organizations) {
    const attempts: { kind: string; url: string; note: string }[] = [];
    const j = jne.get(org.code);
    if (j?.jne_id) attempts.push({ kind: "jne", url: JNE_SYMBOL(j.jne_id), note: `JNE SROP, id ${j.jne_id} registrado por ${j.checked_by || "?"}` });
    const o = official.get(org.code);
    if (o?.url) attempts.push({ kind: "official-site", url: o.url, note: "Sitio oficial de la organización" });
    attempts.push({ kind: "onpe-interface", url: ONPE_ASSET(org.code), note: "Activo público de la interfaz de resultados de ONPE" });

    let saved: LogoManifestRow | null = null;
    const errors: string[] = [];
    for (const attempt of attempts) {
      await sleep(MIN_INTERVAL_MS);
      const got = await download(attempt.url);
      if ("error" in got) {
        errors.push(`${attempt.kind}: ${got.error}`);
        continue;
      }
      const filename = `${attempt.kind === "onpe-interface" ? "onpe" : attempt.kind}-${org.code.padStart(8, "0")}.${got.format}`;
      writeFileSync(path.join(LOGO_DIR, filename), got.bytes);
      saved = {
        organization_name: org.name,
        organization_code: org.code,
        filename,
        source_url: attempt.url,
        source_kind: attempt.kind,
        downloaded_at: new Date().toISOString(),
        sha256: await sha256Hex(got.bytes),
        format: got.format,
        license_or_usage_note: `${attempt.note}. Símbolo de organización política reproducido sin modificaciones con fines informativos; los derechos pertenecen a su titular.`,
        verified: "true",
      };
      break;
    }
    if (saved) {
      rows.push(saved);
      console.log(`✔ ${org.code} ${org.name} ← ${saved.source_kind}`);
    } else {
      rows.push({
        organization_name: org.name,
        organization_code: org.code,
        filename: "",
        source_url: "",
        source_kind: "none",
        downloaded_at: new Date().toISOString(),
        sha256: "",
        format: "",
        license_or_usage_note: `Sin activo verificable (${errors.join("; ")}). Se usa rótulo tipográfico.`,
        verified: "false",
      });
      console.warn(`⚠ ${org.code} ${org.name}: sin logo verificable (${errors.join("; ")})`);
    }
  }
  writeFileSync(LOGO_MANIFEST, `${toCsv(rows, [...LOGO_MANIFEST_COLUMNS])}\n`, "utf8");
  console.log(`\nManifiesto: ${LOGO_MANIFEST} (${rows.filter((r) => r.verified === "true").length}/${rows.length} verificados)`);
  console.log("Ejecuta `npm run data:publish` para incorporar los logos al dataset.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
