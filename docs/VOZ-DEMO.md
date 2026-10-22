# Guía de Demostración: Dictado de Horas por Voz (VOZ-07)

**Módulo:** Dictado e interpretación de horas por notas de voz  
**Historias asociadas:** VOZ-01 a VOZ-07  
**Ubicación principal en la UI:** `/horas` (`src/pages/HourLogsPage.tsx`)  
**Audiencia:** Equipo de desarrollo, evaluadores de calidad y partes interesadas  

---

## 1. Descripción de la Funcionalidad y Arquitectura Offline-First

El módulo de dictado de horas permite a los estudiantes registrar sus jornadas de prácticas preprofesionales mediante notas de voz grabadas directamente desde el navegador. La funcionalidad está diseñada bajo una arquitectura **offline-first estricta**, pensando en estudiantes que realizan trabajo de campo o se encuentran en zonas con conectividad intermitente o nula.

### 1.1. Componentes Clave del Sistema

- **Grabador de voz en el cliente (`useVoiceRecorder` / `VoiceRecordButton`):** Captura audio desde el micrófono del dispositivo utilizando la API estándar `MediaRecorder` (formato `audio/webm` o `audio/mp4`), con un límite máximo de grabación de 60 segundos por nota.
- **Persistencia local en Dexie (`db.voiceNotes`):** Tabla en IndexedDB (`db.version(2).stores({ voiceNotes: '++id, status, recordedAt' })`) que almacena el `Blob` de audio binario, su metadata (duración, timestamp ISO, MIME type) y el estado del procesamiento.
- **Panel y filas de notas (`VoiceNotesPanel` / `VoiceNoteRow`):** Visualiza las notas grabadas en el dispositivo, permitiendo su reproducción en local mediante URLs efímeras (`URL.createObjectURL`), reintento en caso de fallo o descarte manual.
- **Sincronizador en segundo plano (`scheduler.ts` / `processVoiceNotes`):** Orquestador que despacha las notas en cola hacia el backend cuando se detecta conexión a la red.
- **Diálogo de revisión y confirmación (`VoiceDraftDialog`):** Modal interactivo donde el practicante visualiza la transcripción ("Lo que entendió Yura"), revisa los datos inferidos (fecha, horas de inicio/fin, horas totales, actividad) y completa los campos obligatorios antes de consolidar el registro definitivo en su libro de horas.

---

### 1.2. Flujo Offline-First: Sin Señal vs. Con Señal

```
[ Grabación de voz en el navegador ]
                 │
                 ▼
     [ Guardar en IndexedDB ] ───► Estado: 'pending' ("Pendiente de interpretar")
                 │
                 ├──► [ Sin señal / Backend apagado ] ──► Espera en cola local
                 │                                        (Reintentos con backoff)
                 │
                 └──► [ Con señal / Backend activo ]
                               │
                               ▼
                   POST /hour-logs/voice-draft (FormData: audio + recordedAt)
                               │
                               ▼ Estado: 'processing' ("Interpretando…")
                   [ IA / Transcripción e Inferencia ]
                               │
                               ▼
                   Estado: 'draft' ("Borrador listo")
                               │
                               ▼
                   [ Revisar borrador en VoiceDraftDialog ]
                               │
                   ┌───────────┴───────────┐
                   ▼                       ▼
            [ Cancelar/Descartar ]     [ Confirmar ]
            (Permanece o se borra)         │
                                           ▼
                                 createLocalHourLog() ──► db.hourLogs + outbox
                                 deleteVoiceNote()    ──► Eliminado de db.voiceNotes
                                 Reflejado en Libro de Horas (Ledger)
```

#### A. Flujo Sin Señal (o Backend Apagado)
1. **Captura local inmediata:** Al detener la grabación, el archivo de audio se almacena localmente en IndexedDB (`db.voiceNotes`) con estado `status: 'pending'` y `attempts: 0`.
2. **Disponibilidad sin red:** La nota aparece en la interfaz con la etiqueta `"Pendiente de interpretar (sin señal)"`. El estudiante puede escuchar su grabación en cualquier momento gracias al reproductor integrado en el navegador.
3. **Tolerancia a fallos:** El sincronizador automático intenta enviar la nota periódicamente. Si no hay conexión o el servidor no responde, incrementa los intentos (`attempts`) y programa un reintento con backoff exponencial sin bloquear la interfaz ni perder el audio grabado.

#### B. Flujo Con Señal (o Backend Activo)
1. **Detección y envío:** Al recuperarse la conectividad, el planificador ejecuta `processVoiceNotes()`. La nota pasa a estado `'processing'` (`"Interpretando…"`).
2. **Procesamiento remoto:** El cliente envía una petición `POST /hour-logs/voice-draft` con `multipart/form-data` conteniendo el audio binario y la fecha/hora en que fue capturado (`recordedAt`).
3. **Respuesta estructurada:** El backend transcribe el mensaje y extrae los campos de la jornada, devolviendo una estructura JSON:
   ```json
   {
     "transcript": "Hoy trabajé 4 horas de 9 a 1 de la tarde en la documentación de endpoints",
     "draft": {
       "date": "2026-10-22",
       "startTime": "09:00",
       "endTime": "13:00",
       "hours": 4,
       "activity": "Documentación de endpoints"
     },
     "missing": []
   }
   ```
4. **Borrador listo para revisión:** En el cliente, la nota pasa a `status: 'draft'` (`"Borrador listo"`). El botón **"Revisar"** se activa en la fila.
5. **Confirmación del estudiante:** Al abrir el diálogo y pulsar **"Confirmar"**, se invoca `createLocalHourLog()` (creando el registro en `hourLogs` y encolando la operación en el `outbox` para sincronizarse con el backend) y se destruye el registro de la nota de voz (`deleteVoiceNote()`).

---

## 2. Guion Paso a Paso de la Demostración (3 Minutos)

### Preparación Previa a la Demo (Checklist)
- [ ] Tener la aplicación frontend ejecutándose localmente (`npm run dev` en `http://localhost:5173`).
- [ ] Iniciar sesión con un usuario estudiante que tenga una práctica asignada (ejemplo: `estudiante@yura.pe` o credenciales de prueba preconfiguradas).
- [ ] **Asegurarse de que el backend esté detenido** (apagar el servidor en Node/Nest/Fastify o bloquear temporalmente las peticiones de red hacia `/hour-logs/voice-draft` en las DevTools).
- [ ] Limpiar notas de voz residuales en IndexedDB para tener la bandeja limpia (ver [Sección 4.2](#42-limpieza-y-reseteo-de-indexeddb)).
- [ ] Abrir la ruta `/horas` ("Libro de horas").

---

### Minuto a Minuto del Guion

| Tiempo | Acción del Presentador | Qué se Muestra en Pantalla | Qué Explicar al Público |
|---|---|---|---|
| **0:00 – 0:45** | **1. Grabar nota con backend apagado**<br>• Clic en **"Dictar horas"**.<br>• Dictar claramente: *"Hoy 22 de octubre trabajé 4 horas de 9 a 1 de la tarde configurando pruebas automatizadas"**.<br>• Clic en **"Detener"**. | • Contador con cronómetro parpadeante (`0:05 / 1:00`).<br>• Estado breve "Guardando nota…".<br>• Aparece la sección **"Notas de voz"**.<br>• Estado de la fila: **"Pendiente de interpretar (sin señal)"**.<br>• Botón "Reproducir" activo. | *"Observen cómo la interfaz no se congela ni arroja errores de conexión. El audio ya está persistido de forma segura en el almacenamiento local del navegador (IndexedDB). El practicante puede incluso reproducir su grabación para validar lo que dijo antes de sincronizar."* |
| **0:45 – 1:45** | **2. Encender backend y sincronizar**<br>• En la terminal del backend, arrancar el servicio (`npm run start:dev`).<br>• Esperar la sincronización automática o forzar sincronización si se tiene botón de sync. | • La etiqueta cambia dinámicamente a **"Interpretando…"**.<br>• Tras 2–4 segundos, el estado cambia a **"Borrador listo"**.<br>• Aparece el botón principal **"Revisar"** junto a la nota. | *"Al volver la señal o activarse el servicio, el orquestador en segundo plano despacha el archivo de audio. El backend realiza la transcripción y el análisis del lenguaje natural para estructurar la jornada, transformando la nota en un borrador formal listo para inspección."* |
| **1:45 – 3:00** | **3. Revisar y confirmar en Libro de Horas**<br>• Clic en **"Revisar"**.<br>• Mostrar modal `VoiceDraftDialog`.<br>• Señalar la sección *"Lo que entendió Yura"* con la transcripción literal.<br>• Verificar campos inferidos (Fecha, Horarios, Horas, Actividad).<br>• Clic en **"Confirmar"**. | • Modal con transcripción y campos precargados.<br>• Si falta algún campo (ej. faltó decir el horario), se resalta con badge naranja *"Falta completar"* y borde advertencia.<br>• Al confirmar: el modal se cierra, la nota de voz se elimina del panel superior y la fila se suma de inmediato al **"Libro de horas"** con su indicador de sincronización. | *"El sistema nunca asume ni guarda datos a espaldas del estudiante: siempre hay un paso de supervisión humana. Una vez confirmado, la nota de voz se destruye del dispositivo, y la jornada entra directamente al libro oficial de horas con su respectivo estado."* |

---

## 3. Política de Privacidad y Manejo de Datos de Audio

La arquitectura de dictado de voz se diseñó respetando el principio de **minimización de datos** y **privacidad por diseño**:

1. **Almacenamiento Local Temporal:**
   - La grabación de voz reside exclusivamente en el dispositivo del usuario (`db.voiceNotes` en IndexedDB) mientras no se haya podido enviar e interpretar.
2. **Tránsito Cifrado:**
   - Al haber conectividad, el audio viaja a través de un canal HTTPS seguro hacia el endpoint `/hour-logs/voice-draft`.
3. **Intermediación con Proveedores Externos:**
   - El audio es enviado a un proveedor especializado de transcripción y procesamiento de lenguaje natural (Speech-to-Text / LLM).
   - **No hay almacenamiento persistente en servidores:** Ni el backend de Yura ni los proveedores de transcripción conservan los archivos de audio de forma permanente. El archivo se procesa en memoria o en un espacio temporal efímero durante la ejecución de la solicitud y es descartado inmediatamente después de devolver la transcripción y el borrador estructurado.
4. **Ciclo de Vida y Eliminación Definitiva:**
   - Tan pronto como el estudiante presiona **"Confirmar"** en el diálogo de revisión (o presiona **"Descartar"** en la fila), el registro de la nota de voz y su `Blob` binario son eliminados irrevocablemente del navegador (`deleteVoiceNote(note.id)`).
   - En el servidor solo quedan registrados los campos textuales de la jornada (fecha, horas, actividad), sin ningún rastro de grabaciones biométricas ni audios personales.

---

## 4. Plan B para Contingencias y Manejo de IndexedDB

Durante una presentación en vivo pueden ocurrir imprevistos técnicos (micrófono bloqueado por el sistema operativo, permisos del navegador denegados o fallos en el servicio de red). Los siguientes procedimientos garantizan que la demo pueda continuar sin interrupciones.

### 4.1. Simulación de Notas por Consola (Si Falla el Micrófono o el Backend)

Si el navegador muestra errores como *"No tenemos permiso para usar el micrófono"* o no hay micrófono conectado, abre las Herramientas de Desarrollador (**F12** o **Ctrl+Shift+I**), ve a la pestaña **Console** y ejecuta uno de los siguientes scripts:

#### Opción A: Simular Nota "Pendiente de interpretar" (Para demostrar flujo sin conexión)
Inserta una nota que simula haber sido grabada sin señal. Permite demostrar cómo se ve la bandeja antes de sincronizar:

```javascript
(async () => {
  const req = indexedDB.open('practicas');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('voiceNotes', 'readwrite');
    const store = tx.objectStore('voiceNotes');
    store.add({
      audio: new Blob(['audio-demo-simulado'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 4500,
      recordedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    });
    tx.oncomplete = () => {
      console.log('✅ Nota pendiente simulada creada.');
      location.reload();
    };
  };
})();
```

#### Opción B: Simular Nota con "Borrador listo" (Si falla tanto el micrófono como el backend)
Inserta una nota ya interpretada por IA con todos los campos listos para abrir directamente el diálogo de revisión:

```javascript
(async () => {
  const req = indexedDB.open('practicas');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('voiceNotes', 'readwrite');
    const store = tx.objectStore('voiceNotes');
    const hoy = new Date().toISOString().split('T')[0];
    store.add({
      audio: new Blob(['audio-demo-simulado'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 5200,
      recordedAt: new Date().toISOString(),
      status: 'draft',
      attempts: 0,
      transcript: 'Hoy trabajé 4 horas de 9 a 1 de la tarde en la documentación técnica y pruebas de calidad.',
      draft: {
        date: hoy,
        startTime: '09:00',
        endTime: '13:00',
        hours: 4,
        activity: 'Documentación técnica y ejecución de pruebas de calidad'
      },
      missing: []
    });
    tx.oncomplete = () => {
      console.log('✅ Borrador listo simulado.');
      location.reload();
    };
  };
})();
```

#### Opción C: Simular Nota con Campos Faltantes (Para mostrar la validación en pantalla)
Demuestra cómo la aplicación detecta que el practicante no mencionó el horario y le exige completarlo:

```javascript
(async () => {
  const req = indexedDB.open('practicas');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('voiceNotes', 'readwrite');
    const store = tx.objectStore('voiceNotes');
    const hoy = new Date().toISOString().split('T')[0];
    store.add({
      audio: new Blob(['audio-demo-simulado'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 3800,
      recordedAt: new Date().toISOString(),
      status: 'draft',
      attempts: 0,
      transcript: 'Avanzamos con el diseño de módulos durante 3 horas.',
      draft: {
        date: hoy,
        hours: 3,
        activity: 'Diseño de la arquitectura de módulos'
      },
      missing: ['startTime', 'endTime']
    });
    tx.oncomplete = () => {
      console.log('✅ Borrador con campos incompletos creado.');
      location.reload();
    };
  };
})();
```

---

### 4.2. Limpieza y Reseteo de IndexedDB

Para reiniciar el estado antes de empezar la demostración o dejar el entorno limpio después de una prueba:

#### Método 1: Desde la Interfaz de DevTools (Recomendado)
1. Presiona **F12** y navega a la pestaña **Application** (Chrome / Edge / Brave) o **Almacenamiento** (Firefox).
2. En el panel izquierdo, despliega **Storage** ➔ **IndexedDB** ➔ **`practicas`**.
3. Selecciona el almacén de objetos **`voiceNotes`**.
4. Haz clic en el botón superior **Clear table** (o clic derecho sobre `voiceNotes` ➔ **Clear**).
5. Recarga la página (`F5`).

> [!TIP]
> Si deseas hacer un reseteo total de la base de datos local y la sesión, pulsa en **Storage** (o *Almacenamiento*) en el menú lateral y haz clic en **"Clear site data"**.

#### Método 2: Limpieza Rápida por Consola de JavaScript
Ejecuta el siguiente snippet en la consola para vaciar **únicamente** la tabla de notas de voz sin perder tu sesión ni las horas registradas:

```javascript
(async () => {
  const req = indexedDB.open('practicas');
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('voiceNotes', 'readwrite');
    tx.objectStore('voiceNotes').clear();
    tx.oncomplete = () => {
      console.log('🧹 Tabla voiceNotes vaciada con éxito.');
      location.reload();
    };
  };
})();
```

Para eliminar la base de datos `practicas` por completo:
```javascript
indexedDB.deleteDatabase('practicas');
location.reload();
```
