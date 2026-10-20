import type { Dataset } from "@/lib/schemas";
import { canonicalJson, sha256Hex } from "@/lib/hash";

/**
 * Fusiona una importación parcial con la versión base: los ámbitos importados reemplazan
 * a los de la base (más reciente gana) y el resto se conserva con su propio corte.
 */
export async function mergeIntoBase(base: Dataset, partial: Dataset): Promise<{ dataset: Dataset; replacedUnits: string[]; keptUnits: number }> {
  const importedUnits = new Set(partial.elections.map((e) => e.id));
  const elections = [
    ...base.elections.filter((e) => !importedUnits.has(e.id)),
    ...partial.elections,
  ].sort((a, b) => `${a.electionId}-${a.ubigeo}`.localeCompare(`${b.electionId}-${b.ubigeo}`));
  const draft = [
    ...base.results.filter((r) => !importedUnits.has(r.unitId)),
    ...partial.results,
  ]
    .map(({ snapshotHash: h, ...rest }) => {
      void h;
      return rest;
    })
    .sort(
      (a, b) =>
        `${a.electionId}-${a.ubigeo}`.localeCompare(`${b.electionId}-${b.ubigeo}`) ||
        a.rank - b.rank ||
        a.organizationCode.localeCompare(b.organizationCode),
    );
  const importedPart = new Set(partial.participation.map((p) => p.ubigeo));
  const participation = [
    ...base.participation.filter((p) => !importedPart.has(p.ubigeo)),
    ...partial.participation,
  ].sort((a, b) => a.ubigeo.localeCompare(b.ubigeo));
  const orgCodes = new Set(draft.map((r) => r.organizationCode));
  const orgMap = new Map([...base.organizations, ...partial.organizations].map((o) => [o.code, o]));
  const organizations = [...orgCodes]
    .map((c) => orgMap.get(c)!)
    .filter(Boolean)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  const territory = base.territory;
  const snapshotHash = await sha256Hex(canonicalJson({ territory, organizations, elections, results: draft, participation }));
  const stamps = [...elections.map((e) => e.sourceTimestamp), ...participation.map((p) => p.sourceTimestamp)].sort(
    (a, b) => Date.parse(a) - Date.parse(b),
  );
  return {
    dataset: {
      ...partial,
      meta: {
        ...partial.meta,
        captureMethods: [...new Set([...base.meta.captureMethods, ...partial.meta.captureMethods])].sort(),
        sourceTimestampMin: stamps[0]!,
        sourceTimestampMax: stamps.at(-1)!,
        snapshotHash,
        notes: base.meta.notes,
      },
      territory,
      organizations,
      elections,
      results: draft.map((r) => ({ ...r, snapshotHash })),
      participation,
    },
    replacedUnits: [...importedUnits],
    keptUnits: elections.length - importedUnits.size,
  };
}
