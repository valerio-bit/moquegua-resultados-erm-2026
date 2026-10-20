/**
 * MODO A — Actualización online desde los servicios públicos de ONPE.
 *
 *   npm run data:fetch            # consulta, guarda data/raw/<UTC>/ y construye snapshot
 *   npm run data:fetch -- --publish
 *
 * Recorre la jerarquía territorial a partir del registro MOQUEGUA que devuelve ONPE
 * (no presupone el código), con caché en data/cache, intervalo mínimo entre solicitudes
 * y backoff. Si ONPE bloquea la consulta automatizada (WAF, CAPTCHA), se detiene sin
 * evadir la protección y la web sigue funcionando con el último snapshot publicado.
 */
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { OnpeBlockedError, OnpeClient, type CacheStore } from "@/lib/onpe/client";
import { DEFAULT_BASE, UBIGEO_CATALOG, endpoints, type Scope } from "@/lib/onpe/endpoints";
import type { Capture, ElectionId } from "@/lib/schemas";
import { DATA, RAW_DIR, parseArgs, readReferences, timestampId, writeJson } from "@/lib/node/io";
import { printReport, runPipeline } from "@/lib/node/pipeline";

const CACHE_DIR = path.join(DATA, "cache");

const diskCache: CacheStore = {
  async get(key) {
    const file = path.join(CACHE_DIR, `${createHash("sha256").update(key).digest("hex")}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as { body: unknown; storedAt: number };
  },
  async set(key, body) {
    mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${createHash("sha256").update(key).digest("hex")}.json`);
    writeFileSync(file, JSON.stringify({ key, body, storedAt: Date.now() }));
  },
};

type UbigeoRow = { code: string; parent: string; name: string };

function parseCatalog(body: unknown): UbigeoRow[] {
  if (!Array.isArray(body)) return [];
  return body
    .map((o) => o as Record<string, unknown>)
    .filter((o) => typeof o.c_ubigeo === "string" && typeof o.c_nombre === "string")
    .map((o) => ({ code: o.c_ubigeo as string, parent: String(o.n_ubigeo_padre ?? "0").padStart(6, "0"), name: o.c_nombre as string }));
}

async function main() {
  const { flags } = parseArgs();
  const base = process.env.ONPE_BASE_URL || DEFAULT_BASE;
  const api = endpoints(base);
  const client = new OnpeClient({
    minIntervalMs: Number(process.env.ONPE_MIN_INTERVAL_MS ?? 1500),
    maxRetries: Number(process.env.ONPE_MAX_RETRIES ?? 4),
    cacheTtlMs: Number(process.env.ONPE_CACHE_TTL_SECONDS ?? 300) * 1000,
    cache: diskCache,
  });
  const refs = readReferences();
  const captures: Capture[] = [];
  const add = (c: Capture) => captures.push(c);

  try {
    // 1. Proceso activo
    const proc = await client.getJson<{ data: { id: number; acronimo: string } }>(api.activeProcess());
    add({ sourceUrl: api.activeProcess(), response: proc });
    console.log(`Proceso activo: ${proc.data.acronimo} (id ${proc.data.id})`);

    // 2. Departamento MOQUEGUA según ONPE. Se usa el catálogo que carga la propia interfaz
    //    (assets/ubig/v1.json). Las rutas /ubigeos/* documentadas no fueron usadas por la
    //    interfaz al 20/10/2026 y su esquema no pudo verificarse; quedan en lib/onpe/endpoints.ts.
    const catalog = parseCatalog(await client.getJson(UBIGEO_CATALOG));
    const prefixRows = (code: string) => catalog.filter((r) => r.code.startsWith(code.slice(0, 2)));
    const dept = catalog.find((r) => r.name === "MOQUEGUA" && r.parent === "000000");
    if (!dept) throw new Error("ONPE no devolvió el departamento MOQUEGUA en su catálogo de ubigeos.");
    add({
      sourceUrl: UBIGEO_CATALOG,
      note: "Extracto filtrado al prefijo del departamento MOQUEGUA. Campos: c_ubigeo|n_ubigeo_padre|padre|c_nombre.",
      response: prefixRows(dept.code).map((r) => `${r.code}|${r.parent}|-|${r.name}`),
    });
    const provinces = catalog.filter((r) => r.parent === dept.code);
    console.log(`MOQUEGUA = ${dept.code}; provincias: ${provinces.map((p) => p.name).join(", ")}`);

    // 3. Elecciones por ámbito
    const scopeDept: Scope = { department: dept.code };
    const grab = async (electionId: ElectionId, scope: Scope) => {
      const totals = await client.getJson(api.totals(electionId, scope));
      if (!totals) return; // 204: sin elección en ese ámbito
      add({ kind: "totales", electionId, scope, sourceUrl: api.totals(electionId, scope), response: totals });
      add({ kind: "participantes", electionId, scope, sourceUrl: api.candidates(electionId, scope), response: await client.getJson(api.candidates(electionId, scope)) });
      add({ kind: "ubicacion-geografica", electionId, scope, sourceUrl: api.blankNull(electionId, scope), response: await client.getJson(api.blankNull(electionId, scope)) });
    };
    await grab(1, scopeDept);
    add({ kind: "participacion-totales", scope: scopeDept, sourceUrl: api.participation(scopeDept), response: await client.getJson(api.participation(scopeDept)) });
    for (const p of provinces) {
      const sp: Scope = { department: dept.code, province: p.code };
      await grab(2, sp);
      await grab(3, sp);
      add({ kind: "participacion-totales", scope: sp, sourceUrl: api.participation(sp), response: await client.getJson(api.participation(sp)) });
      const options = refs.territoryRef.districtElectionOptions[p.code] ?? [];
      for (const d of catalog.filter((r) => r.parent === p.code)) {
        const sd: Scope = { department: dept.code, province: p.code, district: d.code };
        add({ kind: "participacion-totales", scope: sd, sourceUrl: api.participation(sd), response: await client.getJson(api.participation(sd)) });
        // Capitales provinciales: su alcaldía es la provincial (no se duplica).
        if (options.includes(d.name)) await grab(4, sd);
      }
    }
  } catch (err) {
    if (err instanceof OnpeBlockedError) {
      console.error(`\n✖ ${err.message}\n  URL: ${err.url}`);
      console.error("  La web sigue funcionando con el último snapshot publicado (data/processed/dataset.json).");
      console.error("  Para actualizar: navega el portal público de ONPE, exporta/copia el JSON o CSV y usa `npm run data:import -- <archivos>`.");
      process.exitCode = 2;
      return;
    }
    throw err;
  }

  const id = timestampId();
  const dir = path.join(RAW_DIR, id);
  if (existsSync(dir)) throw new Error(`La carpeta ${dir} ya existe; no se sobrescribe.`);
  try {
    writeJson(path.join(dir, "onpe-api.json"), {
      captureMethod: "onpe-api",
      capturedAt: new Date().toISOString(),
      pageNote: `Consulta automatizada a ${base} (${client.requests} solicitudes, ${client.cacheHits} desde caché).`,
      captures,
    }, { exclusive: true });
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  console.log(`Capturas guardadas en data/raw/${id}/ (${captures.length})`);
  const result = await runPipeline({ rawFolder: id, publish: flags.has("publish") });
  printReport(result.report, result.manifest.buildIssues);
  if (!result.manifest.publishable) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
