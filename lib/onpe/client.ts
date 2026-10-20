/**
 * Cliente de los servicios públicos de ONPE con:
 *  - ritmo máximo (intervalo mínimo entre solicitudes),
 *  - caché opcional (inyectable; los scripts usan disco),
 *  - reintentos con backoff exponencial para 429/5xx/errores de red.
 *
 * Política de no evasión: si la respuesta indica un desafío o bloqueo del WAF/anti-bot
 * (cabecera x-amzn-waf-action, HTTP 202 sin cuerpo, 403, CAPTCHA), el cliente se detiene
 * de inmediato con OnpeBlockedError. No reintenta, no rota identidades ni resuelve desafíos.
 */

export class OnpeBlockedError extends Error {
  constructor(
    public url: string,
    public status: number,
    public wafAction: string | null,
  ) {
    super(
      `ONPE bloqueó la consulta automatizada (HTTP ${status}${wafAction ? `, WAF: ${wafAction}` : ""}). ` +
        "No se intenta evadir la protección. Usa el Modo B (importación manual) o vuelve a intentarlo más tarde.",
    );
    this.name = "OnpeBlockedError";
  }
}

export class OnpeHttpError extends Error {
  constructor(
    public url: string,
    public status: number,
  ) {
    super(`ONPE respondió HTTP ${status} para ${url}`);
    this.name = "OnpeHttpError";
  }
}

export interface CacheStore {
  get(key: string): Promise<{ body: unknown; storedAt: number } | null>;
  set(key: string, body: unknown): Promise<void>;
}

export interface ClientOptions {
  minIntervalMs?: number;
  maxRetries?: number;
  cacheTtlMs?: number;
  cache?: CacheStore;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  userAgent?: string;
}

export function isBlockedResponse(res: Pick<Response, "status" | "headers">): boolean {
  const waf = res.headers.get("x-amzn-waf-action");
  if (waf) return true;
  return res.status === 403 || res.status === 405;
}

export class OnpeClient {
  private last = 0;
  private readonly opts: Required<Omit<ClientOptions, "cache">> & { cache?: CacheStore };
  public requests = 0;
  public cacheHits = 0;

  constructor(options: ClientOptions = {}) {
    this.opts = {
      minIntervalMs: options.minIntervalMs ?? 1500,
      maxRetries: options.maxRetries ?? 4,
      cacheTtlMs: options.cacheTtlMs ?? 300_000,
      cache: options.cache,
      fetchImpl: options.fetchImpl ?? fetch,
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      now: options.now ?? Date.now,
      userAgent: options.userAgent ?? "moquegua-resultados-erm-2026/1.0 (visualizacion independiente de datos publicos)",
    };
  }

  private async throttle() {
    const wait = this.last + this.opts.minIntervalMs - this.opts.now();
    if (wait > 0) await this.opts.sleep(wait);
    this.last = this.opts.now();
  }

  async getJson<T = unknown>(url: string): Promise<T> {
    if (this.opts.cache && this.opts.cacheTtlMs > 0) {
      const hit = await this.opts.cache.get(url);
      if (hit && this.opts.now() - hit.storedAt < this.opts.cacheTtlMs) {
        this.cacheHits += 1;
        return hit.body as T;
      }
    }
    let attempt = 0;
    for (;;) {
      await this.throttle();
      this.requests += 1;
      let res: Response;
      try {
        res = await this.opts.fetchImpl(url, {
          headers: { Accept: "application/json", "User-Agent": this.opts.userAgent },
        });
      } catch (err) {
        if (attempt >= this.opts.maxRetries) throw err;
        await this.backoff(attempt++);
        continue;
      }
      if (isBlockedResponse(res)) throw new OnpeBlockedError(url, res.status, res.headers.get("x-amzn-waf-action"));
      if (res.status === 202 || res.status === 204) {
        // 202 sin contenido es la señal de desafío del WAF; 204 = sin datos para ese ámbito.
        if (res.status === 202) throw new OnpeBlockedError(url, res.status, res.headers.get("x-amzn-waf-action"));
        return null as T;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= this.opts.maxRetries) throw new OnpeHttpError(url, res.status);
        const retryAfter = Number(res.headers.get("retry-after"));
        await this.backoff(attempt++, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
        continue;
      }
      if (!res.ok) throw new OnpeHttpError(url, res.status);
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("json")) throw new OnpeBlockedError(url, res.status, "respuesta no JSON (posible página de desafío)");
      const body = (await res.json()) as T;
      if (this.opts.cache) await this.opts.cache.set(url, body);
      return body;
    }
  }

  private async backoff(attempt: number, explicitMs?: number) {
    const base = explicitMs ?? Math.min(30_000, 1000 * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 250);
    await this.opts.sleep(base + jitter);
  }
}
