import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PartyLogo } from "@/components/PartyLogo";
import { STATUS_LEGEND, StatusBadge } from "@/components/StatusBadge";
import { getDataset } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { SOURCE_LINE, asset } from "@/lib/site";
import report from "@/reports/validation-report.json";

export const metadata: Metadata = {
  title: "Fuentes y metodología",
  description:
    "De dónde salen los datos de este sitio: servicios públicos de ONPE, método de captura, validaciones, procedencia de los logos y limitaciones.",
  alternates: { canonical: "/fuentes-y-metodologia/" },
};

const SERVICES = [
  ["resumen-general/totales", "Actas contabilizadas, enviadas al JEE y pendientes; votos emitidos y válidos; fecha de actualización."],
  ["resumen-general/participantes", "Votos y porcentajes por organización con el nombre del candidato."],
  ["…/participantes-ubicacion-geografica-nombre", "Mismo detalle con votos en blanco (código 80) y nulos (código 81)."],
  ["participacion-ciudadana/totales", "Electores hábiles, asistentes y ausentes por región, provincia y distrito."],
  ["assets/ubig/v1.json", "Catálogo de ubigeos de ONPE: MOQUEGUA = 170000 y su jerarquía de provincias y distritos."],
  ["assets/img-reales/partidos/{código}.png", "Símbolos de las organizaciones usados por la interfaz de ONPE."],
];

export default function FuentesPage() {
  const ds = getDataset();
  const { meta } = ds;
  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Fuentes y metodología" }]} />
        <h1 className="m-0 text-4xl">Fuentes y metodología</h1>
        <p className="prose-note mt-3 text-lg">{SOURCE_LINE}.</p>
        <p className="prose-note mt-2 text-ink-soft">
          Este sitio es una visualización independiente. No es un portal de ONPE, del JNE ni de otra entidad pública, y no usa sus
          logotipos institucionales.
        </p>
      </div>

      <section aria-labelledby="origen" className="space-y-3">
        <h2 id="origen" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Origen de los datos
        </h2>
        <p className="prose-note m-0">
          Todos los votos, porcentajes, actas y cifras de participación provienen directamente de los servicios públicos que usa la
          plataforma <a href={meta.sourceHome}>resultadoelectoral.onpe.gob.pe</a> para el proceso {meta.processName} (id {meta.processId},
          elección del 4 de octubre de 2026).
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <caption>Servicios de ONPE utilizados (base: /presentacion-backend, salvo los recursos estáticos).</caption>
            <thead>
              <tr>
                <th scope="col">Servicio</th>
                <th scope="col">Qué aporta</th>
              </tr>
            </thead>
            <tbody>
              {SERVICES.map(([s, d]) => (
                <tr key={s}>
                  <th scope="row" className="font-mono text-xs font-normal">
                    {s}
                  </th>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="prose-note m-0">
          Tipos de elección: 1 gobernador regional, 2 consejo regional, 3 alcaldía provincial, 4 alcaldía distrital. Filtros: nivel 01
          región, 02 provincia, 03 distrito, ámbito geográfico 1 (Perú).
        </p>
      </section>

      <section aria-labelledby="captura" className="space-y-3">
        <h2 id="captura" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Cómo se capturaron
        </h2>
        <p className="prose-note m-0">
          ONPE bloquea las consultas automáticas con un firewall (AWS WAF). No lo saltamos: abrimos el portal en un navegador, como
          cualquier persona, y guardamos los datos que la propia página carga. Cada dato guarda su enlace, la hora en que lo copiamos y
          la hora del conteo de ONPE. Después revisamos que todas las sumas cuadren.
        </p>
        <dl className="m-0 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-soft">Método</dt>
            <dd className="m-0">{meta.captureMethods.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Carpeta de capturas</dt>
            <dd className="m-0 font-mono">data/raw/{meta.rawFolder}/</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Corte ONPE más antiguo incluido</dt>
            <dd className="m-0">{formatDateTime(meta.sourceTimestampMin)}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Corte ONPE más reciente incluido</dt>
            <dd className="m-0">{formatDateTime(meta.sourceTimestampMax)}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Snapshot</dt>
            <dd className="m-0 font-mono">{meta.snapshotId}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">SHA-256 del contenido</dt>
            <dd className="m-0 break-all font-mono text-xs">{meta.snapshotHash}</dd>
          </div>
        </dl>
        <p className="prose-note m-0 text-sm text-ink-soft">
          Cada elección conserva su propia hora de corte: si ONPE actualiza un ámbito, se prioriza el dato más reciente y los cortes
          anteriores quedan guardados en data/raw y data/snapshots.
        </p>
      </section>

      <section aria-labelledby="estados" className="space-y-3">
        <h2 id="estados" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Estados de cada candidatura
        </h2>
        <ul className="m-0 list-none space-y-3 p-0">
          {STATUS_LEGEND.map((s) => (
            <li key={s.key} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <span>
                <StatusBadge status={s.key} />
              </span>
              <span>{s.description}</span>
            </li>
          ))}
        </ul>
        <p className="prose-note m-0">
          Regla de segunda vuelta regional: {meta.secondRoundRule.thresholdPct} % de votos válidos. Fecha de la segunda elección:
          {new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(`${meta.secondRoundRule.electionDate}T00:00:00Z`),
          )}
          . Fuente: <a href={meta.secondRoundRule.sourceUrl}>{meta.secondRoundRule.sourceTitle}</a>. Ninguna
          candidatura figura como proclamada: no se registró ninguna resolución verificable del JNE/JEE.
        </p>
      </section>

      <section aria-labelledby="validacion" className="space-y-3">
        <h2 id="validacion" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Validaciones
        </h2>
        <p className="m-0">
          {report.summary.passed} de {report.summary.checks} controles superados; críticos fallidos: {report.summary.failedCritical}.
          Versión publicable: {report.publishable ? "sí" : "no"}. Validado el {formatDateTime(report.generatedAt)}.
        </p>
        <ul className="m-0 grid list-none gap-1 p-0 text-sm sm:grid-cols-2">
          {report.checks.map((c) => (
            <li key={c.id}>
              <span aria-hidden="true">{c.passed ? "✔" : "✖"}</span> {c.title}{" "}
              <span className="text-ink-faint">({c.checkedItems})</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          <a href={asset("/datos/validation-report.json")}>Descargar el informe de validación</a>
        </p>
      </section>

      <section aria-labelledby="logos" className="space-y-3">
        <h2 id="logos" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Símbolos de las organizaciones
        </h2>
        <p className="prose-note m-0">
          Prioridad de fuentes: 1) JNE (el buscador de símbolos del JNE exige CAPTCHA, por lo que no se automatizó); 2) sitio oficial de
          la organización; 3) activo público de la interfaz de ONPE. Los archivos se guardan sin modificaciones, con su SHA-256. Si no
          hay un activo verificable se muestra un rótulo tipográfico.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <caption>Procedencia de cada símbolo (data/reference/logos-manifest.csv).</caption>
            <thead>
              <tr>
                <th scope="col">Organización</th>
                <th scope="col">Fuente</th>
                <th scope="col">Verificado</th>
                <th scope="col">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {ds.organizations.map((o) => (
                <tr key={o.code}>
                  <th scope="row" className="font-normal">
                    <span className="flex items-center gap-2">
                      <PartyLogo org={o} size={24} />
                      {o.displayName}
                    </span>
                  </th>
                  <td className="text-sm">{o.logo ? <a href={o.logo.sourceUrl}>{o.logo.sourceKind === "onpe-interface" ? "Interfaz ONPE" : o.logo.sourceKind}</a> : "—"}</td>
                  <td>{o.logo?.verified ? "Sí" : "No"}</td>
                  <td className="font-mono text-xs">{o.logo ? `${o.logo.sha256.slice(0, 12)}…` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limites" className="space-y-3">
        <h2 id="limites" className="m-0 border-b border-rule-strong pb-2 text-2xl">
          Limitaciones y datos no verificados
        </h2>
        <ul className="prose-note m-0 space-y-2 pl-5">
          <li>Proclamaciones del JNE/JEE: no se verificaron; ningún resultado se presenta como proclamado.</li>
          <li>Votos impugnados: ONPE no los publica por separado en estos servicios; la conciliación usa válidos + blancos + nulos = emitidos.</li>
          <li>Consejo Regional: ONPE no publica en estos servicios los nombres de las listas ni la asignación de escaños; no se calculan.</li>
          <li>Algunas candidaturas aparecen en ONPE sin nombre de candidato; se muestran como «Sin nombre en ONPE».</li>
          <li>Dos nombres llegan con el texto «null» como apellido; se omite ese texto al mostrarlos y se conserva el original.</li>
          <li>Rutas /ubigeos/* y /actas/* documentadas: no fueron usadas por la interfaz de ONPE al momento de la captura y no se verificaron.</li>
        </ul>
        <p className="text-sm">
          Datos abiertos de esta versión: <a href={asset("/datos/dataset.json")}>dataset.json</a>,{" "}
          <a href={asset("/datos/resultados.csv")}>resultados.csv</a>, <a href={asset("/datos/participacion.csv")}>participacion.csv</a>.
        </p>
      </section>
    </div>
  );
}
