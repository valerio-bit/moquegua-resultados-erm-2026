import { normalizeForSearch, titleCase } from "@/lib/text";
import type { Dataset } from "@/lib/schemas";

export interface SearchEntry {
  type: "Candidatura" | "Provincia" | "Distrito" | "Organización";
  title: string;
  subtitle: string;
  href: string;
  haystack: string;
}

/** Índice de búsqueda por candidato, partido, provincia y distrito (se genera en build). */
export function buildSearchIndex(ds: Dataset): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const org = new Map(ds.organizations.map((o) => [o.code, o]));
  const districtSlug = new Map(ds.territory.provinces.flatMap((p) => p.districts.map((d) => [d.ubigeo, d.slug] as const)));
  const provinceSlug = new Map(ds.territory.provinces.map((p) => [p.ubigeo, p.slug] as const));

  for (const p of ds.territory.provinces) {
    entries.push({
      type: "Provincia",
      title: p.displayName,
      subtitle: `Provincia de la región Moquegua · ${p.districts.length} distritos`,
      href: `/provincias/${p.slug}/`,
      haystack: normalizeForSearch(`${p.name} provincia ${p.displayName}`),
    });
    for (const d of p.districts) {
      entries.push({
        type: "Distrito",
        title: d.displayName,
        subtitle: `Distrito de la provincia ${p.displayName}${d.hasDistrictElection ? "" : " (capital provincial)"}`,
        href: `/distritos/${d.slug}/`,
        haystack: normalizeForSearch(`${d.name} distrito ${p.name}`),
      });
    }
  }
  for (const o of ds.organizations) {
    entries.push({
      type: "Organización",
      title: o.displayName,
      subtitle: `${ds.results.filter((r) => r.organizationCode === o.code).length} candidaturas en Moquegua`,
      href: `/partidos/${o.slug}/`,
      haystack: normalizeForSearch(`${o.name} ${o.displayName} ${o.shortName ?? ""}`),
    });
    entries.push({
      type: "Organización",
      title: `${o.displayName}: desglose por provincia`,
      subtitle: "Dónde compite, quién gana, votos y clasificación de votantes",
      href: `/explorar/?partido=${o.slug}`,
      haystack: normalizeForSearch(`${o.name} ${o.displayName} ${o.shortName ?? ""} explorar desglose provincia distritos`),
    });
  }
  for (const r of ds.results) {
    if (!r.candidateName) continue;
    const place = r.electionId === 1 ? "Región Moquegua" : r.electionId === 4 ? `Distrito ${r.district}` : `Provincia ${r.province}`;
    const href =
      r.electionId === 1
        ? "/gobierno-regional/"
        : r.electionId === 4
          ? `/distritos/${districtSlug.get(r.ubigeo)}/`
          : `/provincias/${provinceSlug.get(r.ubigeo)}/`;
    const o = org.get(r.organizationCode);
    entries.push({
      type: "Candidatura",
      title: titleCase(r.candidateName),
      subtitle: `${r.electionName} · ${place} · ${o?.shortName ?? o?.displayName ?? r.organizationName}`,
      href,
      haystack: normalizeForSearch(`${r.candidateName} ${r.organizationName} ${o?.shortName ?? ""} ${place} ${r.province ?? ""} ${r.district ?? ""}`),
    });
  }
  return entries;
}

/** Busca todas las palabras (sin tildes, sin mayúsculas). Prioriza coincidencias al inicio de palabra. */
export function searchEntries(index: SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const terms = normalizeForSearch(query).split(" ").filter((t) => t.length >= 2);
  if (terms.length === 0) return [];
  const typeWeight: Record<SearchEntry["type"], number> = { Distrito: 0, Provincia: 0, Organización: 1, Candidatura: 2 };
  return index
    .map((e) => {
      if (!terms.every((t) => e.haystack.includes(t))) return null;
      const titleNorm = normalizeForSearch(e.title);
      const starts = terms.filter((t) => titleNorm.split(" ").some((w) => w.startsWith(t))).length;
      return { e, score: starts * 10 - typeWeight[e.type] };
    })
    .filter((x): x is { e: SearchEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title, "es"))
    .slice(0, limit)
    .map((x) => x.e);
}
