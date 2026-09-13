import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarClock,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  Contact,
  LogOut,
  Menu,
  MessageSquare,
  NotebookPen,
  Send,
  Target as TargetIcon,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../lib/storeContext'
import { useAuth } from '../lib/authContext'
import { totalUnread } from '../lib/metrics'
import { canAny } from '../lib/permissions'
import type { Permission } from '../lib/permissions'
import { displayName, initials, isoDate } from '../lib/format'
import { STAFF_ROLE_SHORT } from '../lib/types'
import { Avatar } from './ui'
import type { Accent } from '../lib/accent'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** The section's colour, carried through to its page header. */
  accent: Accent
  /** Shown when the signed-in role holds ANY of these. Empty = always. */
  permissions: Permission[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, accent: 'green', permissions: [] },
  {
    to: '/deals',
    label: 'Deals & mandates',
    icon: Handshake,
    accent: 'gold',
    permissions: ['MANAGE_DEALS'],
  },
  {
    to: '/properties',
    label: 'Properties',
    icon: Building2,
    accent: 'green',
    permissions: ['MANAGE_PROPERTIES'],
  },
  {
    to: '/leads',
    label: 'Leads',
    icon: ClipboardList,
    accent: 'blue',
    permissions: ['MANAGE_LEADS'],
  },
  {
    to: '/content',
    label: 'Content & shoots',
    icon: CalendarClock,
    accent: 'violet',
    permissions: ['MANAGE_CONTENT'],
  },
  {
    to: '/ops',
    label: 'Operations',
    icon: ClipboardList,
    accent: 'rose',
    permissions: ['HANDLE_OPS'],
  },
  {
    to: '/partners',
    label: 'Agent partners',
    icon: Contact,
    accent: 'teal',
    permissions: ['MANAGE_LEADS'],
  },
  { to: '/threads', label: 'Threads', icon: MessageSquare, accent: 'teal', permissions: [] },
  { to: '/messages', label: 'Messages', icon: Send, accent: 'teal', permissions: [] },
  { to: '/logs', label: 'Daily log', icon: NotebookPen, accent: 'violet', permissions: [] },
  { to: '/targets', label: 'Targets', icon: TargetIcon, accent: 'gold', permissions: [] },
  { to: '/team', label: 'Team', icon: Users, accent: 'blue', permissions: [] },
]

/** Icon tint inside the dark sidebar — brighter than the page-level hues. */
const NAV_ICON: Record<Accent, string> = {
  green: 'text-emerald-300',
  gold: 'text-amber-300',
  blue: 'text-sky-300',
  violet: 'text-violet-300',
  rose: 'text-rose-300',
  teal: 'text-teal-300',
  ink: 'text-white/70',
}

export function Layout() {
  const { currentUser, ops, threads, channels, logs } = useStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!currentUser) return null

  const visible = NAV.filter(
    (item) => item.permissions.length === 0 || canAny(currentUser, item.permissions),
  )

  const myOpenOps = ops.filter(
    (o) => !o.resolved && o.assigneeId === currentUser.id,
  ).length
  const myThreads = threads.filter(
    (t) => !t.resolved && t.participantIds.includes(currentUser.id),
  ).length

  const unreadMessages = totalUnread(channels, currentUser.id)
  // A dot rather than a count: the nudge is "you have not filed today", and a
  // number would imply a backlog that does not exist.
  const logFiledToday = logs.some(
    (l) => l.staffId === currentUser.id && l.date === isoDate(),
  )

  const badgeFor = (to: string): number => {
    if (to === '/ops') return myOpenOps
    if (to === '/threads') return myThreads
    if (to === '/messages') return unreadMessages
    return 0
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {visible.map((item) => {
        const Icon = item.icon
        const count = badgeFor(item.to)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-white/12 font-semibold text-white'
                  : 'text-white/65 hover:bg-white/6 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-amber-300 to-amber-500" />
                )}
                <Icon
                  size={16}
                  strokeWidth={1.9}
                  className={`shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? NAV_ICON[item.accent] : 'text-white/50'
                  }`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                    {count}
                  </span>
                )}
                {item.to === '/logs' && !logFiledToday && (
                  <span
                    title="No entry filed today"
                    className="pl-pulse h-1.5 w-1.5 rounded-full bg-amber-300"
                  />
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )

  const identity = (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5">
      <Avatar
        initials={initials(currentUser)}
        seed={currentUser.id}
        title={displayName(currentUser)}
        ring
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {displayName(currentUser)}
        </div>
        <div className="truncate text-[11px] text-white/55">
          {STAFF_ROLE_SHORT[currentUser.role]}
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        title="Sign out"
        className="rounded-lg p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut size={16} strokeWidth={1.75} />
      </button>
    </div>
  )

  const sidebarSkin =
    'bg-gradient-to-b from-primary-ink via-primary-dark to-[#0b2a19]'

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar. self-start stops the flex row stretching it to the
          full page height, which would leave nothing for sticky to pin. */}
      <aside
        className={`sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start p-3 lg:flex ${sidebarSkin}`}
      >
        <Brand dark />
        <div className="mt-5 flex-1 overflow-y-auto">{nav}</div>
        {identity}
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="pl-fade absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <aside
            className={`pl-rise relative flex h-full w-64 flex-col p-3 ${sidebarSkin}`}
          >
            <div className="flex items-center justify-between">
              <Brand dark />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex-1 overflow-y-auto">{nav}</div>
            {identity}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-1.5 text-ink-2 transition-colors hover:bg-surface-2"
          >
            <Menu size={20} />
          </button>
          <Brand compact />
          {unreadMessages > 0 && (
            <span className="ml-auto rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-white">
              {unreadMessages}
            </span>
          )}
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Brand({
  compact = false,
  dark = false,
}: {
  compact?: boolean
  dark?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <img
        src="/logo.png"
        alt=""
        className={`h-8 w-8 rounded-lg object-contain ${dark ? 'bg-white/95 p-0.5' : ''}`}
      />
      <div className="leading-tight">
        <div
          className={`font-display text-sm ${dark ? 'text-white' : 'text-ink'}`}
        >
          PropertyLoop
        </div>
        {!compact && (
          <div
            className={`text-[10px] tracking-[0.14em] uppercase ${
              dark ? 'text-amber-300/80' : 'text-ink-3'
            }`}
          >
            Team portal
          </div>
        )}
      </div>
    </div>
  )
}
