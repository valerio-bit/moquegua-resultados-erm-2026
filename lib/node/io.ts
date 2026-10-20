/** Utilidades de archivos para los scripts (solo Node; no importar desde componentes cliente). */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv, type LogoManifestRow, type OrganizationRefRow, type ProclamationRow } from "@/lib/csv";
import type { RulesRef, TerritoryRef } from "@/lib/transforms/build-dataset";

export const ROOT = process.cwd();
export const DATA = path.join(ROOT, "data");
export const RAW_DIR = path.join(DATA, "raw");
export const SNAPSHOT_DIR = path.join(DATA, "snapshots");
export const PROCESSED_DATASET = path.join(DATA, "processed", "dataset.json");
export const REFERENCE_DIR = path.join(DATA, "reference");
export const REPORTS_DIR = path.join(ROOT, "reports");
export const LOGO_DIR = path.join(ROOT, "public", "logos", "partidos");
export const LOGO_MANIFEST = path.join(REFERENCE_DIR, "logos-manifest.csv");

/** Marca de tiempo UTC con el formato pedido: YYYY-MM-DD_HH-mm-ss. */
export function timestampId(date = new Date()): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)}_${iso.slice(11, 13)}-${iso.slice(14, 16)}-${iso.slice(17, 19)}`;
}

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) as T;
}

/** Escribe JSON creando carpetas. Con `exclusive` falla si el archivo ya existe (snapshots inmutables). */
export function writeJson(file: string, data: unknown, options: { exclusive?: boolean } = {}): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: options.exclusive ? "wx" : "w" });
}

export function writeText(file: string, text: string, options: { exclusive?: boolean } = {}): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, { encoding: "utf8", flag: options.exclusive ? "wx" : "w" });
}

/** Carpetas de data/raw con nombre de marca de tiempo, ordenadas de la más antigua a la más reciente. */
export function listRawFolders(): string[] {
  if (!existsSync(RAW_DIR)) return [];
  return readdirSync(RAW_DIR)
    .filter((n) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(n) && statSync(path.join(RAW_DIR, n)).isDirectory())
    .sort();
}

export function readRawFolder(folderName: string): { name: string; content: unknown }[] {
  const dir = path.join(RAW_DIR, folderName);
  return readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith(".json"))
    .sort()
    .map((name) => ({ name, content: readJson(path.join(dir, name)) }));
}

export function readReferences(): {
  organizationsRef: OrganizationRefRow[];
  logos: LogoManifestRow[];
  proclamations: ProclamationRow[];
  rules: RulesRef;
  territoryRef: TerritoryRef;
} {
  const csv = <T extends Record<string, string>>(name: string): T[] => {
    const file = path.join(REFERENCE_DIR, name);
    return existsSync(file) ? parseCsv<T>(readFileSync(file, "utf8")) : [];
  };
  return {
    organizationsRef: csv<OrganizationRefRow>("organizaciones.csv"),
    logos: csv<LogoManifestRow>("logos-manifest.csv").filter((l) => l.filename),
    proclamations: csv<ProclamationRow>("proclamaciones-jne.csv"),
    rules: readJson<RulesRef>(path.join(REFERENCE_DIR, "reglas.json")),
    territoryRef: readJson<TerritoryRef>(path.join(REFERENCE_DIR, "territorio-moquegua.json")),
  };
}

export function parseArgs(argv = process.argv.slice(2)): { flags: Set<string>; values: Map<string, string>; positional: string[] } {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) values.set(k!, v);
      else if (argv[i + 1] && !argv[i + 1]!.startsWith("--") && ["raw", "out", "base"].includes(k!)) values.set(k!, argv[++i]!);
      else flags.add(k!);
    } else positional.push(a);
  }
  return { flags, values, positional };
}
