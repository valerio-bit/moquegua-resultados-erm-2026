/**
 * Rutas de los servicios públicos que usa la propia plataforma de resultados de ONPE
 * (observadas en https://resultadoelectoral.onpe.gob.pe el 20/10/2026).
 */
import type { ElectionId } from "@/lib/schemas";

export const ONPE_SITE = "https://resultadoelectoral.onpe.gob.pe";
export const DEFAULT_BASE = `${ONPE_SITE}/presentacion-backend`;
export const UBIGEO_CATALOG = `${ONPE_SITE}/assets/ubig/v1.json`;

export interface Scope {
  department: string;
  province?: string;
  district?: string;
}

export const level = (s: Scope) => (s.district ? "ubigeo_nivel_03" : s.province ? "ubigeo_nivel_02" : "ubigeo_nivel_01");

const UBIC_PATH: Record<ElectionId, string> = {
  1: "eleccion-gobernador-vicegobernador",
  2: "eleccion-consejero",
  3: "eleccion-provincial",
  4: "eleccion-distrital",
};

export function endpoints(base = DEFAULT_BASE) {
  return {
    activeProcess: () => `${base}/proceso/proceso-electoral-activo`,
    elections: (processId: number) => `${base}/proceso/${processId}/elecciones`,
    /** Rutas documentadas; su esquema no pudo verificarse (WAF). Se intenta antes del catálogo estático. */
    departments: (electionId: ElectionId) => `${base}/ubigeos/departamentos?idEleccion=${electionId}&idAmbitoGeografico=1`,
    provinces: (electionId: ElectionId, dep: string) =>
      `${base}/ubigeos/provincias?idEleccion=${electionId}&idAmbitoGeografico=1&idUbigeoDepartamento=${dep}`,
    districts: (electionId: ElectionId, prov: string) =>
      `${base}/ubigeos/distritos?idEleccion=${electionId}&idAmbitoGeografico=1&idUbigeoProvincia=${prov}`,
    totals: (electionId: ElectionId, s: Scope) => {
      let u = `${base}/resumen-general/totales?idEleccion=${electionId}&tipoFiltro=${level(s)}&idAmbitoGeografico=1&idUbigeoDepartamento=${s.department}`;
      if (s.province) u += `&idUbigeoProvincia=${s.province}`;
      if (s.district) u += `&idUbigeoDistrito=${s.district}`;
      return u;
    },
    candidates: (electionId: ElectionId, s: Scope) => {
      let u = `${base}/resumen-general/participantes?idEleccion=${electionId}&tipoFiltro=${level(s)}&idAmbitoGeografico=1&idUbigeoDepartamento=${s.department}`;
      if (s.province) u += `&idUbigeoProvincia=${s.province}`;
      if (s.district) u += `&idUbigeoDistrito=${s.district}`;
      return u;
    },
    blankNull: (electionId: ElectionId, s: Scope) => {
      let u = `${base}/${UBIC_PATH[electionId]}/participantes-ubicacion-geografica-nombre?idEleccion=${electionId}&idAmbitoGeografico=1&tipoFiltro=${level(s)}&ubigeoNivel1=${s.department}`;
      if (s.province) u += `&ubigeoNivel2=${s.province}`;
      if (s.district) u += `&ubigeoNivel3=${s.district}`;
      return u;
    },
    participation: (s: Scope) => {
      let u = `${base}/participacion-ciudadana/totales?idAmbitoGeografico=1&tipoFiltro=${level(s)}&ubigeoNivel01=${s.department}`;
      if (s.province) u += `&ubigeoNivel02=${s.province}`;
      if (s.district) u += `&ubigeoNivel03=${s.district}`;
      return u;
    },
    observedActs: () => `${base}/actas/observadas`,
    act: (id: string) => `${base}/actas/${encodeURIComponent(id)}`,
  };
}
