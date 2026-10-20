import datasetJson from "@/data/processed/dataset.json";
import {
  DatasetSchema,
  type Dataset,
  type DistrictRef,
  type ElectionResult,
  type ElectionUnit,
  type Organization,
  type Participation,
  type ProvinceRef,
} from "@/lib/schemas";

let cached: Dataset | null = null;

/** Dataset publicado (validado con Zod en build; si no cumple el esquema, el build falla). */
export function getDataset(): Dataset {
  if (!cached) cached = DatasetSchema.parse(datasetJson);
  return cached;
}

export interface UnitWithResults {
  unit: ElectionUnit;
  results: ElectionResult[];
}

export function getUnit(id: string): UnitWithResults | null {
  const ds = getDataset();
  const unit = ds.elections.find((e) => e.id === id);
  if (!unit) return null;
  return { unit, results: ds.results.filter((r) => r.unitId === id).sort((a, b) => a.rank - b.rank || b.votes - a.votes) };
}

export const governorUnitId = () => `1-${getDataset().meta.departmentUbigeo}`;
export const getGovernor = () => getUnit(governorUnitId())!;
export const getCouncil = (provinceUbigeo: string) => getUnit(`2-${provinceUbigeo}`);
export const getProvincial = (provinceUbigeo: string) => getUnit(`3-${provinceUbigeo}`);
export const getDistrictElection = (districtUbigeo: string) => getUnit(`4-${districtUbigeo}`);

export function getProvinces(): ProvinceRef[] {
  return getDataset().territory.provinces;
}

/** Orden de presentación: Mariscal Nieto, General Sánchez Cerro, Ilo (orden de ubigeo ONPE). */
export function getProvinceBySlug(slug: string): ProvinceRef | undefined {
  return getProvinces().find((p) => p.slug === slug);
}

export function getDistricts(): { district: DistrictRef; province: ProvinceRef }[] {
  return getProvinces().flatMap((p) => p.districts.map((d) => ({ district: d, province: p })));
}

export function getDistrictBySlug(slug: string): { district: DistrictRef; province: ProvinceRef } | undefined {
  return getDistricts().find((x) => x.district.slug === slug);
}

export function getParticipation(ubigeo: string): Participation | undefined {
  return getDataset().participation.find((p) => p.ubigeo === ubigeo);
}

export function getOrganizations(): Organization[] {
  return getDataset().organizations;
}

export function getOrganization(code: string): Organization | undefined {
  return getDataset().organizations.find((o) => o.code === code);
}

export function getOrganizationBySlug(slug: string): Organization | undefined {
  return getDataset().organizations.find((o) => o.slug === slug);
}

export function orgMap(): Map<string, Organization> {
  return new Map(getDataset().organizations.map((o) => [o.code, o]));
}

/** Primer lugar del cómputo (puede haber empate). No equivale a autoridad electa. */
export function leaders(results: ElectionResult[]): ElectionResult[] {
  return results.filter((r) => r.isLeading);
}

export interface PartyStats {
  org: Organization;
  candidacies: ElectionResult[];
  provincialLeads: ElectionResult[];
  districtLeads: ElectionResult[];
  jurisdictions: number;
  governor: ElectionResult | undefined;
  councilVotes: { result: ElectionResult; provinceUbigeo: string }[];
  votesByElection: { electionId: number; electionName: string; circunscriptions: number; votes: number }[];
}

export function getPartyStats(): PartyStats[] {
  const ds = getDataset();
  return ds.organizations
    .map((org) => {
      const candidacies = ds.results.filter((r) => r.organizationCode === org.code);
      const byElection = new Map<number, ElectionResult[]>();
      for (const r of candidacies) byElection.set(r.electionId, [...(byElection.get(r.electionId) ?? []), r]);
      return {
        org,
        candidacies,
        provincialLeads: candidacies.filter((r) => r.electionId === 3 && r.isLeading),
        districtLeads: candidacies.filter((r) => r.electionId === 4 && r.isLeading),
        jurisdictions: new Set(candidacies.map((r) => r.ubigeo)).size,
        governor: candidacies.find((r) => r.electionId === 1),
        councilVotes: candidacies
          .filter((r) => r.electionId === 2)
          .map((r) => ({ result: r, provinceUbigeo: r.ubigeo })),
        votesByElection: [1, 2, 3, 4]
          .filter((id) => byElection.has(id))
          .map((id) => ({
            electionId: id,
            electionName: byElection.get(id)![0]!.electionName,
            circunscriptions: byElection.get(id)!.length,
            votes: byElection.get(id)!.reduce((a, r) => a + r.votes, 0),
          })),
      };
    })
    .sort(
      (a, b) =>
        b.provincialLeads.length - a.provincialLeads.length ||
        b.districtLeads.length - a.districtLeads.length ||
        (b.governor?.votes ?? 0) - (a.governor?.votes ?? 0) ||
        a.org.displayName.localeCompare(b.org.displayName, "es"),
    );
}

/** Ámbito legible de un resultado: "Región Moquegua", "Provincia de Ilo", "Distrito de Torata". */
export function jurisdictionLabel(r: Pick<ElectionResult, "electionId" | "province" | "district">): string {
  if (r.electionId === 1) return "Región Moquegua";
  if (r.electionId === 4) return `Distrito de ${r.district}`;
  return `Provincia de ${r.province}`;
}

export function jurisdictionHref(r: Pick<ElectionResult, "electionId" | "ubigeo">): string {
  if (r.electionId === 1) return "/gobierno-regional/";
  const ds = getDataset();
  if (r.electionId === 4) {
    const d = ds.territory.provinces.flatMap((p) => p.districts).find((x) => x.ubigeo === r.ubigeo);
    return d ? `/distritos/${d.slug}/` : "/distritos/";
  }
  const p = ds.territory.provinces.find((x) => x.ubigeo === r.ubigeo);
  return p ? `/provincias/${p.slug}/` : "/provincias/";
}
