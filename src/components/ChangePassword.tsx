import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import api, { apiErrorMessage } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { Button, Modal, Note } from './ui'

/**
 * Change your own password.
 *
 * The temporary one arrived over WhatsApp or on paper, so it has effectively
 * been published — this is where each person replaces it with one only they
 * know. The API ends every session on a change, including this one, so the
 * portal signs straight back in with the new password rather than dropping
 * the person at the sign-in screen a few minutes later.
 */

/** The API's rule for a chosen password. */
function problemWith(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters'
  if (!/[a-z]/.test(pw)) return 'Add a small letter'
  if (!/[A-Z]/.test(pw)) return 'Add a capital letter'
  if (!/\d/.test(pw)) return 'Add a number'
  return null
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  hint?: string | null
}) {
  const [shown, setShown] = useState(false)
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
          {label}
        </span>
        <span className="relative block">
          <input
            type={shown ? 'text' : 'password'}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 pr-11 text-sm text-ink outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {shown ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </span>
      </label>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

export function ChangePassword({ onClose }: { onClose: () => void }) {
  const { account, signIn } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const rule = next ? problemWith(next) : null
  const mismatch = confirm !== '' && confirm !== next
  const valid = current.trim() !== '' && next !== '' && !rule && confirm === next

  async function submit() {
    if (!valid || busy || !account) return
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/change-password', {
        currentPassword: current.trim(),
        newPassword: next,
      })
    } catch (e) {
      setError(apiErrorMessage(e, 'Your password could not be changed.'))
      setBusy(false)
      return
    }
    try {
      await signIn(account.email, next)
    } catch {
      // The change itself succeeded; only the automatic sign-in did not. The
      // sign-in screen will appear, and the new password is what works there.
    }
    setBusy(false)
    setDone(true)
  }

  if (done) {
    return (
      <Modal title="Password changed" accent="green" onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}
      >
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-ink-2">
            Use your new password from now on. Any other phone or computer you were
            signed in on has been signed out and will ask for it.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Change password"
      subtitle="Replace the temporary password you were given"
      accent="blue"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!valid || busy}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <PasswordField
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint={rule ?? 'At least 8 characters, with a capital letter, a small letter and a number.'}
        />
        <PasswordField
          label="Type it again"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          hint={mismatch ? 'The two do not match yet.' : null}
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <Note>
          Pick something you will remember but nobody could guess from your name.
          If you forget it, the MD can issue a new temporary one.
        </Note>
      </div>
    </Modal>
  )
}
