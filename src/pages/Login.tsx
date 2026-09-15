import { useState } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../lib/authContext'
import { Note } from '../components/ui'
import { useDocumentTitle } from '../lib/title'

/**
 * Staff sign-in.
 *
 * Email and password, checked against the API. Credentials come from
 * backend/scripts/provision-staff.ts, which issues a unique temporary
 * password per person.
 *
 * There is no account list on this screen on purpose. The old role picker
 * published the whole org chart to anyone who opened the URL, which is a
 * gift to somebody guessing at passwords.
 */
export function Login() {
  const { signIn } = useAuth()
  useDocumentTitle('Sign in')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = email.trim() !== '' && password !== ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setError(null)
    setBusy(true)
    try {
      // Staff passwords are generated from letters, digits and "-" only, so
      // nothing a real one contains is touched here. What this undoes is a
      // phone keyboard's doing: a space added by an accepted suggestion, or a
      // hyphen swapped for a dash — invisible on screen, and enough to fail.
      const typed = password.trim().replace(/[‐-―−]/g, '-')
      await signIn(email, typed)
      // No navigate() — the router swaps to the portal as soon as the auth
      // context holds an account.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign you in.'
      // The server's wording is deliberately vague. The usual real cause is
      // one letter typed in the wrong case — say so, and say what to do next.
      setError(
        /invalid email or password/i.test(message)
          ? 'That email and password do not match. Passwords are case-sensitive, so check capital and small letters. If it still fails, ask the MD to reset your password from the Team screen.'
          : message,
      )
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <section className="pl-rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-ink via-primary to-primary-light p-7 text-white shadow-[var(--shadow-lift)]">
          <span className="pointer-events-none absolute -top-20 -right-12 h-52 w-52 rounded-full bg-amber-300/20 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt=""
              className="h-12 w-12 rounded-2xl bg-white/95 object-contain p-1"
            />
            <div>
              <h1 className="font-display text-2xl leading-tight">
                PropertyLoop Team
              </h1>
              <p className="mt-0.5 text-[11px] tracking-[0.16em] text-amber-300 uppercase">
                Staff portal
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={submit}
          className="pl-rise mt-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-tile)]"
        >
          <h2 className="font-display text-lg text-ink">Sign in</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            Use the email and password you were given. If you have not been set
            up yet, ask the MD.
          </p>

          <div className="mt-5 grid gap-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                Email
              </span>
              <input
                type="email"
                autoComplete="username"
                // Phones otherwise capitalise, "correct" or suggest into the
                // address, and the sign-in fails for no visible reason.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@propertyloop.ng"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                Password
              </span>
              <span className="relative block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  // With the password shown it becomes a text box, and iOS
                  // will capitalise or autocorrect it — a password that looks
                  // right on screen and is rejected.
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 pr-11 text-sm text-ink outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </span>
            </label>
          </div>

          {error && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose/25 bg-rose-soft/40 px-3.5 py-3 text-xs leading-relaxed text-rose-ink">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!valid || busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary-light to-primary px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-tile)] transition-all hover:from-primary hover:to-primary-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn size={15} />
                Sign in
              </>
            )}
          </button>
        </form>

        <div className="mt-4">
          <Note>
            Your password was issued for you alone and is not recoverable — if
            you have lost it, the MD can issue a new one. Change it after your
            first sign-in, especially if it reached you over WhatsApp.
          </Note>
        </div>
      </div>
    </div>
  )
}
