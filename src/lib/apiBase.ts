const configuredApiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

// Development: same-origin requests to `/api/...` are proxied by Vite to your backend
// (see `VITE_DEV_API_TARGET` in vite.config). Set `VITE_API_BASE_URL` to override.
// Production / `vite preview`: use `VITE_API_BASE_URL` or default below.
export const API_BASE = trimTrailingSlash(
  configuredApiBase ?? (import.meta.env.DEV ? "" : "http://localhost:3001"),
);
