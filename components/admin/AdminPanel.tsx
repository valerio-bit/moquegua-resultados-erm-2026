"use client";

import { useEffect, useRef, useState } from "react";
import { DatasetSchema, type Dataset } from "@/lib/schemas";
import { validateDataset, type ValidationReport } from "@/lib/validation/validate";
import { compareDatasets, type DiffReport } from "@/lib/diff";
import { importJsonFiles } from "@/lib/import/json";
import { importResultsCsv } from "@/lib/import/results-csv";
import { buildExportZip, snapshotManifest } from "@/lib/export";
import { formatActsPct, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { asset } from "@/lib/site";

type Log = { kind: "ok" | "error" | "warning" | "info"; text: string };

function download(name: string, data: Blob | string, type = "application/json") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BTN =
  "rounded-sm border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 border-rule-strong bg-surface text-ink hover:border-accent hover:text-accent";
const BTN_PRIMARY =
  "rounded-sm border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 border-accent bg-accent text-white hover:bg-accent-strong";

export function AdminPanel() {
  const [base, setBase] = useState<Dataset | null>(null);
  const [candidate, setCandidate] = useState<Dataset | null>(null);
  const [candidateLabel, setCandidateLabel] = useState("");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [diff, setDiff] = useState<DiffReport | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const log = (kind: Log["kind"], text: string) => setLogs((l) => [{ kind, text }, ...l].slice(0, 60));

  useEffect(() => {
    fetch(asset("/datos/dataset.json"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const parsed = DatasetSchema.safeParse(json);
        if (!parsed.success) throw new Error("La versión publicada no cumple el esquema.");
        setBase(parsed.data);
      })
      .catch((e) => log("error", `No se pudo cargar la versión publicada: ${e instanceof Error ? e.message : e}`));
  }, []);

  const target = candidate ?? base;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      log("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const acceptCandidate = (ds: Dataset, label: string) => {
    setCandidate(ds);
    setCandidateLabel(label);
    setReport(null);
    setDiff(null);
    log("ok", `Versión candidata cargada: ${label}. Ahora compárala y valídala antes de publicar.`);
  };

  const onFetchOnpe = () =>
    run(async () => {
      log("info", "Probando acceso a los servicios de ONPE desde el navegador…");
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch("https://resultadoelectoral.onpe.gob.pe/presentacion-backend/proceso/proceso-electoral-activo", {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(t);
        const waf = res.headers.get("x-amzn-waf-action");
        if (!res.ok || waf || res.status === 202) throw new Error(`HTTP ${res.status}${waf ? ` (WAF: ${waf})` : ""}`);
        log("warning", "ONPE respondió. La actualización completa se hace con el script: npm run data:fetch -- --publish");
      } catch (e) {
        log(
          "warning",
          `ONPE no permite la consulta automatizada desde este sitio (${e instanceof Error ? e.message : e}). No se intenta evadir la protección. Opciones: ejecutar «npm run data:fetch» en tu equipo (Modo A) o importar JSON/CSV copiados del portal público (Modo B). La web sigue mostrando el último snapshot publicado.`,
        );
      }
    });

  const onJson = (files: FileList | null) =>
    run(async () => {
      if (!files?.length || !base) return;
      const parsed: { name: string; content: unknown }[] = [];
      for (const f of Array.from(files)) {
        try {
          parsed.push({ name: f.name, content: JSON.parse((await f.text()).replace(/^﻿/, "")) });
        } catch {
          log("error", `${f.name}: JSON mal formado. Archivo rechazado.`);
          return;
        }
      }
      const res = await importJsonFiles(parsed, base);
      res.warnings.forEach((w) => log("warning", w));
      if (res.errors.length || !res.dataset) {
        res.errors.forEach((e) => log("error", e));
        log("error", "Importación JSON rechazada: corrige los archivos.");
        return;
      }
      acceptCandidate(res.dataset, `JSON (${parsed.map((p) => p.name).join(", ")})`);
    });

  const onCsv = (files: FileList | null) =>
    run(async () => {
      const f = files?.[0];
      if (!f || !base) return;
      const res = await importResultsCsv(await f.text(), base);
      res.warnings.forEach((w) => log("warning", w));
      if (res.errors.length || !res.dataset) {
        res.errors.slice(0, 15).forEach((e) => log("error", e));
        log("error", "Importación CSV rechazada: corrige el archivo.");
        return;
      }
      acceptCandidate(res.dataset, `CSV (${f.name})`);
    });

  const onCompare = () =>
    run(async () => {
      if (!base || !target) return;
      const d = compareDatasets(base, target);
      setDiff(d);
      log("info", d.identical ? "La versión candidata es idéntica a la publicada (mismo hash)." : `Comparación lista: ${d.counts.modified} registros modificados.`);
    });

  const onValidate = () =>
    run(async () => {
      if (!target) return;
      const r = await validateDataset(target);
      setReport(r);
      log(r.publishable ? "ok" : "error", r.publishable ? "Validación superada: sin fallos críticos." : `Validación crítica fallida (${r.summary.failedCritical} controles). Publicación bloqueada.`);
    });

  const onSnapshot = () =>
    run(async () => {
      if (!target) return;
      const { text, manifest } = await snapshotManifest(target, report);
      download(`${target.meta.snapshotId}.json`, text);
      download(`${target.meta.snapshotId}.manifest.json`, JSON.stringify(manifest, null, 2));
      log("ok", `Snapshot ${target.meta.snapshotId} descargado. Guárdalo en data/snapshots/ (no sobrescribas snapshots anteriores).`);
    });

  const publishBlockers: string[] = [];
  if (!candidate) publishBlockers.push("Importa una versión nueva (JSON o CSV).");
  if (!diff) publishBlockers.push("Compara con la versión publicada.");
  if (!report) publishBlockers.push("Ejecuta la validación.");
  else if (!report.publishable) publishBlockers.push("Hay validaciones críticas fallidas.");
  const canPublish = publishBlockers.length === 0;

  const onPublish = () =>
    run(async () => {
      if (!candidate || !canPublish) return;
      const { text } = await snapshotManifest(candidate, report);
      download("dataset.json", text);
      log(
        "ok",
        "Versión publicable descargada. Reemplaza data/processed/dataset.json en el repositorio y haz commit: el despliegue automático la publicará.",
      );
    });

  const onZip = () =>
    run(async () => {
      if (!target) return;
      const blob = await buildExportZip(target, report, diff);
      download(`moquegua-erm-2026_${target.meta.snapshotId}.zip`, blob, "application/zip");
      log("ok", "ZIP exportado.");
    });

  return (
    <div className="space-y-8">
      <section aria-labelledby="versiones" className="grid gap-4 md:grid-cols-2">
        <h2 id="versiones" className="sr-only">
          Versiones
        </h2>
        <div className="rounded-sm border border-rule bg-surface p-4">
          <p className="m-0 text-sm text-ink-soft">Versión publicada</p>
          {base ? (
            <dl className="m-0 mt-1 space-y-0.5 text-sm" data-testid="published-version">
              <div>
                <dt className="inline text-ink-soft">Snapshot: </dt>
                <dd className="inline font-mono">{base.meta.snapshotId}</dd>
              </div>
              <div>
                <dt className="inline text-ink-soft">Registros: </dt>
                <dd className="inline">{formatInt(base.results.length)}</dd>
              </div>
              <div>
                <dt className="inline text-ink-soft">Último corte ONPE: </dt>
                <dd className="inline">{formatDateTime(base.meta.sourceTimestampMax)}</dd>
              </div>
              <div>
                <dt className="inline text-ink-soft">Hash: </dt>
                <dd className="inline break-all font-mono text-xs">{base.meta.snapshotHash}</dd>
              </div>
            </dl>
          ) : (
            <p className="m-0 mt-1 text-sm">Cargando…</p>
          )}
        </div>
        <div className="rounded-sm border border-rule bg-surface p-4">
          <p className="m-0 text-sm text-ink-soft">Versión candidata</p>
          {candidate ? (
            <dl className="m-0 mt-1 space-y-0.5 text-sm" data-testid="candidate-version">
              <div>
                <dt className="inline text-ink-soft">Origen: </dt>
                <dd className="inline">{candidateLabel}</dd>
              </div>
              <div>
                <dt className="inline text-ink-soft">Snapshot: </dt>
                <dd className="inline font-mono">{candidate.meta.snapshotId}</dd>
              </div>
              <div>
                <dt className="inline text-ink-soft">Registros: </dt>
                <dd className="inline">{formatInt(candidate.results.length)}</dd>
              </div>
              <div>
                <dt className="inline text-ink-soft">Hash: </dt>
                <dd className="inline break-all font-mono text-xs">{candidate.meta.snapshotHash}</dd>
              </div>
            </dl>
          ) : (
            <p className="m-0 mt-1 text-sm">Ninguna. Importa un JSON o CSV; mientras tanto, validar y comparar usan la versión publicada.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="acciones">
        <h2 id="acciones" className="m-0 mb-3 text-2xl">
          Acciones
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={onFetchOnpe} disabled={busy}>
            Actualizar desde ONPE
          </button>
          <button type="button" className={BTN} onClick={() => jsonInput.current?.click()} disabled={busy || !base}>
            Importar JSON
          </button>
          <button type="button" className={BTN} onClick={() => csvInput.current?.click()} disabled={busy || !base}>
            Importar CSV
          </button>
          <button type="button" className={BTN} onClick={onCompare} disabled={busy || !base}>
            Comparar versión
          </button>
          <button type="button" className={BTN} onClick={onValidate} disabled={busy || !target}>
            Validar
          </button>
          <button type="button" className={BTN} onClick={onSnapshot} disabled={busy || !target}>
            Generar snapshot
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={onPublish}
            disabled={busy || !canPublish}
            aria-describedby="publish-blockers"
            data-testid="publish-button"
          >
            Generar versión publicable
          </button>
          <button type="button" className={BTN} onClick={onZip} disabled={busy || !target}>
            Exportar ZIP
          </button>
        </div>
        <input ref={jsonInput} type="file" accept=".json,application/json" multiple className="sr-only" aria-label="Archivos JSON" data-testid="json-input" onChange={(e) => { void onJson(e.target.files); e.target.value = ""; }} />
        <input ref={csvInput} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Archivo CSV" data-testid="csv-input" onChange={(e) => { void onCsv(e.target.files); e.target.value = ""; }} />
        <div id="publish-blockers" className="mt-3 text-sm" data-testid="publish-blockers">
          {canPublish ? (
            <p className="m-0 text-st-proclamado">Lista para publicar: sin validaciones críticas fallidas.</p>
          ) : (
            <p className="m-0 text-ink-soft">Para generar la versión publicable: {publishBlockers.join(" ")}</p>
          )}
        </div>
      </section>

      {diff && <DiffView diff={diff} />}
      {report && <ReportView report={report} />}

      <section aria-labelledby="registro">
        <h2 id="registro" className="m-0 mb-2 text-xl">
          Registro de actividad
        </h2>
        <ul className="m-0 list-none space-y-1.5 p-0 text-sm" aria-live="polite" data-testid="admin-log">
          {logs.length === 0 && <li className="text-ink-soft">Sin actividad todavía.</li>}
          {logs.map((l, i) => (
            <li
              key={`${i}-${l.text.slice(0, 20)}`}
              className={
                l.kind === "error" ? "text-st-parcial" : l.kind === "ok" ? "text-st-proclamado" : l.kind === "warning" ? "text-st-virtual" : "text-ink"
              }
            >
              {l.kind === "error" ? "✖ " : l.kind === "ok" ? "✔ " : l.kind === "warning" ? "⚠ " : "· "}
              {l.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DiffView({ diff }: { diff: DiffReport }) {
  const c = diff.counts;
  const stats: [string, number][] = [
    ["Registros añadidos", c.added],
    ["Modificados", c.modified],
    ["Eliminados", c.removed],
    ["Con votos distintos", c.votesChanged],
    ["Con porcentajes distintos", c.pctChanged],
    ["Con cambio de estado", c.statusChanged],
  ];
  const leaderChanges = diff.units.filter((u) => u.leaderChanged);
  const outcomeChanges = diff.units.filter((u) => u.outcomeChanged);
  return (
    <section aria-labelledby="comparacion" data-testid="diff-view">
      <h2 id="comparacion" className="m-0 mb-3 text-2xl">
        Comparación con la versión publicada
      </h2>
      <p className="m-0 text-sm text-ink-soft">
        Publicada {diff.before.snapshotId} (hash {diff.before.snapshotHash.slice(0, 12)}…) → candidata {diff.after.snapshotId} (hash{" "}
        {diff.after.snapshotHash.slice(0, 12)}…). Corte ONPE más reciente: {formatDateTime(diff.after.sourceTimestampMax)}.
      </p>
      <dl className="m-0 mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="border-t border-rule pt-2">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="num m-0 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">
        Cambios de primer lugar: <strong>{leaderChanges.length}</strong>. Cambios de estado electoral: <strong>{outcomeChanges.length}</strong>.
        Elecciones con cambios (actas, corte o resultado): <strong>{diff.units.length}</strong>.
      </p>
      {diff.units.length > 0 && (
        <div className="table-wrap mt-3">
          <table className="data-table">
            <caption>Avance de actas y estado por elección con cambios.</caption>
            <thead>
              <tr>
                <th scope="col">Elección</th>
                <th scope="col" className="right">
                  Actas antes
                </th>
                <th scope="col" className="right">
                  Actas después
                </th>
                <th scope="col">Primer lugar</th>
                <th scope="col">Estado</th>
                <th scope="col">Corte</th>
              </tr>
            </thead>
            <tbody>
              {diff.units.slice(0, 40).map((u) => (
                <tr key={u.unitId}>
                  <th scope="row" className="font-normal">
                    {u.label}
                  </th>
                  <td className="right num">{formatActsPct(u.countedActsPctBefore)}</td>
                  <td className="right num">{formatActsPct(u.countedActsPctAfter)}</td>
                  <td>{u.leaderChanged ? `${u.leaderBefore.join(",") || "—"} → ${u.leaderAfter.join(",") || "—"}` : "sin cambio"}</td>
                  <td>{u.outcomeChanged ? `${u.outcomeBefore ?? "—"} → ${u.outcomeAfter ?? "—"}` : u.outcomeAfter}</td>
                  <td className="text-xs">{formatDateTime(u.sourceTimestampAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {diff.modified.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">Ver registros modificados ({diff.modified.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {diff.modified.slice(0, 100).map((m) => (
              <li key={m.key}>
                {m.label}: votos {formatInt(m.before?.votes)} → {formatInt(m.after?.votes)} ({m.votesDelta >= 0 ? "+" : ""}
                {formatInt(m.votesDelta)}), % {formatPct(m.before?.validVotePct)} → {formatPct(m.after?.validVotePct)}
                {m.statusChanged ? `, estado ${m.before?.status} → ${m.after?.status}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ReportView({ report }: { report: ValidationReport }) {
  return (
    <section aria-labelledby="validacion" data-testid="validation-view">
      <h2 id="validacion" className="m-0 mb-2 text-2xl">
        Validación
      </h2>
      <p className={`m-0 font-semibold ${report.publishable ? "text-st-proclamado" : "text-st-parcial"}`} data-testid="validation-summary">
        {report.publishable
          ? `Sin fallos críticos (${report.summary.passed}/${report.summary.checks} controles OK).`
          : `Publicación bloqueada: ${report.summary.failedCritical} validación(es) crítica(s) fallida(s).`}
      </p>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0 text-sm">
        {report.checks.map((c) => (
          <li key={c.id}>
            <span aria-hidden="true">{c.passed ? "✔" : c.severity === "critical" ? "✖" : "⚠"}</span> {c.title}{" "}
            <span className="text-ink-faint">({c.checkedItems})</span>
            {!c.passed && (
              <ul className="mt-1 list-disc pl-6 text-st-parcial">
                {c.failures.slice(0, 5).map((f) => (
                  <li key={`${f.ref}-${f.message}`}>
                    {f.ref}: {f.message}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
