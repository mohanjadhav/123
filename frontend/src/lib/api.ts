// Typed fetch layer over the FastAPI backend. Base is the relative "/api" prefix so the
// same code works in dev (Vite proxies /api → :8001) and behind a single origin in prod.
const BASE = "/api";

// Fields are declared, not constructor parameter properties: tsconfig sets
// erasableSyntaxOnly, which rejects `constructor(readonly status: number)`.
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type JsonBody = unknown;

async function request<T>(method: string, path: string, body?: JsonBody): Promise<T> {
  // Auth rides the httpOnly session cookie automatically — never add auth headers here.
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // FastAPI reports request-validation failures as 422 with a {detail: [...]} body.
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// The response type is yours to declare: nothing infers across the Python boundary, so a
// TS interface here mirrors the endpoint's Pydantic model by hand — keep the two in sync.
export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: JsonBody) => request<T>("POST", path, body ?? null);
export const apiPut = <T>(path: string, body?: JsonBody) => request<T>("PUT", path, body ?? null);
export const apiPatch = <T>(path: string, body?: JsonBody) =>
  request<T>("PATCH", path, body ?? null);
export const apiDelete = <T>(path: string) => request<T>("DELETE", path);

// Multipart upload (FormData) — the browser sets the boundary header itself.
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}

export function apiErrorDetail(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const d = (err.body as { detail?: unknown } | null)?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) { // FastAPI validation errors: [{loc, msg}]
      const msgs = d.map((x: { loc?: unknown[]; msg?: string }) => `${(x.loc ?? []).filter((p) => p !== "body").join(" › ")}: ${x.msg ?? ""}`).slice(0, 3);
      if (msgs.length) return msgs.join("; ");
    }
    if ([502, 503, 504].includes(err.status)) return `Server error ${err.status} — the app server is still starting or not reachable. Wait a moment and press Retry.`;
    if (err.status === 404) return "Server error 404 — this copy of the app is older than its screens. Update / redeploy the app, then try again.";
    return `Server error ${err.status}`;
  }
  return fallback;
}
