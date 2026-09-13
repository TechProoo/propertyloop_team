// Authentication for the team portal.
//
// Staff sign in with the email and password provisioned by
// backend/scripts/provision-staff.ts. Access is gated on the StaffProfile the
// API returns, NOT on the marketplace Role — a buyer account with a staff
// profile belongs here; an ADMIN without one does not.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import api, { apiErrorMessage, setAuthLostHandler, tokens } from './api'
import { AuthContext } from './authContext'
import type { Account } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthLostHandler(() => {
      tokens.clear()
      setAccount(null)
    })
    return () => setAuthLostHandler(null)
  }, [])

  // Bootstrap. The access token is memory-only, so a reload has none — the
  // refresh cookie is what carries the session across it.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const { data } = await api.post<{ accessToken: string }>(
          '/auth/refresh',
          {},
        )
        tokens.set(data.accessToken)
        const me = await api.get<Account>('/auth/me')
        if (!cancelled) setAccount(me.data)
      } catch {
        // No session, or the server is unreachable. Either way the sign-in
        // screen is the right destination.
        if (!cancelled) {
          tokens.clear()
          setAccount(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ accessToken: string; user: Account }>(
        '/auth/login',
        { email: email.trim().toLowerCase(), password },
      )
      tokens.set(data.accessToken)

      // Gate on the staff profile rather than the marketplace role. Signing
      // somebody in and then showing them an empty portal would be worse
      // than telling them plainly that this is not their tool.
      if (!data.user.staffProfile) {
        await api.post('/auth/logout', {}).catch(() => undefined)
        tokens.clear()
        throw new Error(
          'That account is not set up for the team portal. Ask the MD to add you.',
        )
      }
      if (!data.user.staffProfile.active) {
        await api.post('/auth/logout', {}).catch(() => undefined)
        tokens.clear()
        throw new Error(
          'Your staff access has been deactivated. Speak to the MD if this is wrong.',
        )
      }

      setAccount(data.user)
    } catch (error) {
      tokens.clear()
      if (error instanceof Error && !('response' in error)) throw error
      throw new Error(
        apiErrorMessage(error, 'Could not sign you in. Check your details.'),
        { cause: error },
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    // Clear locally first: a failed logout call must not leave somebody
    // looking at a portal they have asked to leave.
    tokens.clear()
    setAccount(null)
    await api.post('/auth/logout', {}).catch(() => undefined)
  }, [])

  const value = useMemo(
    () => ({ account, loading, signIn, signOut }),
    [account, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
