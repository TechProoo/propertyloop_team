import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { StoreProvider } from './lib/store'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/authContext'
import { useStore } from './lib/storeContext'
import { canAny } from './lib/permissions'
import type { Permission } from './lib/permissions'
import { Layout } from './components/Layout'
import { FullScreenLoader, NetworkBar, OfflineNotice } from './components/Loader'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Deals } from './pages/Deals'
import { Properties } from './pages/Properties'
import { Leads } from './pages/Leads'
import { Content } from './pages/Content'
import { Ops } from './pages/Ops'
import { Threads } from './pages/Threads'
import { Logs } from './pages/Logs'
import { Messages } from './pages/Messages'
import { Targets } from './pages/Targets'
import { Team } from './pages/Team'
import { Partners } from './pages/Partners'

/** Redirects to sign-in when nobody is selected. */
function RequireAuth({ children }: { children: ReactElement }) {
  const { account, loading } = useAuth()
  // Hold the route while the refresh cookie is being exchanged, or a reload
  // bounces a signed-in person to the sign-in screen for a frame.
  if (loading) return <Booting />
  if (!account?.staffProfile) return <Navigate to="/login" replace />
  return children
}

function Booting() {
  // On a cold start or a slow line this can take a while: the refresh call
  // waits on the API waking up.
  return <FullScreenLoader label="Signing you in…" />
}

/**
 * Sends a role without the required access back to the dashboard rather than
 * showing an empty screen. The navigation already hides these links; this is
 * the direct-URL case.
 */
function RequirePermission({
  permissions,
  children,
}: {
  permissions: Permission[]
  children: ReactElement
}) {
  const { currentUser } = useStore()
  if (!currentUser) return <Navigate to="/login" replace />
  if (!canAny(currentUser, permissions)) return <Navigate to="/" replace />
  return children
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="deals"
          element={
            <RequirePermission permissions={['MANAGE_DEALS']}>
              <Deals />
            </RequirePermission>
          }
        />
        <Route
          path="properties"
          element={
            <RequirePermission permissions={['MANAGE_PROPERTIES']}>
              <Properties />
            </RequirePermission>
          }
        />
        <Route
          path="leads"
          element={
            <RequirePermission permissions={['MANAGE_LEADS']}>
              <Leads />
            </RequirePermission>
          }
        />
        <Route
          path="content"
          element={
            <RequirePermission permissions={['MANAGE_CONTENT']}>
              <Content />
            </RequirePermission>
          }
        />
        <Route
          path="ops"
          element={
            <RequirePermission permissions={['HANDLE_OPS']}>
              <Ops />
            </RequirePermission>
          }
        />
        <Route path="threads" element={<Threads />} />
        <Route path="logs" element={<Logs />} />
        <Route path="messages" element={<Messages />} />
        <Route path="targets" element={<Targets />} />
        <Route
          path="partners"
          element={
            <RequirePermission permissions={['MANAGE_PARTNERS']}>
              <Partners />
            </RequirePermission>
          }
        />
        <Route path="team" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function LoginRoute() {
  const { account, loading } = useAuth()
  if (loading) return <Booting />
  if (account?.staffProfile) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <NetworkBar />
        <OfflineNotice />
        <Router />
      </StoreProvider>
    </AuthProvider>
  )
}
