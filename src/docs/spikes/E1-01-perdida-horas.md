# Spike E1-01 — Pérdida de horas al fallar la red durante pushOutbox

## Test que reproduce el fallo
`src/offline/sync/push-network-failure.spec.ts`. Falla hoy sin depender de
timers: el fallo se inyecta mockeando `@/api/client`.

## Orden de operaciones que causa la pérdida
En `src/offline/sync/push.ts`, dentro de `pushOutbox()`:

1. Se leen las entradas del outbox (línea 32).
2. `db.outbox.bulkDelete(...)` vacía la cola local (línea 47).
3. **Después**, se llama `await api('/sync/push', ...)` (línea 49).

Si el paso 3 falla (red caída a mitad del envío), el paso 2 ya ocurrió: la
cola quedó vacía, el registro local sigue marcado `queued` para siempre y no
hay forma de reintentar. Los datos existen solo en memoria del navegador
durante la llamada fallida y se pierden.

## ¿Afecta a documentos y evaluaciones, o solo a horas?
Solo a horas. `OutboxEntry.entity` está tipado a `'hourLog'` en
`src/offline/db.ts`, y el propio README del repo confirma que el backend
rechaza cualquier otro valor de `entity` en `/sync/push`. Documentos y
evaluaciones se escriben por HTTP directo (`DocumentsPage.tsx`,
`EvaluatePage.tsx`), no pasan por `pushOutbox()`, así que este bug no las
toca.

## Siguiente paso
El fix (mover `bulkDelete` a después de que el servidor confirme, o
condicionarlo al resultado) es tarea de E1-02, que depende de este spike.