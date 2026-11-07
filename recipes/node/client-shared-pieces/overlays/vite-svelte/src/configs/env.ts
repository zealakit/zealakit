/** Typed access to Vite public env vars (only `VITE_*` is exposed to the client). */
export const env = {
  publicApiUrl: import.meta.env.VITE_PUBLIC_API_URL as string | undefined,
} as const;
