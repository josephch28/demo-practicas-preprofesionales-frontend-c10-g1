# Prácticas Preprofesionales — Frontend

Cliente offline-first para gestión de prácticas preprofesionales: una SPA en React donde
el estudiante registra horas de práctica aunque no haya señal en el sitio donde practica.
El backend vive en el repo hermano de backend de tu grupo (`practicas-preprofesionales-backend-*`).

Arranca sin conexión: el service worker (Workbox, vía `vite-plugin-pwa`) precachea el
código, los assets y las fuentes en la primera visita, así que una recarga sin red sigue
sirviendo la app completa. Eso no la hace instalable: el manifest no trae íconos, así que
Chrome no va a ofrecer "Añadir a pantalla de inicio" todavía.

## Setup

Requisitos: **Node 24+**, **pnpm 9+**, y el **backend corriendo**. Sin backend no hay
contra qué autenticar: el login pega contra `/api/auth/login` y sin esa respuesta no hay
JWT, y sin JWT el scheduler de sync (ver Architecture) ni siquiera arranca.

### 1. Backend

En el repo hermano de backend:

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Queda escuchando en `http://localhost:3000/api`.

### 2. Frontend (este repo)

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Queda escuchando en `http://localhost:5173`. `VITE_API_URL` en `.env` apunta por defecto a
`http://localhost:3000/api`.

### Usuarios del seed

Contraseña `yura1234` para todos:

| Rol | Email |
|---|---|
| Coordinación | `coordinador@miyura.com` |
| Tutor | `tutor0@miyura.com` … `tutor7@miyura.com` |
| Empresa | `empresa0@miyura.com` … `empresa11@miyura.com` |
| Estudiante | `estudiante0@miyura.com` … `estudiante199@miyura.com` |

## Architecture

```
src/
├── api/                 cliente HTTP + llamadas REST para lo que NO es sincronizable
│                         (ofertas, postulaciones, acreditación, evaluaciones, empresas)
├── auth/                 AuthContext (JWT + rol en localStorage), RequireRole
├── components/
│   ├── ui/                 primitivos shadcn (button, dialog, input, select, ...)
│   ├── ledger/              Ledger, LedgerRow, SyncGutter (el canalón de sincronización)
│   ├── HourLogForm.tsx
│   ├── AppLayout.tsx
│   ├── StatusBadge.tsx
│   └── SyncIndicator.tsx
├── offline/
│   ├── db.ts               esquema Dexie: placements, hourLogs, documents, evaluations,
│   │                         outbox, meta
│   ├── hooks/               useOnline, usePlacement, useHourLogs, useSyncStatus: leen
│   │                         de Dexie, nunca hacen fetch
│   └── sync/                pull.ts, push.ts, conflict.ts, scheduler.ts, status.ts: el
│                             único código del repo que le habla a /sync/pull y /sync/push
├── pages/                 una pantalla por ruta, doce en total
├── lib/                   utilidades (cn, etc.)
├── App.tsx                rutas por rol
└── main.tsx                bootstrap, registra el service worker y arranca el scheduler
```

### La regla de oro

**La UI nunca hace `fetch` de datos sincronizables** (`Placement`, `HourLog`, `Document`,
`Evaluation`): lee de Dexie a través de los hooks de `offline/hooks/`, y escribe en Dexie +
el outbox (`enqueue()` en `offline/sync/push.ts`). El único código que habla con la red
para esas cuatro entidades vive en `offline/sync/`. Eso es lo que hace la app offline **por
construcción** y no como fallback: no hay un `catch` que revierta a un caché si el `fetch`
falla, porque en el camino de lectura nunca hubo un `fetch`.

**Matiz sobre escrituras**: la parte de "escribe en Dexie + el outbox" aplica solo a
`HourLog` — es la única entidad que el backend acepta en `/sync/push` (rechaza cualquier
otra). Por eso revisar horas (`ReviewHoursPage.tsx`), subir un documento (`DocumentsPage.tsx`)
y evaluar (`EvaluatePage.tsx`) escriben directo por HTTP en vez de encolar en el outbox: no es
una desviación de la arquitectura, es que esas acciones son online por contrato del backend.
Las *lecturas* de las cuatro entidades, en cambio, siempre pasan por Dexie sin excepción.

Ofertas, postulaciones y acreditación sí van directo por HTTP (`src/api/`). Requieren red,
y está bien que la requieran: nadie postula a una oferta ni pide un acta de acreditación
parado en el sitio de prácticas sin señal. Eso solo importa para las horas.

### Ciclo de sincronización

`offline/sync/scheduler.ts` arranca desde `AppLayout` y corre al montar, cada 60 segundos,
y al recuperar el evento `online` del navegador. Cada corrida:

1. **Pull** (`pull.ts`): `GET /sync/pull?since=<checkpoint>&limit=200`. Trae cambios de
   `placements`, `hourLogs`, `documents` y `evaluations` desde el último checkpoint
   guardado en `db.meta`. Los borrados llegan como tombstones (`deletedAt`) y se aplican
   como `delete` local. Repite hasta que el servidor devuelve `hasMore: false`, con un tope
   de 20 rondas para no colgarse si el servidor siempre contesta que hay más.
2. **Push** (`push.ts`): `POST /sync/push` con las operaciones acumuladas en `db.outbox`,
   cada una con su `clientOpId`. El servidor responde `applied`, `conflict` o `rejected`
   por operación. `conflict.ts` aplica el resultado: si el registro se creó offline con un
   id local negativo, lo reemplaza por el id que asignó el servidor.

**La limitación real del contrato:** el DTO de `/sync/push` en el backend acepta cuatro
valores de `entity` (`hourLog`, `placement`, `document`, `evaluation`), pero **hoy el
backend solo aplica `hourLog`**: cualquier otra entidad vuelve `rejected`. Por eso el
outbox de este frontend solo encola horas: `enqueue()` está tipado a `entity: 'hourLog'` y
no tiene sentido encolar algo que el servidor va a rechazar de entrada.

### Sistema de diseño

Una sola familia para toda la interfaz: **IBM Plex Sans** (texto y títulos, que se
distinguen por peso y por un tracking negativo, no por otra tipografía) más **IBM Plex
Mono** para datos (horas, fechas, porcentajes). Ambas vía `@fontsource`, precacheadas por
el service worker.

Los tokens viven en `src/index.css` como variables CSS en HSL y se exponen a Tailwind desde
`tailwind.config.ts`. El acento es el azul `--stamp` (`#0E3A6B`), que hace de color primario
y de estado resuelto a la vez; `--pending` (ámbar) y `--void` (rojo) cubren lo que espera
decisión y lo que volvió rechazado.

El armazón es **topbar + sidebar** (`components/AppLayout.tsx`): barra superior de 60 px con
la marca y el usuario, columna de 230 px con la navegación agrupada por rol, y el indicador
de sincronización fijo al pie de esa columna. Sobre eso, cada pantalla se arma con las
piezas de `components/`: `PageHeader`, `Panel`/`Section`, `StatCard`, `Chip`, `OfferCard`,
`HeroPanel`, `FilterTabs`, `ProgressBar` y los estados compartidos de carga, error y vacío
(`AsyncSection`).

El componente central es el **ledger** (`components/ledger/`): la lista de registros de
horas, heredera del libro de papel donde el tutor firmaba cada entrada a mano. A la
izquierda de cada fila vive el **canalón de sincronización** (`SyncGutter.tsx`), la
columna angosta que ocupa el lugar del margen donde el tutor rubricaba. El papel nunca
necesitó representar si el servidor ya sabía de un registro; el canalón sí. Es el segundo
eje de estado de cada fila (el primero sigue siendo `DRAFT` / `SUBMITTED` / `APPROVED` /
`REJECTED` del `HourLog`).

Cuatro estados, cada uno distinguible por **relleno** además de por color, para no
depender solo del color:

| Estado | Relleno | Significado |
|---|---|---|
| `local` | hueco | Existe solo en este dispositivo, todavía no se encoló |
| `queued` | rayado | En el outbox, esperando el próximo push |
| `synced` | sólido | El servidor confirmó el registro |
| `failed` | rayado diagonal | El servidor lo rechazó |

## Onboarding

Si es tu primer día en este proyecto:

1. Levanta el backend y el frontend (ver Setup) y confirma que puedes loguearte con
   cualquier usuario del seed.
2. **Lee `KNOWN_ISSUES.md` completo.** No todo lo que sabemos que está mal quedó
   documentado ahí. Hay más deuda de la que escribimos, y parte de tu trabajo en las
   primeras semanas es encontrarla.
3. Prueba el flujo offline a mano, no te fíes solo de los tests: apaga el backend, entra a
   `/horas` y registra un par de bloques, recarga la página (el registro debe seguir ahí,
   con el canalón hueco), vuelve a encender el backend y dale a "Sincronizar ahora". El
   canalón de esa fila debería pasar de hueco a rayado a sólido.
4. Todo PR va **contra `develop`**, nunca contra `main`, y nunca por push directo. Yura
   evalúa tus PRs automáticamente.

## CI y evaluación

Dos workflows, con propósitos distintos:

- **`ci.yml`** corre en cada push a cualquier rama: typechequea, linta (reporte, no
  bloquea), testea con cobertura, mide duplicación con jscpd (reporte, no bloquea) y
  construye. Sube `coverage/`, el reporte de ESLint y el de jscpd como artefactos. El
  grader de Yura los lee para las métricas absolutas del proyecto.
- **`yura-quality.yml`** corre solo en pull requests. Llama al workflow reutilizable de
  Yura (`yura-edu/ci-workflows`), que analiza el **diff**: cobertura de las líneas nuevas y
  hallazgos nuevos de seguridad. Por eso `base_ref` es `develop`: sin esa rama de
  referencia el análisis no tiene contra qué comparar el diff, y el check se queda colgado.
  Es también la razón por la que los PR van contra `develop` y no contra `main`.
