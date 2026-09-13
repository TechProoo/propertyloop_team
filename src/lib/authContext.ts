// Auth context, types and the hook that reads it.
//
// Split from auth.tsx so that file exports only the provider component —
// mixing components and plain functions in one module breaks Fast Refresh.

import { createContext, useContext } from 'react'
import type { Permission } from './permissions'
import type { Chapter, StaffRole } from './types'

/** The StaffProfile as /auth/login and /auth/me return it. */
export interface StaffProfileDto {
  id: string
  letter: string
  staffRole: StaffRole
  chapter: Chapter
  secondaryChapter: Chapter | null
  permissions: Permission[]
  active: boolean
}

export interface Account {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  staffProfile: StaffProfileDto | null
}

export interface AuthValue {
  account: Account | null
  /** True until the initial refresh has resolved, so we do not flash the form. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
