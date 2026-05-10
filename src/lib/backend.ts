import type { SessionData } from "@/lib/session";

export const BACKEND_API_BASE =
  process.env.BACKEND_API_BASE ?? "http://127.0.0.1:4000/api/v1";

type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: ApiError;
};

export type BackendApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: ApiError | null;
};

export function apiErrorMessage(
  label: string,
  result: Pick<BackendApiResult<unknown>, "ok" | "status" | "error"> | null | undefined,
) {
  if (!result || result.ok) return null;
  return `${label}: ${result.error?.message ?? `Request failed with status ${result.status}`}`;
}

export async function backendApi<T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    accessToken?: string;
    body?: unknown;
  },
): Promise<BackendApiResult<T>> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}${path}`, {
      method: options?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options?.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
    return {
      ok: res.ok,
      status: res.status,
      data: json.data ?? null,
      error: json.error ?? null,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      data: null,
      error: {
        code: "BACKEND_UNAVAILABLE",
        message: "Backend API is unavailable. Ensure backend is running on configured BACKEND_API_BASE.",
      },
    };
  }
}

export async function backendApiWithSession<T>(
  path: string,
  session: SessionData,
  options?: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown },
) {
  return backendApi<T>(path, {
    method: options?.method,
    body: options?.body,
    accessToken: session.accessToken,
  });
}

export async function backendMultipartApiWithSession<T>(
  path: string,
  session: SessionData,
  formData: FormData,
  method: "POST" | "PATCH" | "PUT" = "POST",
): Promise<BackendApiResult<T>> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: formData,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
    return {
      ok: res.ok,
      status: res.status,
      data: json.data ?? null,
      error: json.error ?? null,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      data: null,
      error: {
        code: "BACKEND_UNAVAILABLE",
        message: "Backend API is unavailable. Ensure backend is running on configured BACKEND_API_BASE.",
      },
    };
  }
}

