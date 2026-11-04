const PRODUCTION_API_URL = 'https://propertyloopbackend-production.up.railway.app/api'

export function resolveApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').replace(
    /^https:\/\/propertyloop-backend\.up\.railway\.app(?=\/|$)/,
    'https://propertyloopbackend-production.up.railway.app',
  )
}

export const API_BASE = resolveApiUrl(
  import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:3000/api'),
)
