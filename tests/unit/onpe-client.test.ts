import { describe, expect, it } from "vitest";
import { OnpeBlockedError, OnpeClient, OnpeHttpError, type CacheStore } from "@/lib/onpe/client";
import { endpoints } from "@/lib/onpe/endpoints";

function fakeFetch(responses: (() => Response)[]) {
  let i = 0;
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(String(url));
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return r();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function clock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

describe("cliente ONPE (Modo A)", () => {
  it("se detiene ante el WAF sin reintentar ni evadir", async () => {
    const c = clock();
    const { fn, calls } = fakeFetch([() => new Response("", { status: 202, headers: { "x-amzn-waf-action": "challenge" } })]);
    const client = new OnpeClient({ fetchImpl: fn, sleep: c.sleep, now: c.now, minIntervalMs: 10 });
    await expect(client.getJson("https://x/api")).rejects.toBeInstanceOf(OnpeBlockedError);
    expect(calls).toHaveLength(1);
  });

  it("trata 403 como bloqueo", async () => {
    const c = clock();
    const { fn, calls } = fakeFetch([() => new Response("<html>", { status: 403, headers: { "content-type": "text/html" } })]);
    const client = new OnpeClient({ fetchImpl: fn, sleep: c.sleep, now: c.now });
    await expect(client.getJson("https://x/api")).rejects.toBeInstanceOf(OnpeBlockedError);
    expect(calls).toHaveLength(1);
  });

  it("reintenta 5xx con backoff exponencial y luego responde", async () => {
    const c = clock();
    const { fn, calls } = fakeFetch([() => json({}, 503), () => json({}, 503), () => json({ data: 1, success: true })]);
    const client = new OnpeClient({ fetchImpl: fn, sleep: c.sleep, now: c.now, minIntervalMs: 0, maxRetries: 4 });
    await expect(client.getJson("https://x/api")).resolves.toEqual({ data: 1, success: true });
    expect(calls).toHaveLength(3);
    const backoffs = c.sleeps.filter((ms) => ms >= 1000);
    expect(backoffs[1]!).toBeGreaterThan(backoffs[0]!);
  });

  it("agota los reintentos con error HTTP", async () => {
    const c = clock();
    const { fn } = fakeFetch([() => json({}, 500)]);
    const client = new OnpeClient({ fetchImpl: fn, sleep: c.sleep, now: c.now, minIntervalMs: 0, maxRetries: 2 });
    await expect(client.getJson("https://x/api")).rejects.toBeInstanceOf(OnpeHttpError);
  });

  it("respeta el intervalo mínimo entre solicitudes y usa la caché", async () => {
    const c = clock();
    const store = new Map<string, { body: unknown; storedAt: number }>();
    const cache: CacheStore = { get: async (k) => store.get(k) ?? null, set: async (k, b) => void store.set(k, { body: b, storedAt: c.now() }) };
    const { fn, calls } = fakeFetch([() => json({ ok: 1, success: true })]);
    const client = new OnpeClient({ fetchImpl: fn, sleep: c.sleep, now: c.now, minIntervalMs: 1500, cache, cacheTtlMs: 60_000 });
    await client.getJson("https://x/a");
    await client.getJson("https://x/b");
    expect(c.sleeps).toContain(1500);
    await client.getJson("https://x/a");
    expect(calls).toHaveLength(2);
    expect(client.cacheHits).toBe(1);
  });

  it("construye las rutas documentadas por nivel territorial", () => {
    const api = endpoints("https://h/presentacion-backend");
    expect(api.totals(4, { department: "170000", province: "170100", district: "170105" })).toBe(
      "https://h/presentacion-backend/resumen-general/totales?idEleccion=4&tipoFiltro=ubigeo_nivel_03&idAmbitoGeografico=1&idUbigeoDepartamento=170000&idUbigeoProvincia=170100&idUbigeoDistrito=170105",
    );
    expect(api.blankNull(1, { department: "170000" })).toContain("eleccion-gobernador-vicegobernador/participantes-ubicacion-geografica-nombre?idEleccion=1");
  });
});
