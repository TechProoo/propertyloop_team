// HTTP client for the team portal.
//
// Mirrors the main site's approach deliberately: the refresh token lives in
// an HttpOnly cookie the browser sends on its own, and the access token lives
// only in memory. Nothing sensitive is written to localStorage, so a reload
// re-authenticates through /auth/refresh rather than trusting a stored token.

import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { trackActivity } from './network'

export const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE,
  // Render and Railway cold starts can take the better part of a minute on
  // the first request after idle; a short timeout turns that into a login
  // failure the user reads as a wrong password.
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// First, so the loading bar releases a failed request before the refresh
// logic below retries it.
trackActivity(api)

let accessToken: string | null = null

export const tokens = {
  set(token: string | null) {
    accessToken = token
  },
  get() {
    return accessToken
  },
  clear() {
    accessToken = null
  },
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

/** Called when refresh fails, so the app can drop back to the sign-in screen. */
let onAuthLost: (() => void) | null = null
export function setAuthLostHandler(fn: (() => void) | null) {
  onAuthLost = fn
}

// A single refresh in flight, shared by every request that hit a 401 at the
// same moment. Without this, a dashboard firing six parallel calls would send
// six refreshes and rotate the token from under itself.
let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post<{ accessToken: string }>(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        tokens.set(res.data.accessToken)
        return res.data.accessToken
      })
      .catch(() => {
        tokens.clear()
        return null
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined

    const isAuthCall =
      typeof original?.url === 'string' && original.url.includes('/auth/')

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      // Never retry the refresh or login calls themselves — that is how you
      // build an infinite loop out of an expired session.
      !isAuthCall
    ) {
      original._retried = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      onAuthLost?.()
    }

    return Promise.reject(error)
  },
)

/** Pulls a readable message out of whatever the API or network returned. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosError<{ message?: string | string[] }>

  if (err?.code === 'ERR_NETWORK') {
    return 'Cannot reach the server. Check your connection and try again.'
  }

  // Rate limiting reaches the client as "ThrottlerException: Too Many
  // Requests", which reads like a bug and — on a sign-in screen — like a
  // rejected password. Several people signing in from one office hit this
  // together, so it has to say plainly that waiting fixes it.
  if (err?.response?.status === 429) {
    const retryAfter = Number(err.response.headers?.['retry-after'])
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? `about ${retryAfter} second${retryAfter === 1 ? '' : 's'}`
        : 'a minute'
    return `Too many attempts. Wait ${wait} and try again — your password is probably fine.`
  }

  const message = err?.response?.data?.message
  if (Array.isArray(message)) return message[0] ?? fallback
  return message ?? fallback
}

export default api
