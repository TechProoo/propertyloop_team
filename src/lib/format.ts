import type { Staff, TargetUnit } from './types'

/** ₦12.5m / ₦850k / ₦4,200 — compact enough for a dense table. */
export function naira(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `₦${trimZero(amount / 1_000_000_000)}b`
  }
  if (amount >= 1_000_000) {
    return `₦${trimZero(amount / 1_000_000)}m`
  }
  if (amount >= 1_000) {
    return `₦${trimZero(amount / 1_000)}k`
  }
  return `₦${amount.toLocaleString('en-NG')}`
}

/** Full naira, for figures that should not be rounded away. */
export function nairaFull(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`
}

function trimZero(n: number): string {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function formatTargetValue(value: number, unit: TargetUnit): string {
  if (unit === 'NAIRA') return naira(value)
  if (unit === 'PERCENT') return `${value}%`
  return value.toLocaleString('en-NG')
}

export function displayName(staff: Staff): string {
  return staff.name ?? `Staff ${staff.letter}`
}

export function initials(staff: Staff): string {
  if (!staff.name) return staff.letter
  const parts = staff.name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "3 Sep", "3 Sep 2025" if it is not the current year. */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return d.toLocaleDateString('en-GB', opts)
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "2h ago", "3d ago", "just now". */
export function relative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}

/** Negative when overdue. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const ms = new Date(iso).getTime() - now.getTime()
  return Math.ceil(ms / 86_400_000)
}

/** "in 3 days", "today", "2 days overdue". */
export function dueLabel(iso: string, now: Date = new Date()): string {
  const days = daysUntil(iso, now)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1) return `in ${days} days`
  if (days === -1) return '1 day overdue'
  return `${Math.abs(days)} days overdue`
}

export function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100)
}

/* ─── Calendar days ──────────────────────────────────────────────────── */
// The daily log keys on the LOCAL calendar day, not UTC — someone logging
// work at 9pm in Lagos must land on today, not tomorrow.

export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** True when an ISO timestamp falls on the given YYYY-MM-DD local day. */
export function onDay(iso: string, day: string): boolean {
  return isoDate(new Date(iso)) === day
}

/** "Today", "Yesterday", otherwise "Mon 8 Sep". */
export function dayLabel(day: string, now: Date = new Date()): string {
  if (day === isoDate(now)) return 'Today'
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (day === isoDate(yesterday)) return 'Yesterday'
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** The last `count` calendar days, most recent first. */
export function recentDays(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) =>
    isoDate(new Date(now.getTime() - i * 86_400_000)),
  )
}

/** Weekends are not logged against — nobody is expected to file on Sunday. */
export function isWeekend(day: string): boolean {
  const [y, m, d] = day.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).getDay()
  return weekday === 0 || weekday === 6
}
