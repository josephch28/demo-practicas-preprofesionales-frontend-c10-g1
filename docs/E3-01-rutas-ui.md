# E3-01 · Inventario de rutas de UI y protecciones por rol

**Épica:** E3 — Seguridad y control de acceso
**Sprint:** 2
**Alcance:** rutas de la SPA (`src/App.tsx`). Complementa el inventario de endpoints del backend: [`docs/E3-01-auditoria-permisos.md`](../../demo-practicas-preprofesionales-backend-c10-g1-r3/docs/E3-01-auditoria-permisos.md).

Este documento es un inventario — no cambia código. La autoridad final sobre quién puede ver qué vive **en el backend**; aquí solo se registra qué deja ver la UI, como defensa en profundidad y para dar contexto a los hallazgos que terminan abriéndose como historias hijas.

---

## 1 · Modelo de protección en el cliente

- Rutas protegidas se envuelven en `RequireRole` (`src/auth/RequireRole.tsx`): si no hay `user` en el `AuthContext`, redirige a `/login`; si el `role` del usuario no está en la lista de la ruta, redirige a `/`. El `HomeRedirect` lleva al home propio del rol (`HOME_BY_ROLE` en `App.tsx`).
- El `role` viene del `/auth/login` del backend, firmado dentro del JWT. El `AuthContext` lo lee del localStorage al arrancar.
- **La UI es defensa en profundidad.** Un atacante que forje `role: 'COORDINATOR'` en `localStorage` conseguiría ver pantallas vacías porque los endpoints exigirían un JWT con esa claim, y el JWT se emite solo desde el servidor. Donde hay agujeros reales es en el backend (ver documento del backend §3).
- La "pertenencia" en el cliente no se verifica aparte: todos los datos en Dexie llegan de `/sync/pull`, que **sí** filtra por `studentId`/`tutorId` del usuario autenticado. Lo que entra a Dexie es lo que al usuario le toca ver. La única pantalla que depende de un `:id` en la URL (`/practicantes/:id/horas`) no abusa de ese id porque Dexie no tiene el placement de otro tutor para abrir.

---

## 2 · Inventario de rutas (14 rutas definidas en `src/App.tsx`)

Convenciones:

- **Roles permitidos**: lista exacta pasada a `RequireRole` por la entrada en `ROUTES`.
- **Lee recurso por `:id`?**: si la ruta tiene parámetro dinámico, y si la pantalla usa ese id para leer de Dexie (fuente local) o del backend.

| # | Ruta | Roles permitidos | Lee recurso por `:id`? | Página | Notas |
|---|---|---|---|---|---|
| 1 | `/login` | público | — | `LoginPage` | Entra con `email` + `password`, guarda `accessToken` y `user` en el contexto. |
| 2 | `/` | cualquier autenticado | — | `HomeRedirect` | Redirige al home del rol (`/mi-practica`, `/practicantes`, `/ofertas-empresa`, `/acreditacion`). |
| 3 | `/ofertas` | STUDENT | No | `OffersPage` | Catálogo público para estudiantes; usa `GET /offers` del backend. |
| 4 | `/ofertas/:id` | STUDENT | Backend (`GET /offers/:id`) | `OfferDetailPage` | Lee la oferta por id. El backend hoy no filtra por estado (hallazgo H-04); la UI no pone restricciones adicionales. |
| 5 | `/postulaciones` | STUDENT | No | `MyApplicationsPage` | Usa `GET /applications/me`; el filtrado por `studentId` lo hace el backend. |
| 6 | `/mi-practica` | STUDENT | No (lee de Dexie) | `MyPlacementPage` | Lee la plaza del estudiante actual desde Dexie. |
| 7 | `/horas` | STUDENT | No (lee de Dexie) | `HourLogsPage` | Lista las horas del placement del estudiante actual desde Dexie. |
| 8 | `/documentos` | STUDENT | No | `DocumentsPage` | — |
| 9 | `/practicantes` | TUTOR | No (lee de Dexie) | `MyStudentsPage` | Lista los placements del tutor desde Dexie (sincronizados por `/sync/pull` con filtro por `tutorId`). |
| 10 | `/practicantes/:id/horas` | TUTOR | Dexie (`db.placements.get(:id)`) | `ReviewHoursPage` | Deja aprobar/rechazar horas vía `PATCH /hour-logs/:id/review`. **Hoy el backend no valida que el tutor sea el asignado** (hallazgo H-03). El `ReviewHoursPage` tiene un comentario explícito sobre esta deuda del backend. |
| 11 | `/practicantes/:id/evaluar` | TUTOR | Dexie | `EvaluatePage` | Envía evaluaciones; el backend sí verifica rol + pertenencia (`assertCanSubmit`). |
| 12 | `/ofertas-empresa` | COMPANY | No | `CompanyOffersPage` | Lista `GET /offers/me`. |
| 13 | `/ofertas-empresa/:id/postulaciones` | COMPANY | Backend (`GET /offers/:id/applications`) | `OfferApplicationsPage` | **Hoy el backend no valida que la oferta sea de la empresa que llama** (hallazgo H-01). La UI no agrega restricción. |
| 14 | `/acreditacion` | COORDINATOR | No | `AccreditationPage` | Reporte global; el backend lo restringe a COORDINATOR. |

---

## 3 · Rutas que amplifican hallazgos del backend

Dos rutas de la UI empujan al usuario a usar endpoints vulnerables identificados en el inventario del backend. No son hallazgos nuevos — el fix vive en el backend. Las nombro aquí para que el equipo entienda qué pantalla hay que validar manualmente al cerrar cada historia hija de E3.

| Ruta de UI | Endpoint que invoca | Hallazgo backend | Historia hija propuesta |
|---|---|---|---|
| `/practicantes/:id/horas` (botones Aprobar / Devolver) | `PATCH /hour-logs/:id/review` | H-03 | **E3-02 (candidata)** — tutor asignado |
| `/ofertas-empresa/:id/postulaciones` | `GET /offers/:id/applications` + `PATCH /applications/:id/decide` | H-01 + H-02 | **E3-04 (candidata)** — empresa dueña |

Las rutas de COMPANY para crear/publicar/cerrar ofertas (`CompanyOffersPage`) también disparan los endpoints H-05/H-06/H-07, pero en la UI un dueño honesto solo opera sobre sus propias ofertas; el ataque requiere adivinar o enumerar `offerId` ajenos — no hay pantalla que exponga eso. Igual la historia hija del backend **E3-03 (candidata)** cerraría los tres de una vez.

---

## 4 · Rutas que no amplifican hallazgos (defensa en profundidad OK)

Las demás rutas o leen de Dexie (que ya está filtrado por el `/sync/pull`), o llaman a endpoints que **sí** verifican pertenencia en el backend (`GET /applications/me`, `GET /offers/me`, `POST /hour-logs`, `GET /placements/:id/hour-logs`, etc.). La UI no agrega restricciones adicionales ni las necesita.

---

## 5 · Metodología y limitaciones

- Se leyó `src/App.tsx`, `src/auth/RequireRole.tsx` y las 14 páginas listadas.
- **No** se auditó: XSS/CSP (no es alcance de E3-01), fortaleza del almacenamiento del `accessToken` en `localStorage`, ni cookie policies.
- La verificación de los hallazgos se hace contra el backend con `curl` (ver documento del backend §3). Desde el frontend solo se puede observar la UI que invoca los endpoints vulnerables; el ataque real se hace desde cualquier cliente HTTP autenticado.
