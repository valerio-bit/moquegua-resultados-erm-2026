/** Utilidades de texto independientes del entorno (Node y navegador). */

const SMALL_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "en", "por", "para", "a"]);

/** Quita tildes y diacríticos ("SÁNCHEZ" -> "SANCHEZ"). */
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normaliza para búsquedas: minúsculas, sin tildes, espacios simples. */
export function normalizeForSearch(value: string): string {
  return stripAccents(value).toLowerCase().replace(/[^a-z0-9ñ\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** "GENERAL SÁNCHEZ CERRO" -> "general-sanchez-cerro" */
export function slugify(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "LA CAPILLA" -> "La Capilla"; "MARISCAL NIETO" -> "Mariscal Nieto". Conserva tildes. */
export function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("es-PE")
    .split(/(\s+|-)/)
    .map((word, index) => {
      if (!word.trim() || word === "-") return word;
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("es-PE") + word.slice(1);
    })
    .join("");
}

/**
 * Algunos nombres llegan de ONPE con el texto literal "null" en lugar de un apellido.
 * Se elimina ese token para mostrar el nombre y se conserva el original para trazabilidad.
 */
export function cleanCandidateName(raw: string | null | undefined): { name: string; normalizedFrom?: string } {
  const value = (raw ?? "").trim();
  if (!value) return { name: "" };
  const cleaned = value
    .split(/\s+/)
    .filter((token) => token.toLowerCase() !== "null")
    .join(" ");
  return cleaned === value ? { name: value } : { name: cleaned, normalizedFrom: value };
}
