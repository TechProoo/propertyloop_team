// Installing the portal as a phone app, and its notifications.
//
// Two browser features, both easy to get subtly wrong:
//
// Install. Android and desktop Chrome fire `beforeinstallprompt` once, early,
// and only a page that kept the event can offer a one-tap Install button. It is
// captured in main.tsx before React renders. iPhones have no such event — the
// only route is Safari's Share → Add to Home Screen, so the UI explains it.
//
// Notifications. Standard Web Push through public/sw.js. On iPhone (iOS 16.4+)
// push exists ONLY inside the app added to the home screen, and permission
// can only be asked for from a tap — so enablePush() asks first, before any
// await that could lose the gesture.

import api from './api'

/* ─── Environment ────────────────────────────────────────────────────── */

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/* ─── Install prompt ─────────────────────────────────────────────────── */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | null = null
let installed = false
const installListeners = new Set<() => void>()
const notifyInstall = () => installListeners.forEach((fn) => fn())

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notifyInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    notifyInstall()
  })
}

/** For useSyncExternalStore. */
export function subscribeInstall(fn: () => void) {
  installListeners.add(fn)
  return () => {
    installListeners.delete(fn)
  }
}

/** 'installed' | 'prompt' (one-tap install available) | 'manual'. */
export function installStatus(): 'installed' | 'prompt' | 'manual' {
  if (installed || isStandalone()) return 'installed'
  return deferredPrompt ? 'prompt' : 'manual'
}

export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  deferredPrompt = null
  notifyInstall()
  return outcome === 'accepted'
}

/* ─── Service worker ─────────────────────────────────────────────────── */

let registration: Promise<ServiceWorkerRegistration | null> | null = null

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  registration ??= navigator.serviceWorker.register('/sw.js').catch(() => null)
  return registration
}

/* ─── Notifications ──────────────────────────────────────────────────── */

export type PushState =
  /** This browser cannot receive push at all. */
  | 'unsupported'
  /** iPhone in Safari: push only exists in the home-screen app. */
  | 'needs-install'
  /** The person, or the phone's settings, blocked notifications. */
  | 'denied'
  | 'off'
  | 'on'

function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registerServiceWorker()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function sameKey(sub: PushSubscription, publicKey: string): boolean {
  const current = sub.options.applicationServerKey
  if (!current) return false
  const a = new Uint8Array(current)
  const b = keyBytes(publicKey)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON()
  await api.post('/staff/push/subscriptions', {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
}

/** Must be called straight from a tap. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return pushState()
  // First, before anything awaits: iOS only honours a permission request
  // made directly inside the tap.
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'

  const reg = await registerServiceWorker()
  if (!reg) throw new Error('This browser could not start notifications.')
  await navigator.serviceWorker.ready

  const { data } = await api.get<{ publicKey: string }>('/staff/push/public-key')
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub, data.publicKey)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(data.publicKey),
  })
  await save(sub)
  return 'on'
}

/**
 * Re-send this device's subscription after sign-in. Keeps the server's copy
 * fresh, and moves a shared device over to whoever is now signed in.
 */
export async function syncPush(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const reg = await registerServiceWorker()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await save(sub)
}

/** Stop notifications on this device — on request, and on sign-out. */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return pushState()
  const reg = await registerServiceWorker()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api
      .post('/staff/push/subscriptions/remove', { endpoint: sub.endpoint })
      .catch(() => undefined)
    await sub.unsubscribe()
  }
  return pushState()
}

export async function sendTestPush(): Promise<number> {
  const { data } = await api.post<{ delivered: number }>('/staff/push/test', {})
  return data.delivered
}
