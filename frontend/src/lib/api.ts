const directBackendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.replace(/\/+$/, "") || "";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  (directBackendOrigin ? `${directBackendOrigin}/api/v1` : "/api/v1");
const AUTH_STORAGE_KEY = "medhub-auth";

type ApiRequestInit = RequestInit & {
  token?: string | null;
};

type StoredAuthState = {
  token?: string | null;
  refreshToken?: string | null;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredAuth(): StoredAuthState | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: StoredAuthState } | StoredAuthState | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if ("state" in parsed) {
      return parsed.state ?? null;
    }
    return parsed as StoredAuthState;
  } catch {
    return null;
  }
}

function writeStoredAuth(nextState: StoredAuthState | null) {
  if (!isBrowser()) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { state?: StoredAuthState; version?: number }) : {};
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        state: {
          ...(parsed.state ?? {}),
          ...(nextState ?? {}),
          isAuthenticated: Boolean(nextState?.token),
        },
      }),
    );
    window.dispatchEvent(new CustomEvent("medhub-auth-refreshed", { detail: nextState }));
  } catch {
    // Ignore storage write failures.
  }
}

function clearStoredAuth() {
  if (!isBrowser()) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { state?: StoredAuthState; version?: number }) : {};
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        state: {
          ...(parsed.state ?? {}),
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        },
      }),
    );
    window.dispatchEvent(new CustomEvent("medhub-auth-refreshed", { detail: null }));
  } catch {
    // Ignore storage write failures.
  }
}

function flattenErrorValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => flattenErrorValue(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(", ") : null;
  }

  if (value && typeof value === "object") {
    const parts = Object.entries(value)
      .map(([key, nested]) => {
        const nestedText = flattenErrorValue(nested);
        return nestedText ? `${key}: ${nestedText}` : null;
      })
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(" | ") : null;
  }

  return null;
}

// Mutex to prevent concurrent token refresh attempts
let refreshPromise: Promise<{ token: string; refreshToken: string } | null> | null = null;

export async function apiFetch<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const storedAuth = readStoredAuth();
  const isAuthEndpoint = path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
  const resolvedToken = isAuthEndpoint ? null : (storedAuth?.token || token || null);
  const requestHeaders: HeadersInit = {
    ...(rest.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    ...(headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
    cache: "no-store",
  });

  if (
    response.status === 401 &&
    isBrowser() &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/logout") &&
    !path.startsWith("/auth/refresh")
  ) {
    const refreshToken = storedAuth?.refreshToken;
    if (refreshToken) {
      // Deduplicate concurrent refresh attempts with a shared promise
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              cache: "no-store",
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshResponse.ok) {
              const refreshed = (await refreshResponse.json()) as { token: string; refreshToken: string };
              writeStoredAuth({
                token: refreshed.token,
                refreshToken: refreshed.refreshToken,
              });
              return refreshed;
            }
            return null;
          } catch {
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      const refreshed = await refreshPromise;
      if (refreshed) {
          const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
            ...rest,
            headers: {
              ...(rest.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
              Authorization: `Bearer ${refreshed.token}`,
              ...(headers ?? {}),
            },
            cache: "no-store",
          });

          if (retryResponse.ok) {
            if (retryResponse.status === 204) {
              return null as T;
            }
            return retryResponse.json();
          }
          return handleApiError<T>(retryResponse);
      }

      clearStoredAuth();
      if (isBrowser()) {
        window.location.href = "/login";
      }
    } else {
      // No refresh token available — redirect to login
      clearStoredAuth();
      if (isBrowser()) {
        window.location.href = "/login";
      }
    }
  }

  if (!response.ok) {
    return handleApiError<T>(response);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

async function handleApiError<T>(_response: Response): Promise<T> {
  let errorMessage = `Request failed with status ${_response.status}`;
  try {
    const data = await _response.json();
    const nestedMessage = flattenErrorValue(data?.error);
    const detailsMessage = flattenErrorValue(data?.details);
    const objectMessage = flattenErrorValue(data);
    errorMessage =
      nestedMessage ||
      detailsMessage ||
      data?.detail ||
      data?.message ||
      (typeof data?.error === "string" ? data.error : undefined) ||
      objectMessage ||
      JSON.stringify(data);
  } catch {
    try {
      errorMessage = await _response.text();
    } catch {
      // ignore parse failures and keep the default message
    }
  }
  throw new Error(errorMessage || "Request failed");
}

export { API_BASE_URL };
