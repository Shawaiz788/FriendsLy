const configuredApiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE = (configuredApiBase || "http://localhost:3002").replace(/\/$/, "");
