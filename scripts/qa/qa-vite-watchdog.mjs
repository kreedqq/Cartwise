/** QA-only Vite HTTP health (TCP listen ≠ responsive). */

export class InfrastructureBlockedError extends Error {
  constructor(code, detail) {
    super(`INFRASTRUCTURE_BLOCKED: ${code}\n${JSON.stringify(detail, null, 2)}`);
    this.name = "InfrastructureBlockedError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * @returns {{ ok: boolean, status: number | null, ms: number, error: string | null }}
 */
export async function probeViteHttp(baseUrl, timeoutMs = 8_000) {
  const url = baseUrl.replace(/\/$/, "") + "/";
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function assertViteResponsive(baseUrl, matrixState = null) {
  const health = await probeViteHttp(baseUrl, 8_000);
  if (health.ok) return health;
  throw new InfrastructureBlockedError("VITE_UNRESPONSIVE", {
    baseUrl,
    viteHealth: health,
    matrix: matrixState,
  });
}

export function matrixLog(viewport, route, message, extra = {}) {
  const vp = viewport ?? "-";
  const rt = route ?? "-";
  const tail = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[MATRIX] viewport=${vp} route=${rt} ${message}${tail}`);
}
