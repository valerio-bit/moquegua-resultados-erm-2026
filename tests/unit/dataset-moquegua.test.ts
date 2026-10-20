/**
 * Verifica la transformación de las capturas reales de ONPE (data/raw) en el dataset.
 * Las cifras esperadas corresponden al corte del 20/10/2026; si se publica un corte
 * nuevo, estas pruebas indican explícitamente qué cambió.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { buildDataset } from "@/lib/transforms/build-dataset";
import { validateDataset } from "@/lib/validation/validate";
import { parseCsv } from "@/lib/csv";
import { ROOT } from "./helpers";

const RAW = "2026-10-20_07-47-00";

async function build() {
  const dir = path.join(ROOT, "data", "raw", RAW);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((name) => ({ name, content: JSON.parse(readFileSync(path.join(dir, name), "utf8")) as unknown }));
  const ref = (f: string) => path.join(ROOT, "data", "reference", f);
  return buildDataset({
    rawFolder: RAW,
    files,
    organizationsRef: parseCsv(readFileSync(ref("organizaciones.csv"), "utf8")),
    logos: [],
    proclamations: [],
    rules: JSON.parse(readFileSync(ref("reglas.json"), "utf8")),
    territoryRef: JSON.parse(readFileSync(ref("territorio-moquegua.json"), "utf8")),
    generatedAt: "2026-10-20T14:00:00.000Z",
    snapshotId: "test",
  });
}

describe("dataset de Moquegua desde capturas ONPE", () => {
  it("identifica MOQUEGUA con el código que usa ONPE y recorre su jerarquía", async () => {
    const { dataset, issues } = await build();
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(dataset.territory.department.ubigeo).toBe("170000");
    expect(dataset.territory.provinces.map((p) => p.displayName)).toEqual(["Mariscal Nieto", "General Sánchez Cerro", "Ilo"]);
    expect(dataset.territory.provinces.flatMap((p) => p.districts)).toHaveLength(21);
  });

  it("cubre todas las elecciones sin duplicar capitales provinciales", async () => {
    const { dataset } = await build();
    const count = (id: number) => dataset.elections.filter((e) => e.electionId === id).length;
    expect(count(1)).toBe(1);
    expect(count(2)).toBe(3);
    expect(count(3)).toBe(3);
    expect(count(4)).toBe(18);
    for (const capital of ["170101", "170201", "170301"]) {
      expect(dataset.elections.some((e) => e.electionId === 4 && e.ubigeo === capital)).toBe(false);
    }
    expect(dataset.results).toHaveLength(164);
    expect(dataset.participation).toHaveLength(25);
  });

  it("gobernador: 11 fórmulas, cuadra con emitidos y va a segunda vuelta", async () => {
    const { dataset } = await build();
    const gov = dataset.elections.find((e) => e.electionId === 1)!;
    const rows = dataset.results.filter((r) => r.unitId === gov.id);
    expect(rows).toHaveLength(11);
    expect(gov.validVotes + gov.blankVotes! + gov.nullVotes!).toBe(gov.votesCast);
    expect(gov.outcome.kind).toBe("SEGUNDA_VUELTA");
    expect(rows.filter((r) => r.status === "SEGUNDA_VUELTA").map((r) => r.organizationCode).sort()).toEqual(["93", "94"]);
    expect(rows.some((r) => r.status === "PROCLAMADO_JNE_JEE")).toBe(false);
  });

  it("deja como provisionales los ámbitos con actas en el JEE", async () => {
    const { dataset } = await build();
    const samegua = dataset.elections.find((e) => e.id === "4-170106")!;
    const ilo = dataset.elections.find((e) => e.id === "3-170300")!;
    expect(samegua.countComplete).toBe(false);
    expect(samegua.outcome.kind).toBe("EN_COMPUTO");
    expect(ilo.jeeActs).toBe(1);
    expect(dataset.results.filter((r) => r.unitId === "3-170300" && r.status !== "COMPUTO_ONPE")).toEqual([]);
  });

  it("limpia el texto 'null' de los nombres y conserva el original", async () => {
    const { dataset } = await build();
    const r = dataset.results.find((x) => x.nameNormalizedFrom === "RICHARD GUILLERMO REVOLLAR null")!;
    expect(r.candidateName).toBe("RICHARD GUILLERMO REVOLLAR");
  });

  it("el hash es determinista y el resultado supera la validación", async () => {
    const a = await build();
    const b = await build();
    expect(a.dataset.meta.snapshotHash).toBe(b.dataset.meta.snapshotHash);
    const report = await validateDataset(a.dataset);
    expect(report.publishable).toBe(true);
  });
});
