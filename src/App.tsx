import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { StoreProvider } from './lib/store'
import { useStore } from './lib/storeContext'
import { canAny } from './lib/permissions'
import type { Permission } from './lib/permissions'
import { Layout } from './components/Layout'
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
  const { currentUser } = useStore()
  if (!currentUser) return <Navigate to="/login" replace />
  return children
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
  if (!canAny(currentUser.role, permissions)) return <Navigate to="/" replace />
  return children
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
            <RequirePermission permissions={['MANAGE_LEADS']}>
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

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
