import type { Dataset } from "@/lib/schemas";
import { round } from "@/lib/format";

/** Fila del explorador: una elección en un ámbito, con votantes y todas sus candidaturas. */
export interface ExplorerRow {
  unitId: string;
  electionId: number;
  electionName: string;
  provinceSlug: string | null;
  provinceName: string;
  jurisdiction: string;
  href: string;
  eligible: number | null;
  votesCast: number;
  valid: number;
  blank: number | null;
  nul: number | null;
  absentees: number | null;
  pending: number;
  turnoutPct: number | null;
  countedActsPct: number;
  countComplete: boolean;
  outcomeKind: string;
  candidates: {
    org: string;
    candidate: string;
    votes: number;
    validPct: number;
    eligiblePct: number | null;
    rank: number;
    status: string;
    leading: boolean;
  }[];
}

export interface ExplorerOrg {
  code: string;
  slug: string;
  name: string;
  shortName?: string;
  logo?: string;
}

export interface ExplorerData {
  rows: ExplorerRow[];
  orgs: ExplorerOrg[];
  provinces: { slug: string; name: string }[];
}

/**
 * Datos compactos para el filtro por partido y territorio. "% de hábiles" es un cálculo
 * propio (votos ÷ electores hábiles del ámbito); el porcentaje oficial de ONPE es sobre válidos.
 */
export function buildExplorerData(ds: Dataset): ExplorerData {
  const part = new Map(ds.participation.map((p) => [p.ubigeo, p]));
  const provinceBy = new Map(ds.territory.provinces.map((p) => [p.ubigeo, p]));
  const districtBy = new Map(ds.territory.provinces.flatMap((p) => p.districts.map((d) => [d.ubigeo, { d, p }] as const)));
  const rows: ExplorerRow[] = ds.elections.map((e) => {
    const p = part.get(e.ubigeo);
    const dist = districtBy.get(e.ubigeo);
    const prov = e.electionId === 1 ? undefined : (provinceBy.get(e.ubigeo) ?? dist?.p);
    const jurisdiction = e.electionId === 1 ? "Región Moquegua" : e.electionId === 4 ? (dist?.d.displayName ?? e.ubigeo) : `Provincia ${prov?.displayName ?? ""}`;
    const href = e.electionId === 1 ? "/gobierno-regional/" : e.electionId === 4 ? `/distritos/${dist?.d.slug}/` : `/provincias/${prov?.slug}/`;
    const eligible = e.eligibleVoters;
    return {
      unitId: e.id,
      electionId: e.electionId,
      electionName: e.electionName,
      provinceSlug: prov?.slug ?? null,
      provinceName: prov?.displayName ?? "Región Moquegua",
      jurisdiction,
      href,
      eligible,
      votesCast: e.votesCast,
      valid: e.validVotes,
      blank: e.blankVotes,
      nul: e.nullVotes,
      absentees: p?.absentees ?? null,
      pending: p?.pendingVoters ?? 0,
      turnoutPct: p?.turnoutPct ?? null,
      countedActsPct: e.countedActsPct,
      countComplete: e.countComplete,
      outcomeKind: e.outcome.kind,
      candidates: ds.results
        .filter((r) => r.unitId === e.id)
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({
          org: r.organizationCode,
          candidate: r.candidateName,
          votes: r.votes,
          validPct: r.validVotePct,
          eligiblePct: eligible ? round((r.votes / eligible) * 100) : null,
          rank: r.rank,
          status: r.status === "COMPUTO_ONPE" && r.isLeading && !e.countComplete ? "PARCIAL" : r.status,
          leading: r.isLeading,
        })),
    };
  });
  return {
    rows,
    orgs: ds.organizations.map((o) => ({ code: o.code, slug: o.slug, name: o.displayName, shortName: o.shortName, logo: o.logo?.file })),
    provinces: ds.territory.provinces.map((p) => ({ slug: p.slug, name: p.displayName })),
  };
}
