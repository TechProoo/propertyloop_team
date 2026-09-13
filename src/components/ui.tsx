// Shared presentational primitives.
//
// This is an internal tool used all day, so density and legibility come
// first — but flat white boxes made every screen look identical. Each area of
// the business now carries a hue (see Accent below), tiles are tinted rather
// than blank, and entrances are short. Colour is doing work here: it tells you
// which screen you are on before you read the title, and which numbers are in
// trouble before you read them.

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, MoveHorizontal, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ACCENT, avatarAccent } from '../lib/accent'
import type { Accent } from '../lib/accent'

/* ─── Layout ─────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
  accent = 'green',
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: LucideIcon
  accent?: Accent
}) {
  const a = ACCENT[accent]
  return (
    <header className="pl-rise mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[var(--shadow-tile)] ${a.gradient}`}
          >
            <Icon size={20} strokeWidth={1.75} />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl leading-tight text-ink sm:text-[1.75rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Card({
  children,
  className = '',
  padded = true,
  accent,
  hover = false,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  /** Draws a coloured rule along the top edge. */
  accent?: Accent
  hover?: boolean
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-tile)] transition-all duration-200 ${
        hover ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]' : ''
      } ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {accent && (
        <span
          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ACCENT[accent].gradient}`}
        />
      )}
      {children}
    </section>
  )
}

export function SectionTitle({
  children,
  hint,
  action,
  accent = 'green',
}: {
  children: ReactNode
  hint?: string
  action?: ReactNode
  accent?: Accent
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink uppercase">
          <span
            className={`h-3.5 w-1 rounded-full bg-gradient-to-b ${ACCENT[accent].gradient}`}
          />
          {children}
        </h2>
        {hint && <p className="mt-0.5 ml-3 text-xs text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/* ─── Stat ───────────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
  accent,
  icon: Icon,
  to,
}: {
  label: string
  value: string | number
  sub?: string
  /** Semantic override — wins over `accent` so a bad number always reads red. */
  tone?: 'default' | 'ok' | 'warn' | 'danger'
  accent?: Accent
  icon?: LucideIcon
  to?: string
}) {
  const resolved: Accent =
    tone === 'ok'
      ? 'green'
      : tone === 'warn'
        ? 'gold'
        : tone === 'danger'
          ? 'rose'
          : (accent ?? 'ink')
  const a = ACCENT[resolved]

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
          {label}
        </div>
        {Icon && (
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${a.bg} ${a.text}`}
          >
            <Icon size={14} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`mt-2 font-display text-[1.75rem] leading-none ${a.text}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs leading-snug text-ink-3">{sub}</div>}
    </>
  )

  const base = `relative overflow-hidden rounded-2xl border bg-surface p-4 shadow-[var(--shadow-tile)] ${a.border}`

  if (to) {
    return (
      <Link
        to={to}
        className={`${base} block transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]`}
      >
        {body}
      </Link>
    )
  }
  return <div className={base}>{body}</div>
}

/* ─── Badge ──────────────────────────────────────────────────────────── */

export type BadgeTone =
  | 'neutral'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'info'
  | 'accent'
  | 'violet'
  | 'teal'

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-line',
  ok: 'bg-green-soft text-green-ink ring-green/20',
  warn: 'bg-gold-soft text-gold-ink ring-gold/25',
  danger: 'bg-rose-soft text-rose-ink ring-rose/25',
  info: 'bg-blue-soft text-blue-ink ring-blue/20',
  accent: 'bg-gold-soft text-gold-ink ring-gold/25',
  violet: 'bg-violet-soft text-violet-ink ring-violet/20',
  teal: 'bg-teal-soft text-teal-ink ring-teal/20',
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: BadgeTone
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  )
}

/* ─── Progress ───────────────────────────────────────────────────────── */

export function Progress({
  value,
  tone,
  className = '',
}: {
  value: number
  tone?: BadgeTone
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const auto: BadgeTone = clamped >= 100 ? 'ok' : clamped >= 60 ? 'warn' : 'danger'
  const resolved = tone ?? auto
  const bar = {
    neutral: 'from-ink-3 to-ink-2',
    ok: 'from-green to-primary-light',
    warn: 'from-gold to-[#d9a44e]',
    accent: 'from-gold to-[#d9a44e]',
    danger: 'from-rose to-[#d9675c]',
    info: 'from-blue to-[#4a8fd4]',
    violet: 'from-violet to-[#9377d6]',
    teal: 'from-teal to-[#2aa8a5]',
  }[resolved]

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div
        className={`h-full origin-left rounded-full bg-gradient-to-r ${bar}`}
        style={{ width: `${clamped}%`, animation: 'pl-grow 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
      />
    </div>
  )
}

/* ─── Avatar ─────────────────────────────────────────────────────────── */

export function Avatar({
  initials,
  size = 'md',
  title,
  seed,
  ring = false,
}: {
  initials: string
  size?: 'sm' | 'md' | 'lg'
  title?: string
  /** Usually the staff id. Falls back to the initials. */
  seed?: string
  ring?: boolean
}) {
  const dims = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-11 w-11 text-sm',
  }[size]
  const a = ACCENT[avatarAccent(seed ?? initials)]

  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${a.gradient} ${dims} ${
        ring ? 'ring-2 ring-white' : ''
      }`}
    >
      {initials}
    </span>
  )
}

/* ─── Buttons ────────────────────────────────────────────────────────── */

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  disabled,
  title,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
  className?: string
}) {
  const variants = {
    primary:
      'bg-gradient-to-b from-primary-light to-primary text-white shadow-[var(--shadow-tile)] hover:from-primary hover:to-primary-ink active:translate-y-px',
    secondary:
      'border border-line bg-surface text-ink shadow-[var(--shadow-tile)] hover:border-primary/40 hover:text-primary active:translate-y-px',
    ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
    danger:
      'border border-rose/30 bg-rose-soft/50 text-rose-ink hover:bg-rose-soft active:translate-y-px',
  }[variant]
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm' }[size]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${variants} ${sizes} ${className}`}
    >
      {children}
    </button>
  )
}

/* ─── Form fields ────────────────────────────────────────────────────── */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

const CONTROL =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15'

export function Select({
  value,
  onChange,
  children,
  className = '',
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} ${className}`}
    >
      {children}
    </select>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${CONTROL} ${className}`}
    />
  )
}

/* ─── Modal ──────────────────────────────────────────────────────────── */

export function Modal({
  title,
  subtitle,
  accent = 'green',
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  accent?: Accent
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  // Escape closes. Body scroll is locked so the page behind does not drift
  // while a long form is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="pl-fade absolute inset-0 bg-ink/45 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pl-rise relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[var(--shadow-lift)] sm:rounded-3xl"
      >
        <header
          className={`flex items-start justify-between gap-3 bg-gradient-to-br px-5 py-4 text-white ${ACCENT[accent].gradient}`}
        >
          <div>
            <h2 className="font-display text-xl leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-white/75">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ─── Textarea & number ──────────────────────────────────────────────── */

export function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} resize-y leading-relaxed`}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  min = 0,
  ariaLabel,
}: {
  /** Empty string means "not given", which is different from zero. */
  value: string
  onChange: (v: string) => void
  placeholder?: string
  min?: number
  ariaLabel?: string
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={CONTROL}
    />
  )
}

/** Checkbox that reads as a chip — used for document checklists. */
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
        checked
          ? 'border-primary bg-primary-soft text-primary-ink'
          : 'border-line text-ink-2 hover:-translate-y-px hover:border-primary/40'
      }`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${
          checked ? 'border-primary bg-primary text-white' : 'border-line'
        }`}
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────── */

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-2/30 px-4 py-10 text-center text-sm text-ink-3">
      {children}
    </div>
  )
}

/* ─── Note ───────────────────────────────────────────────────────────── */

/**
 * A standing caveat about the data or the wiring. Used sparingly — the point
 * is that a person reading a number should know where it came from.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-line bg-gradient-to-br from-surface-2/60 to-surface-2/20 px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
      {children}
    </p>
  )
}

/* ─── Table ──────────────────────────────────────────────────────────── */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-tile)]">
        {children}
      </div>
      {/* These tables carry seven or eight columns and cannot honestly fit a
          phone. They scroll, but a reader who cannot see the edge assumes the
          columns are missing rather than off-screen — so say so, on the sizes
          where it is actually true. */}
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-3 lg:hidden">
        <MoveHorizontal size={11} strokeWidth={2} />
        Swipe the table sideways for more columns
      </p>
    </div>
  )
}

export function Th({
  children,
  className = '',
}: {
  /** Optional so a table can carry an unlabelled action column. */
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      className={`border-b border-line bg-surface-2/40 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-ink-3 uppercase whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
  colSpan,
}: {
  children?: ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-line px-3 py-2.5 text-sm text-ink ${className}`}
    >
      {children}
    </td>
  )
}

/** Row wrapper that tints on hover — makes long tables scannable. */
export function Tr({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <tr className={`transition-colors hover:bg-surface-2/40 ${className}`}>
      {children}
    </tr>
  )
}
