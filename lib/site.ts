/** Configuración pública del sitio. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.github.io/moquegua-resultados-erm-2026").replace(/\/$/, "");
export const SITE_NAME = "Resultados Electorales 2026 — Moquegua";
export const SOURCE_LINE = "Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE)";

/** Prefija rutas de archivos estáticos con la ruta base (GitHub Pages sirve en /<repo>/). */
export function asset(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

/** URL absoluta para sitemap, Open Graph y canonical. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/gobierno-regional/", label: "Gobierno Regional" },
  { href: "/provincias/", label: "Provincias" },
  { href: "/distritos/", label: "Distritos" },
  { href: "/partidos/", label: "Partidos" },
  { href: "/participacion/", label: "Participación y ausentismo" },
  { href: "/fuentes-y-metodologia/", label: "Fuentes y metodología" },
  { href: "/actualizar/", label: "Actualizar / Publicar" },
] as const;
