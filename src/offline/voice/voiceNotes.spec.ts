import '@/test-utils/node-blob'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/offline/db'
import { addVoiceNote, deleteVoiceNote, listVoiceNotes, updateVoiceNote } from './voiceNotes'

function audioBlob(bytes: number[] = [1, 2, 3, 4, 5], type = 'audio/webm'): Blob {
  return new Blob([new Uint8Array(bytes)], { type })
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
}

function newNote(overrides: { recordedAt?: string; durationMs?: number } = {}) {
  return { audio: audioBlob(), mimeType: 'audio/webm', durationMs: 4200, ...overrides }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('addVoiceNote', () => {
  it('crea la nota en pending con 0 intentos y devuelve su id', async () => {
    const id = await addVoiceNote(newNote())

    expect(typeof id).toBe('number')
    const saved = await db.voiceNotes.get(id)
    expect(saved).toMatchObject({
      id,
      mimeType: 'audio/webm',
      durationMs: 4200,
      status: 'pending',
      attempts: 0,
    })
    expect(saved?.transcript).toBeUndefined()
    expect(saved?.draft).toBeUndefined()
    expect(saved?.missing).toBeUndefined()
    expect(saved?.error).toBeUndefined()
  })

  it('guarda el audio completo: tamaño, tipo y contenido', async () => {
    const id = await addVoiceNote({ audio: audioBlob([9, 8, 7], 'audio/ogg'), mimeType: 'audio/ogg', durationMs: 10 })

    const saved = await db.voiceNotes.get(id)
    expect(saved?.audio.size).toBe(3)
    expect(saved?.audio.type).toBe('audio/ogg')
    expect(await bytesOf(saved!.audio)).toEqual([9, 8, 7])
  })

  it('pone recordedAt en ISO con la hora actual cuando no se indica', async () => {
    const before = Date.now()
    const id = await addVoiceNote(newNote())
    const after = Date.now()

    const { recordedAt } = (await db.voiceNotes.get(id))!
    expect(new Date(recordedAt).toISOString()).toBe(recordedAt)
    expect(new Date(recordedAt).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Date(recordedAt).getTime()).toBeLessThanOrEqual(after)
  })

  it('respeta un recordedAt explícito', async () => {
    const id = await addVoiceNote(newNote({ recordedAt: '2026-04-01T10:00:00.000Z' }))

    expect((await db.voiceNotes.get(id))?.recordedAt).toBe('2026-04-01T10:00:00.000Z')
  })

  it('asigna ids distintos y crecientes', async () => {
    const first = await addVoiceNote(newNote())
    const second = await addVoiceNote(newNote())

    expect(second).toBeGreaterThan(first)
  })
})

describe('listVoiceNotes', () => {
  it('devuelve una lista vacía si no hay notas', async () => {
    await expect(listVoiceNotes()).resolves.toEqual([])
  })

  it('ordena de la más reciente a la más antigua, sin importar el orden en que se guardaron', async () => {
    await addVoiceNote(newNote({ recordedAt: '2026-04-02T10:00:00.000Z', durationMs: 2 }))
    await addVoiceNote(newNote({ recordedAt: '2026-04-03T10:00:00.000Z', durationMs: 3 }))
    await addVoiceNote(newNote({ recordedAt: '2026-04-01T10:00:00.000Z', durationMs: 1 }))

    const notes = await listVoiceNotes()

    expect(notes.map((n) => n.recordedAt)).toEqual([
      '2026-04-03T10:00:00.000Z',
      '2026-04-02T10:00:00.000Z',
      '2026-04-01T10:00:00.000Z',
    ])
  })

  it('si dos notas tienen el mismo recordedAt, la guardada después va primero', async () => {
    const same = '2026-04-01T10:00:00.000Z'
    const older = await addVoiceNote(newNote({ recordedAt: same }))
    const newer = await addVoiceNote(newNote({ recordedAt: same }))

    expect((await listVoiceNotes()).map((n) => n.id)).toEqual([newer, older])
  })
})

describe('updateVoiceNote', () => {
  it('aplica los cambios y deja intacto el resto, incluido el audio', async () => {
    const id = await addVoiceNote(newNote({ recordedAt: '2026-04-01T10:00:00.000Z' }))

    const updated = await updateVoiceNote(id, {
      status: 'draft',
      attempts: 1,
      transcript: 'Hoy trabajé de ocho a doce en soporte',
      draft: { date: '2026-04-01', startTime: '08:00', endTime: '12:00', hours: 4 },
      missing: ['activity'],
    })

    expect(updated).toBe(true)
    const saved = (await db.voiceNotes.get(id))!
    expect(saved).toMatchObject({
      status: 'draft',
      attempts: 1,
      transcript: 'Hoy trabajé de ocho a doce en soporte',
      draft: { date: '2026-04-01', startTime: '08:00', endTime: '12:00', hours: 4 },
      missing: ['activity'],
      recordedAt: '2026-04-01T10:00:00.000Z',
      mimeType: 'audio/webm',
    })
    expect(await bytesOf(saved.audio)).toEqual([1, 2, 3, 4, 5])
  })

  it('guarda el error cuando la nota falla', async () => {
    const id = await addVoiceNote(newNote())

    await updateVoiceNote(id, { status: 'failed', attempts: 3, error: 'sin conexión' })

    expect(await db.voiceNotes.get(id)).toMatchObject({ status: 'failed', attempts: 3, error: 'sin conexión' })
  })

  it('pasar un campo como undefined lo elimina (para reintentar sin arrastrar el error)', async () => {
    const id = await addVoiceNote(newNote())
    await updateVoiceNote(id, { status: 'failed', error: 'sin conexión' })

    await updateVoiceNote(id, { status: 'pending', error: undefined })

    const saved = (await db.voiceNotes.get(id))!
    expect(saved.status).toBe('pending')
    expect('error' in saved).toBe(false)
  })

  it('devuelve false y no crea nada si la nota no existe', async () => {
    await expect(updateVoiceNote(999, { status: 'failed' })).resolves.toBe(false)

    await expect(db.voiceNotes.count()).resolves.toBe(0)
  })
})

describe('deleteVoiceNote', () => {
  it('borra la nota indicada y deja las demás', async () => {
    const keep = await addVoiceNote(newNote())
    const remove = await addVoiceNote(newNote())

    await deleteVoiceNote(remove)

    expect((await listVoiceNotes()).map((n) => n.id)).toEqual([keep])
  })

  it('no falla si la nota ya no existe', async () => {
    await expect(deleteVoiceNote(999)).resolves.toBeUndefined()
  })
})

describe('índices de voiceNotes', () => {
  it('permite filtrar por status', async () => {
    const pending = await addVoiceNote(newNote())
    const failed = await addVoiceNote(newNote())
    await updateVoiceNote(failed, { status: 'failed' })

    const onlyPending = await db.voiceNotes.where('status').equals('pending').toArray()

    expect(onlyPending.map((n) => n.id)).toEqual([pending])
  })

  it('declara ++id, status y recordedAt', () => {
    const { schema } = db.table('voiceNotes')

    expect(schema.primKey.name).toBe('id')
    expect(schema.primKey.auto).toBe(true)
    expect(schema.indexes.map((index) => index.name).sort()).toEqual(['recordedAt', 'status'])
  })
})