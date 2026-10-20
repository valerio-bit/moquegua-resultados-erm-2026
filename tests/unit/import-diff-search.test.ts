import { describe, expect, it } from "vitest";
import { datasetToResultsCsv, importResultsCsv } from "@/lib/import/results-csv";
import { classifyJson, importJsonFiles } from "@/lib/import/json";
import { compareDatasets } from "@/lib/diff";
import { validateDataset } from "@/lib/validation/validate";
import { buildSearchIndex, searchEntries } from "@/lib/search";
import { cleanCandidateName, slugify, titleCase } from "@/lib/text";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT, clone, loadPublished } from "./helpers";

describe("importación manual (Modo B)", () => {
  it("CSV exportado → importado conserva votos y supera la validación", async () => {
    const base = loadPublished();
    const res = await importResultsCsv(datasetToResultsCsv(base), base, new Date("2026-10-21T00:00:00Z"));
    expect(res.errors).toEqual([]);
    const ds = res.dataset!;
    expect(ds.results).toHaveLength(base.results.length);
    const diff = compareDatasets(base, ds);
    expect(diff.counts.votesChanged).toBe(0);
    expect(diff.counts.statusChanged).toBe(0);
    expect((await validateDataset(ds)).publishable).toBe(true);
  });

  it("rechaza filas sin sourceUrl o con votos inválidos", async () => {
    const base = loadPublished();
    const csv = datasetToResultsCsv(base).split("\n");
    csv[1] = csv[1]!.replace(/https:\/\/resultadoelectoral[^,]+/, "");
    csv[2] = csv[2]!.replace(/,(\d+),(\d+\.?\d*),/, ",-3,$2,");
    const res = await importResultsCsv(csv.join("\n"), base);
    expect(res.dataset).toBeNull();
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("un CSV con votos alterados se importa pero no es publicable", async () => {
    const base = loadPublished();
    const lines = datasetToResultsCsv(base).split("\n");
    const header = lines[0]!.split(",");
    const vi = header.indexOf("votes");
    const cells = lines[1]!.split(",");
    cells[vi] = String(Number(cells[vi]) + 100);
    lines[1] = cells.join(",");
    const res = await importResultsCsv(lines.join("\n"), base);
    expect(res.dataset).not.toBeNull();
    expect((await validateDataset(res.dataset!)).publishable).toBe(false);
  });

  it("clasifica JSON y rechaza respuestas ONPE sueltas sin ámbito", async () => {
    expect(classifyJson({ data: [], success: true })).toBe("onpe-response");
    expect(classifyJson(loadPublished())).toBe("dataset");
    const res = await importJsonFiles([{ name: "suelta.json", content: { data: [], success: true } }], loadPublished());
    expect(res.dataset).toBeNull();
  });

  it("una captura parcial reemplaza solo su ámbito y conserva el resto", async () => {
    const base = loadPublished();
    const capture = JSON.parse(readFileSync(path.join(ROOT, "data", "raw", "2026-10-20_07-47-00", "11-distrital-prov-170300.json"), "utf8"));
    // Simula un corte nuevo con un voto más para un candidato y uno más en válidos y emitidos.
    const c = clone(capture);
    c.capturedAt = "2026-10-21T10:00:00Z";
    const tot = c.captures.find((x: { kind: string; scope: { district: string } }) => x.kind === "totales" && x.scope.district === "170302");
    const part = c.captures.find((x: { kind: string; scope: { district: string } }) => x.kind === "participantes" && x.scope.district === "170302");
    tot.response.data.totalVotosValidos += 1;
    tot.response.data.totalVotosEmitidos += 1;
    tot.response.data.fechaActualizacion = "2026-10-21T09:00:00.000Z";
    part.response.data[0].totalVotosValidos += 1;
    const res = await importJsonFiles([{ name: "corte.json", content: c }], base, new Date("2026-10-21T10:00:00Z"));
    expect(res.errors).toEqual([]);
    const ds = res.dataset!;
    expect(ds.elections).toHaveLength(base.elections.length);
    const diff = compareDatasets(base, ds);
    expect(diff.counts.votesChanged).toBeGreaterThan(0);
    expect(diff.units.map((u) => u.unitId)).toContain("4-170302");
    expect(diff.units.every((u) => u.unitId.startsWith("4-1703"))).toBe(true);
  });
});

describe("comparación de versiones", () => {
  it("detecta cambio de primer lugar y de estado", () => {
    const a = loadPublished();
    const b = clone(a);
    const unit = b.elections.find((e) => e.id === "4-170303")!;
    unit.outcome = { ...unit.outcome, organizationCodes: ["102"] };
    const r = b.results.find((x) => x.unitId === "4-170303" && x.organizationCode === "102")!;
    r.votes += 500;
    r.status = "PRIMER_LUGAR_VIRTUAL";
    const diff = compareDatasets(a, b);
    expect(diff.units.find((u) => u.unitId === "4-170303")?.leaderChanged).toBe(true);
    expect(diff.counts.statusChanged).toBe(1);
    expect(diff.counts.votesChanged).toBe(1);
  });
});

describe("buscador", () => {
  const index = buildSearchIndex(loadPublished());
  it.each(["Jakelin", "Blademir", "Prescilio", "Torata", "Pacocha"])("encuentra «%s»", (q) => {
    const hits = searchEntries(index, q);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.title.toLowerCase()).toContain(q.toLowerCase());
  });
  it("ignora tildes y mayúsculas", () => {
    expect(searchEntries(index, "sanchez cerro").some((h) => h.type === "Provincia")).toBe(true);
    expect(searchEntries(index, "ACCION POPULAR").some((h) => h.type === "Organización")).toBe(true);
  });
});

describe("texto", () => {
  it("slug, mayúsculas y limpieza de nombres", () => {
    expect(slugify("GENERAL SÁNCHEZ CERRO")).toBe("general-sanchez-cerro");
    expect(titleCase("LA CAPILLA")).toBe("La Capilla");
    expect(titleCase("PROVINCIA DE ILO")).toBe("Provincia de Ilo");
    expect(cleanCandidateName("ALEJANDRO JOSE MENDOZA null")).toEqual({ name: "ALEJANDRO JOSE MENDOZA", normalizedFrom: "ALEJANDRO JOSE MENDOZA null" });
    expect(cleanCandidateName("")).toEqual({ name: "" });
  });
});
