import Papa from "papaparse";

/** Lee un CSV con encabezados (RFC 4180, comillas y comas internas). */
export function parseCsv<T extends Record<string, string>>(text: string): T[] {
  const result = Papa.parse<T>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV inválido (fila ${first?.row ?? "?"}): ${first?.message ?? "error"}`);
  }
  return result.data;
}

/** Escribe CSV con encabezados en el orden indicado. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return Papa.unparse(
    rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? ""]))),
    { columns, newline: "\n" },
  );
}

export interface OrganizationRefRow extends Record<string, string> {
  code: string;
  onpe_name: string;
  display_name: string;
  short_name: string;
  note: string;
}

export const LOGO_MANIFEST_COLUMNS = [
  "organization_name",
  "organization_code",
  "filename",
  "source_url",
  "source_kind",
  "downloaded_at",
  "sha256",
  "format",
  "license_or_usage_note",
  "verified",
] as const;

export interface LogoManifestRow extends Record<string, string> {
  organization_name: string;
  organization_code: string;
  filename: string;
  source_url: string;
  source_kind: string;
  downloaded_at: string;
  sha256: string;
  format: string;
  license_or_usage_note: string;
  verified: string;
}

export interface ProclamationRow extends Record<string, string> {
  election_id: string;
  ubigeo: string;
  organization_code: string;
  candidate_name: string;
  resolution: string;
  resolution_date: string;
  source_url: string;
  checked_at: string;
}
