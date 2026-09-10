import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/storeContext'
import { displayName, initials } from '../lib/format'
import { STAFF_ROLE_LABEL } from '../lib/types'
import { Avatar, Note } from '../components/ui'

/**
 * Role picker standing in for sign-in.
 *
 * There is no authentication here on purpose — the backend has no staff
 * accounts yet (Role is BUYER | AGENT | VENDOR | ADMIN, with no staff
 * concept), so there is nothing to authenticate against. Picking a person
 * here shows the portal as that role would see it, which is what makes the
 * permission boundaries reviewable before they are built for real.
 */
export function Login() {
  const { staff, signIn } = useStore()
  const navigate = useNavigate()

  function pick(id: string) {
    signIn(id)
    navigate('/')
  }

  // A deactivated position cannot be signed into — it keeps its history but
  // is no longer somebody who works here.
  const active = staff.filter((s) => s.active)
  const lagos = active.filter((s) => s.chapter === 'LAGOS')
  const osun = active.filter((s) => s.chapter === 'OSUN')
  const hidden = staff.length - active.length

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-12">
      <section className="pl-rise relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-ink via-primary to-primary-light p-7 text-white shadow-[var(--shadow-lift)]">
        <span className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <img
            src="/logo.png"
            alt=""
            className="h-14 w-14 rounded-2xl bg-white/95 object-contain p-1"
          />
          <div>
            <h1 className="font-display text-3xl leading-tight">PropertyLoop Team</h1>
            <p className="mt-1 text-sm text-white/70">
              Internal portal — September 2026 structure
            </p>
          </div>
        </div>
      </section>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-ink uppercase">
        <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-green to-primary-light" />
        Lagos — head office
      </h2>
      <div className="pl-stagger mb-6 grid gap-2 sm:grid-cols-2">
        {lagos.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-[var(--shadow-tile)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-lift)]"
          >
            <Avatar initials={initials(s)} size="lg" seed={s.id} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">
                {displayName(s)}
              </div>
              <div className="truncate text-xs text-ink-3">
                {STAFF_ROLE_LABEL[s.role]}
              </div>
            </div>
          </button>
        ))}
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-ink uppercase">
        <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-violet to-[#9377d6]" />
        Osun state chapter
      </h2>
      <div className="pl-stagger mb-8 grid gap-2 sm:grid-cols-2">
        {osun.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-[var(--shadow-tile)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-lift)]"
          >
            <Avatar initials={initials(s)} size="lg" seed={s.id} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">
                {displayName(s)}
              </div>
              <div className="truncate text-xs text-ink-3">
                {STAFF_ROLE_LABEL[s.role]}
              </div>
            </div>
          </button>
        ))}
      </div>

      {hidden > 0 && (
        <p className="mb-3 text-xs text-ink-3">
          {hidden} deactivated {hidden === 1 ? 'position is' : 'positions are'} not
          shown.
        </p>
      )}

      <Note>
        This is a frontend shell. There is no password and no session — picking
        a name shows the portal as that role would see it. Every figure inside
        is invented sample data, and the permission gating shapes the interface
        only; it does not secure anything until staff roles exist in the API.
      </Note>
    </div>
  )
}
