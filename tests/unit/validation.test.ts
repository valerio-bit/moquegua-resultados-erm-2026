import { describe, expect, it } from "vitest";
import { validateDataset } from "@/lib/validation/validate";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import type { Dataset } from "@/lib/schemas";
import { clone, loadPublished } from "./helpers";

/** Recalcula el hash tras una modificación para aislar la regla que se prueba. */
async function rehash(ds: Dataset): Promise<Dataset> {
  const results = ds.results.map(({ snapshotHash: h, ...rest }) => {
    void h;
    return rest;
  });
  const hash = await sha256Hex(
    canonicalJson({ territory: ds.territory, organizations: ds.organizations, elections: ds.elections, results, participation: ds.participation }),
  );
  return { ...ds, meta: { ...ds.meta, snapshotHash: hash }, results: results.map((r) => ({ ...r, snapshotHash: hash })) };
}

const failed = (report: Awaited<ReturnType<typeof validateDataset>>, id: string) => report.checks.find((c) => c.id === id)?.passed === false;

describe("validaciones", () => {
  it("el dataset publicado supera todos los controles críticos", async () => {
    const report = await validateDataset(loadPublished());
    expect(report.publishable).toBe(true);
    expect(report.summary.failedCritical).toBe(0);
  });

  it("bloquea la publicación si la suma de candidaturas no cuadra con los válidos", async () => {
    const ds = clone(loadPublished());
    ds.results[0]!.votes += 1;
    const report = await validateDataset(await rehash(ds));
    expect(failed(report, "06-sum-valid")).toBe(true);
    expect(report.publishable).toBe(false);
  });

  it("detecta votos negativos y porcentajes fuera de rango", async () => {
    const ds = clone(loadPublished());
    ds.results[0]!.votes = -5;
    ds.results[1]!.validVotePct = 140;
    const report = await validateDataset(ds);
    expect(report.publishable).toBe(false);
  });

  it("exige sourceUrl y sourceTimestamp en todos los registros", async () => {
    const ds = clone(loadPublished()) as unknown as { results: Record<string, unknown>[] };
    delete ds.results[0]!.sourceUrl;
    delete ds.results[1]!.sourceTimestamp;
    const report = await validateDataset(ds);
    expect(failed(report, "01-source-url")).toBe(true);
    expect(failed(report, "02-source-timestamp")).toBe(true);
    expect(report.publishable).toBe(false);
  });

  it("no acepta PROCLAMADO_JNE_JEE sin fuente del JNE/JEE", async () => {
    const ds = clone(loadPublished());
    const r = ds.results.find((x) => x.unitId.startsWith("3-"))!;
    r.status = "PROCLAMADO_JNE_JEE";
    r.statusSourceUrl = "https://medio-de-prensa.pe/nota";
    const report = await validateDataset(await rehash(ds));
    expect(failed(report, "11-proclamation-source")).toBe(true);
  });

  it("valida la conciliación válidos + blancos + nulos = emitidos", async () => {
    const ds = clone(loadPublished());
    ds.elections[0]!.nullVotes! += 10;
    const report = await validateDataset(await rehash(ds));
    expect(failed(report, "07-cast-reconciliation")).toBe(true);
  });

  it("valida hábiles ≥ votaron y la coherencia de ausentes", async () => {
    const ds = clone(loadPublished());
    const p = ds.participation.find((x) => x.scope === "DISTRICT")!;
    p.votersWhoVoted = p.eligibleVoters + 1;
    const report = await validateDataset(await rehash(ds));
    expect(failed(report, "08-eligible-ge-voted")).toBe(true);
    expect(failed(report, "09-absentees")).toBe(true);
  });

  it("detecta totales territoriales que no cuadran", async () => {
    const ds = clone(loadPublished());
    const p = ds.participation.find((x) => x.scope === "DISTRICT")!;
    p.eligibleVoters += 7;
    p.absentees += 7;
    p.turnoutPct = Math.round((p.votersWhoVoted / p.eligibleVoters) * 100000) / 1000;
    p.absenteePct = Math.round((p.absentees / p.eligibleVoters) * 100000) / 1000;
    const report = await validateDataset(await rehash(ds));
    expect(failed(report, "12-publish-gate")).toBe(true);
    expect(report.publishable).toBe(false);
  });

  it("detecta un hash alterado", async () => {
    const ds = clone(loadPublished());
    ds.results[3]!.candidateName = "OTRO NOMBRE";
    const report = await validateDataset(ds);
    expect(failed(report, "snapshot-hash")).toBe(true);
  });

  it("no permite segunda vuelta fuera del gobierno regional", async () => {
    const ds = clone(loadPublished());
    const r = ds.results.find((x) => x.unitId.startsWith("4-") && x.rank === 2)!;
    r.status = "SEGUNDA_VUELTA";
    const report = await validateDataset(await rehash(ds));
    expect(failed(report, "status-rules")).toBe(true);
  });
});
