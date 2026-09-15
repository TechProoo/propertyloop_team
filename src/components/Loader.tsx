import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { isBusy, isOnline, subscribeActivity, subscribeOnline } from '../lib/network'

/**
 * Loading states for a slow connection.
 *
 * Staff open this on phone data in traffic as often as on office Wi-Fi. A
 * blank screen or an empty list on a slow line reads as "broken" or "nothing
 * here", so every wait says what is happening — and, when it drags past a few
 * seconds, that the connection is the reason and waiting will work.
 */

/** Appears only once a wait has gone on long enough to need explaining. */
function SlowHint({ className = '' }: { className?: string }) {
  return (
    <p className={`pl-delayed text-xs leading-relaxed text-ink-3 ${className}`}>
      Still loading — your connection seems slow. Keep this page open.
    </p>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-line border-t-primary ${className}`}
    />
  )
}

/** Before anything else is on screen: the sign-in check on first open. */
export function FullScreenLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <div className="relative">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-16 w-16 rounded-2xl shadow-[var(--shadow-lift)]"
        />
        <Spinner className="absolute -right-2 -bottom-2 h-6 w-6 bg-surface" />
      </div>
      <div>
        <p className="font-display text-lg text-ink">PropertyLoop Team</p>
        <p className="mt-1 text-sm text-ink-3">{label}</p>
      </div>
      <SlowHint className="max-w-xs" />
    </div>
  )
}

function Block({ className }: { className: string }) {
  return <div className={`pl-shimmer rounded-2xl ${className}`} />
}

/**
 * The first data load inside the portal. Shaped like a page rather than a
 * lone spinner, so the screen does not jump when the real content lands.
 */
export function PageLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <div className="mb-5 flex items-center gap-2.5 text-sm text-ink-3">
        <Spinner className="h-4 w-4" />
        {label}
      </div>
      <Block className="h-28 sm:h-32" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="hidden h-24 sm:block" />
        <Block className="hidden h-24 sm:block" />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Block className="h-56" />
        <Block className="hidden h-56 lg:block" />
      </div>
      <SlowHint className="mt-5" />
    </div>
  )
}

/**
 * A thin bar across the top while anything is loading or saving. Shown only
 * after a short delay, so quick requests never flicker it on and off.
 */
export function NetworkBar() {
  const busy = useSyncExternalStore(subscribeActivity, isBusy, () => false)
  if (!busy) return null
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="pl-delayed-short pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-primary/15"
    >
      <div className="pl-indeterminate h-full w-1/3 rounded-full bg-gradient-to-r from-primary-light via-primary to-amber-400" />
    </div>
  )
}

/** Said plainly, because a save on a dead connection otherwise just fails. */
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true)
  if (online) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-center text-xs font-medium text-white sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-full sm:px-5"
    >
      <WifiOff size={14} className="shrink-0" />
      You are offline. Changes will not save until your connection is back.
    </div>
  )
}
