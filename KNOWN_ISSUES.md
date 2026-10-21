# Problemas conocidos

Lo que sabemos que está mal y no alcanzamos a arreglar antes de entregar esto.

Si encuentras algo que no está acá, agrégalo. Casi seguro hay más. No tuvimos tiempo de
auditar todo el repo, solo de anotar lo que nos mordió mientras construíamos.


## D-11 · No se pueden editar horas desde la UI

`src/components/HourLogForm.tsx`, `src/pages/HourLogsPage.tsx`.

El formulario de horas solo crea registros nuevos (`op: 'create'`). No hay ningún botón
"Editar" ni flujo que encole un `op: 'update'` con `baseVersion` al outbox. El backend
soporta operaciones de update y delete en `sync.service.ts`, y la resolución de conflictos
(E1-04) depende de que el estudiante pueda editar para que el servidor rechace ediciones
sobre horas ya aprobadas o rechazadas. Sin la UI de edición, ese camino solo se puede
verificar con tests unitarios o manipulando IndexedDB a mano.
