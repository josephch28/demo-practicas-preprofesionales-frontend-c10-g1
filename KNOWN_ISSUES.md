# Problemas conocidos

Lo que sabemos que está mal y no alcanzamos a arreglar antes de entregar esto.

Si encuentras algo que no está acá, agrégalo. Casi seguro hay más. No tuvimos tiempo de
auditar todo el repo, solo de anotar lo que nos mordió mientras construíamos.

## D-09 · `HourLogForm.tsx` hace de todo

`src/components/HourLogForm.tsx`.

Estado del formulario, formateo de la fecha en español para la confirmación, cálculo de la
duración a partir de inicio y fin, la escritura a `db.hourLogs` y el `enqueue()` al outbox,
todo en el mismo componente. Funciona, pero cualquier cambio, hasta uno chico como agregar
un campo, obliga a leerlo entero para saber qué más se puede romper. Debería partirse en un
hook de formulario, los helpers puros que ya casi están separados
(`formatDateForConfirmation`, `computeDurationLabel`) y un hook de persistencia aparte. No
llegamos. (E6-01 ya removió las dos copias de la validación de horas; el resto queda.)

## D-10 · Los hooks que tocan Dexie no tienen tests

`src/offline/hooks/`: `useHourLogs.ts`, `usePlacement.ts`, `useSyncStatus.ts`. La
excepción es `useOnline.ts`, que sí tiene spec.

No supimos testear hooks que tocan IndexedDB y lo dejamos así. Todos usan `useLiveQuery` de
`dexie-react-hooks` contra la base real de Dexie; en otras partes del repo probamos con
`fake-indexeddb` (mira `offline/db.spec.ts` como referencia) y no debería ser muy distinto
hacerlo acá, pero nunca nos sentamos a escribirlos. Si vas a tocar cómo se leen las horas o
la plaza del estudiante desde la UI, vas a ciegas. No hay red de seguridad que te avise si
rompiste algo.

## D-11 · No se pueden editar horas desde la UI

`src/components/HourLogForm.tsx`, `src/pages/HourLogsPage.tsx`.

El formulario de horas solo crea registros nuevos (`op: 'create'`). No hay ningún botón
"Editar" ni flujo que encole un `op: 'update'` con `baseVersion` al outbox. El backend
soporta operaciones de update y delete en `sync.service.ts`, y la resolución de conflictos
(E1-04) depende de que el estudiante pueda editar para que el servidor rechace ediciones
sobre horas ya aprobadas o rechazadas. Sin la UI de edición, ese camino solo se puede
verificar con tests unitarios o manipulando IndexedDB a mano.
