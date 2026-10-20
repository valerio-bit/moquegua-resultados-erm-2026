import type { MetadataRoute } from "next";
import { getDataset, getDistricts, getOrganizations, getProvinces } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(getDataset().meta.sourceTimestampMax);
  const paths = [
    "/",
    "/gobierno-regional/",
    "/provincias/",
    "/distritos/",
    "/partidos/",
    "/explorar/",
    "/participacion/",
    "/fuentes-y-metodologia/",
    "/buscar/",
    ...getProvinces().map((p) => `/provincias/${p.slug}/`),
    ...getDistricts().map(({ district }) => `/distritos/${district.slug}/`),
    ...getOrganizations().map((o) => `/partidos/${o.slug}/`),
  ];
  return paths.map((p) => ({ url: absoluteUrl(p), lastModified, changeFrequency: "daily", priority: p === "/" ? 1 : 0.7 }));
}
