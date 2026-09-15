import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import {
  Bell,
  BellOff,
  CheckCircle2,
  Download,
  Share,
  Smartphone,
  SquarePlus,
  X,
} from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import {
  disablePush,
  enablePush,
  installStatus,
  isAndroid,
  isIos,
  promptInstall,
  pushState,
  sendTestPush,
  subscribeInstall,
} from '../lib/push'
import type { PushState } from '../lib/push'
import { Button, Card, Modal, Note } from './ui'

/**
 * Getting the portal onto a phone, and turning its notifications on.
 *
 * One panel for both because on iPhone they are one job: notifications only
 * exist inside the app added to the home screen, so "install" is step one of
 * "notify me".
 */

function usePhoneApp() {
  const install = useSyncExternalStore(subscribeInstall, installStatus, () => 'manual' as const)
  const [push, setPush] = useState<PushState | null>(null)

  useEffect(() => {
    let alive = true
    pushState().then((s) => {
      if (alive) setPush(s)
    })
    return () => {
      alive = false
    }
  }, [])

  return { install, push, setPush }
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span className="text-sm leading-relaxed text-ink-2">{children}</span>
    </li>
  )
}

function InstallSection({ install }: { install: ReturnType<typeof installStatus> }) {
  const [busy, setBusy] = useState(false)

  if (install === 'installed') {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <CheckCircle2 size={16} className="shrink-0 text-primary" />
        You are using the PL Team app.
      </p>
    )
  }

  if (install === 'prompt') {
    return (
      <div>
        <p className="text-sm leading-relaxed text-ink-2">
          Add PL Team to your home screen. It opens full-screen like any other app.
        </p>
        <div className="mt-3">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void promptInstall().finally(() => setBusy(false))
            }}
          >
            <Download size={15} />
            Install PL Team
          </Button>
        </div>
      </div>
    )
  }

  if (isIos()) {
    return (
      <ol className="flex flex-col gap-2">
        <Step n={1}>
          Open <strong className="font-semibold text-ink">team.propertyloop.ng</strong> in{' '}
          <strong className="font-semibold text-ink">Safari</strong>. Other browsers on
          iPhone cannot add it.
        </Step>
        <Step n={2}>
          Tap the <Share size={13} className="inline -translate-y-px" />{' '}
          <strong className="font-semibold text-ink">Share</strong> button.
        </Step>
        <Step n={3}>
          Tap <SquarePlus size={13} className="inline -translate-y-px" />{' '}
          <strong className="font-semibold text-ink">Add to Home Screen</strong>, then{' '}
          <strong className="font-semibold text-ink">Add</strong>.
        </Step>
        <Step n={4}>
          Open <strong className="font-semibold text-ink">PL Team</strong> from your home
          screen and sign in once more.
        </Step>
      </ol>
    )
  }

  return (
    <ol className="flex flex-col gap-2">
      <Step n={1}>
        Open <strong className="font-semibold text-ink">team.propertyloop.ng</strong> in{' '}
        <strong className="font-semibold text-ink">
          {isAndroid() ? 'Chrome' : 'Chrome or Edge'}
        </strong>
        .
      </Step>
      <Step n={2}>
        {isAndroid() ? (
          <>
            Tap the <strong className="font-semibold text-ink">⋮</strong> menu, then{' '}
            <strong className="font-semibold text-ink">Install app</strong> (or{' '}
            <strong className="font-semibold text-ink">Add to Home screen</strong>).
          </>
        ) : (
          <>
            Click the install icon at the right of the address bar, or the browser menu
            → <strong className="font-semibold text-ink">Install PropertyLoop Team</strong>.
          </>
        )}
      </Step>
    </ol>
  )
}

function NotificationSection({
  push,
  setPush,
}: {
  push: PushState | null
  setPush: (s: PushState) => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (e) {
      setError(apiErrorMessage(e, 'That did not work. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (push === null) return <p className="text-sm text-ink-3">Checking this device…</p>

  if (push === 'needs-install') {
    return (
      <p className="text-sm leading-relaxed text-ink-2">
        On iPhone, notifications work only in the app on your home screen. Add it using
        the steps above, open <strong className="font-semibold text-ink">PL Team</strong>{' '}
        from your home screen, then come back here to turn them on.
      </p>
    )
  }

  if (push === 'unsupported') {
    return (
      <p className="text-sm leading-relaxed text-ink-2">
        This browser cannot show notifications. On Android use Chrome; on iPhone use the
        app added from Safari (iOS 16.4 or newer).
      </p>
    )
  }

  if (push === 'denied') {
    return (
      <div className="text-sm leading-relaxed text-ink-2">
        <p>Notifications are blocked on this device. To allow them:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="font-semibold text-ink">iPhone:</strong> Settings →
            Notifications → PL Team → Allow Notifications.
          </li>
          <li>
            <strong className="font-semibold text-ink">Android:</strong> press and hold the PL
            Team icon → App info → Notifications → On.
          </li>
          <li>
            <strong className="font-semibold text-ink">Computer:</strong> click the icon left
            of the address bar → Notifications → Allow.
          </li>
        </ul>
        <p className="mt-2">Then close and reopen PL Team.</p>
      </div>
    )
  }

  return (
    <div>
      {push === 'on' ? (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Bell size={16} className="shrink-0 text-primary" />
          Notifications are on for this device.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-ink-2">
          Get a notification on this device when a message arrives or work is assigned to
          you.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {push === 'off' ? (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const next = await enablePush()
                setPush(next)
                if (next === 'on') setMessage('Done. Send yourself a test to check.')
              })
            }
          >
            <Bell size={15} />
            Turn on notifications
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const delivered = await sendTestPush()
                  setMessage(
                    delivered > 0
                      ? 'Test sent. It should appear in a few seconds.'
                      : 'No device received it. Turn notifications off and on again.',
                  )
                })
              }
            >
              Send a test
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void run(async () => setPush(await disablePush()))}
            >
              <BellOff size={15} />
              Turn off
            </Button>
          </>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-primary">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

export function PhoneAppModal({ onClose }: { onClose: () => void }) {
  const { install, push, setPush } = usePhoneApp()

  return (
    <Modal
      title="Phone app & notifications"
      subtitle="PL Team on your home screen, telling you when something needs you"
      accent="green"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="grid gap-5">
        <section>
          <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-ink-2 uppercase">
            <Smartphone size={14} />
            1 · Add to your home screen
          </h3>
          <InstallSection install={install} />
        </section>

        <section className="border-t border-line pt-4">
          <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-ink-2 uppercase">
            <Bell size={14} />
            2 · Notifications
          </h3>
          <NotificationSection push={push} setPush={setPush} />
        </section>

        <Note>
          You are notified about messages to you, work assigned to you, and anything your
          position is responsible for acting on — new enquiries, KYC, disputes, properties
          to review and so on. Not about your own actions. Each phone or computer is
          switched on separately.
        </Note>
      </div>
    </Modal>
  )
}

const BANNER_KEY = 'pl-team-phone-banner-dismissed'

function bannerDismissed(): boolean {
  try {
    return window.localStorage.getItem(BANNER_KEY) === '1'
  } catch {
    return false
  }
}

/** The dashboard nudge, until notifications are on or it is dismissed. */
export function PhoneAppBanner() {
  const { install, push, setPush } = usePhoneApp()
  const [dismissed, setDismissed] = useState(bannerDismissed)
  const [open, setOpen] = useState(false)

  const close = () => {
    setOpen(false)
    // The panel may have just turned notifications on.
    pushState().then(setPush)
  }
  const modal = open ? <PhoneAppModal onClose={close} /> : null

  // Nothing to nudge about: already on, impossible here, still checking,
  // or the person said no thanks.
  if (dismissed || push === null || push === 'on' || push === 'unsupported') return modal

  return (
    <>
      {modal}
      <Card accent="green" className="mb-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">
              {install === 'installed'
                ? 'Turn on notifications'
                : 'Get PL Team on your phone'}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              {install === 'installed'
                ? 'Be told the moment a message arrives or work is assigned to you.'
                : 'Add it to your home screen and turn on notifications, so you hear about messages and new work straight away.'}
            </p>
            <div className="mt-2.5">
              <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                Set it up
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={() => {
              try {
                window.localStorage.setItem(BANNER_KEY, '1')
              } catch {
                // Private browsing: it will simply show again next time.
              }
              setDismissed(true)
            }}
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
      </Card>
    </>
  )
}
