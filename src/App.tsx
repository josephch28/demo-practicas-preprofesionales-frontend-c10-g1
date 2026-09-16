import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, type Role, useAuth } from '@/auth/AuthContext'
import { RequireRole } from '@/auth/RequireRole'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { HourLogsPage } from '@/pages/HourLogsPage'
import { MyPlacementPage } from '@/pages/MyPlacementPage'
import { OffersPage } from '@/pages/OffersPage'
import { OfferDetailPage } from '@/pages/OfferDetailPage'
import { MyApplicationsPage } from '@/pages/MyApplicationsPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { MyStudentsPage } from '@/pages/MyStudentsPage'
import { ReviewHoursPage } from '@/pages/ReviewHoursPage'
import { EvaluatePage } from '@/pages/EvaluatePage'
import { CompanyOffersPage } from '@/pages/CompanyOffersPage'
import { OfferApplicationsPage } from '@/pages/OfferApplicationsPage'
import { AccreditationPage } from '@/pages/AccreditationPage'

const ALL_ROLES: Role[] = ['STUDENT', 'TUTOR', 'COMPANY', 'COORDINATOR']

const HOME_BY_ROLE: Record<Role, string> = {
  STUDENT: '/mi-practica',
  TUTOR: '/practicantes',
  COMPANY: '/ofertas-empresa',
  COORDINATOR: '/acreditacion',
}

interface RouteDef {
  path: string
  roles: Role[]
  element: ReactNode
}

const ROUTES: RouteDef[] = [
  { path: '/ofertas', roles: ['STUDENT'], element: <OffersPage /> },
  { path: '/ofertas/:id', roles: ['STUDENT'], element: <OfferDetailPage /> },
  { path: '/postulaciones', roles: ['STUDENT'], element: <MyApplicationsPage /> },
  { path: '/mi-practica', roles: ['STUDENT'], element: <MyPlacementPage /> },
  { path: '/horas', roles: ['STUDENT'], element: <HourLogsPage /> },
  { path: '/documentos', roles: ['STUDENT'], element: <DocumentsPage /> },
  { path: '/practicantes', roles: ['TUTOR'], element: <MyStudentsPage /> },
  { path: '/practicantes/:id/horas', roles: ['TUTOR'], element: <ReviewHoursPage /> },
  { path: '/practicantes/:id/evaluar', roles: ['TUTOR'], element: <EvaluatePage /> },
  { path: '/ofertas-empresa', roles: ['COMPANY'], element: <CompanyOffersPage /> },
  { path: '/ofertas-empresa/:id/postulaciones', roles: ['COMPANY'], element: <OfferApplicationsPage /> },
  { path: '/acreditacion', roles: ['COORDINATOR'], element: <AccreditationPage /> },
]

function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={role ? HOME_BY_ROLE[role] : '/login'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireRole roles={ALL_ROLES}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        {ROUTES.map(({ path, roles, element }) => (
          <Route key={path} path={path} element={<RequireRole roles={roles}>{element}</RequireRole>} />
        ))}
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
