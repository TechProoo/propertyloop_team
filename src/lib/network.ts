// Whether the portal is waiting on the network, for the loading bar and the
// offline notice.
//
// Requests are counted at the HTTP client rather than in each screen, so every
// save, upload and reload shows up without any screen having to remember to
// say so. Screens subscribe with useSyncExternalStore.

import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

type Counted = InternalAxiosRequestConfig & { _plCounted?: boolean }

let pending = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

function done(config: Counted | undefined) {
  if (!config?._plCounted) return
  // Cleared so a retried request (after a token refresh) counts again rather
  // than being subtracted twice.
  config._plCounted = false
  pending = Math.max(0, pending - 1)
  emit()
}

/**
 * Count this client's requests. Must be attached before any other response
 * interceptor, so a request that fails and is retried is released first and
 * counted afresh on the retry.
 */
export function trackActivity(client: AxiosInstance) {
  client.interceptors.request.use((config: Counted) => {
    if (!config._plCounted) {
      config._plCounted = true
      pending += 1
      emit()
    }
    return config
  })
  client.interceptors.response.use(
    (response) => {
      done(response.config as Counted)
      return response
    },
    (error: { config?: Counted }) => {
      done(error.config)
      return Promise.reject(error)
    },
  )
}

export function subscribeActivity(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function isBusy(): boolean {
  return pending > 0
}

/* ─── Online / offline ───────────────────────────────────────────────── */

export function subscribeOnline(fn: () => void) {
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  return () => {
    window.removeEventListener('online', fn)
    window.removeEventListener('offline', fn)
  }
}

export function isOnline(): boolean {
  return navigator.onLine
}
