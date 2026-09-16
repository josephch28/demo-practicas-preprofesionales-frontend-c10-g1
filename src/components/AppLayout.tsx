import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth, type Role } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { SyncIndicator } from '@/components/SyncIndicator'
import { startSync } from '@/offline/sync/scheduler'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Estudiante',
  TUTOR: 'Tutor',
  COMPANY: 'Empresa',
  COORDINATOR: 'Coordinador',
}

interface NavItem {
  path: string
  label: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  STUDENT: [
    {
      title: 'Mi práctica',
      items: [
        { path: '/mi-practica', label: 'Inicio' },
        { path: '/horas', label: 'Mis horas' },
        { path: '/documentos', label: 'Documentos' },
      ],
    },
    {
      title: 'Buscar práctica',
      items: [
        { path: '/ofertas', label: 'Ofertas' },
        { path: '/postulaciones', label: 'Mis postulaciones' },
      ],
    },
  ],
  TUTOR: [{ title: 'Prácticas', items: [{ path: '/practicantes', label: 'Mis practicantes' }] }],
  COMPANY: [{ title: 'Reclutamiento', items: [{ path: '/ofertas-empresa', label: 'Mis ofertas' }] }],
  COORDINATOR: [{ title: 'Cierre', items: [{ path: '/acreditacion', label: 'Acreditación' }] }],
}

function initialsOf(fullName: string | undefined): string {
  if (!fullName) return '··'
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + second).toUpperCase() || '··'
}

export function AppLayout() {
  const { user, role, logout } = useAuth()

  // Se llama una sola vez para toda la sesión autenticada: AppLayout envuelve
  // todas las rutas protegidas vía <Outlet />, así que no se remonta al
  // navegar entre pantallas y no se crean timers duplicados.
  useEffect(() => {
    return startSync()
  }, [])

  const navGroups = role ? NAV_BY_ROLE[role] : []

  return (
    <div className="flex min-h-screen flex-col bg-paper md:h-screen md:overflow-hidden">
      <header className="flex h-topbar flex-none items-center gap-4 border-b-2 border-stamp bg-surface px-[18px]">
        <div className="flex flex-none items-center gap-2.5">
          <span aria-hidden="true" className="block size-[22px] rounded-md bg-stamp" />
          <span className="font-display text-17 font-bold tracking-[-0.02em] text-ink">
            prácticas.
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border border-line py-1 pl-1 pr-2.5">
            <span
              aria-hidden="true"
              className="flex size-7 flex-none items-center justify-center rounded-full bg-stamp text-12 font-semibold text-surface"
            >
              {initialsOf(user?.fullName)}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-13 font-semibold text-ink">{user?.fullName}</span>
              <span className="block text-11 text-inkSoft">{role ? ROLE_LABEL[role] : ''}</span>
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={logout}>
            Salir
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[theme(width.sidebar)_1fr]">
        <div className="flex min-h-0 flex-col gap-3 px-3.5 py-3.5 md:pr-2">
          <nav
            aria-label="Navegación principal"
            className="flex min-h-0 flex-1 flex-col gap-3.5 md:overflow-y-auto"
          >
            {navGroups.map((group) => (
              <div key={group.title}>
                <div className="px-2.5 pb-1.5 text-11 uppercase tracking-[0.07em] text-inkMute">
                  {group.title}
                </div>
                <div className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'flex h-9 items-center rounded-md px-3 text-14 transition-colors',
                          isActive
                            ? 'bg-surface font-semibold text-ink'
                            : 'text-inkBody hover:bg-navHover hover:text-ink',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <SyncIndicator />
        </div>

        <main className="min-h-0 min-w-0 px-4 pb-6 md:overflow-y-auto md:pl-2">
          <div className="flex flex-col gap-4 pt-3.5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
