/**
 * Empaqueta el proyecto en ../moquegua-resultados-erm-2026.zip (o --out <ruta>).
 * Excluye dependencias y artefactos de compilación; incluye datos, snapshots, logos y reportes.
 */
import path from "node:path";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import JSZip from "jszip";
import { ROOT, parseArgs } from "@/lib/node/io";

const EXCLUDE_DIRS = new Set(["node_modules", ".next", "out", "test-results", "playwright-report", ".git", "cache"]);
const EXCLUDE_FILES = [/\.zip$/i, /\.tsbuildinfo$/i, /^\.env(\.local)?$/i, /^next-env\.d\.ts$/];

function walk(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(abs).isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      out.push(...walk(abs, r));
    } else if (!EXCLUDE_FILES.some((re) => re.test(name))) out.push(r);
  }
  return out;
}

async function main() {
  const { values } = parseArgs();
  const folder = path.basename(ROOT);
  const outFile = path.resolve(values.get("out") ?? path.join(ROOT, "..", `${folder}.zip`));
  const zip = new JSZip();
  const files = walk(ROOT);
  for (const f of files) zip.file(`${folder}/${f}`, readFileSync(path.join(ROOT, f)), { date: statSync(path.join(ROOT, f)).mtime });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  writeFileSync(outFile, buffer);
  console.log(`ZIP creado: ${outFile} (${files.length} archivos, ${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
