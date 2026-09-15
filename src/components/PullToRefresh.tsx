import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { isStandalone } from '../lib/push'

/**
 * Pull down to refresh, in the home-screen app.
 *
 * Opened from the home screen there is no browser around the portal — no
 * address bar, no reload button — so without this the only way to see new
 * work is to close the app from the app switcher. In a normal browser tab the
 * browser's own refresh is left alone.
 */

/** How far (after easing) the pull must travel before letting go reloads. */
const TRIGGER = 70
const MAX = 110

/** True when neither the page nor anything under the finger is scrolled down. */
function atTop(target: EventTarget | null): boolean {
  if (window.scrollY > 0) return false
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    const { overflowY } = window.getComputedStyle(el)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight &&
      el.scrollTop > 0
    ) {
      return false
    }
    el = el.parentElement
  }
  return true
}

export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [reloading, setReloading] = useState(false)
  const startY = useRef<number | null>(null)
  const distance = useRef(0)

  useEffect(() => {
    if (!isStandalone()) return

    const onStart = (e: TouchEvent) => {
      // A modal locks the page's scroll; a pull inside one is the modal's own.
      const locked = document.body.style.overflow === 'hidden'
      startY.current =
        e.touches.length === 1 && !locked && atTop(e.target) ? e.touches[0].clientY : null
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      distance.current = dy > 0 ? Math.min(MAX, dy * 0.5) : 0
      setPull(distance.current)
    }

    const onEnd = () => {
      if (startY.current === null) return
      startY.current = null
      if (distance.current >= TRIGGER) {
        setReloading(true)
        window.location.reload()
      } else {
        setPull(0)
      }
      distance.current = 0
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (pull === 0 && !reloading) return null

  const ready = reloading || pull >= TRIGGER
  const shown = reloading ? MAX : pull

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top, 0px) + ${Math.round(shown / 3)}px)` }}
    >
      <div
        className={`flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-medium shadow-[var(--shadow-lift)] ${
          ready ? 'text-primary' : 'text-ink-3'
        }`}
        style={{ opacity: Math.min(1, shown / TRIGGER) }}
      >
        <RotateCw
          size={15}
          className={reloading ? 'animate-spin' : ''}
          style={reloading ? undefined : { transform: `rotate(${Math.round(shown * 3)}deg)` }}
        />
        {reloading ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
      </div>
    </div>
  )
}
