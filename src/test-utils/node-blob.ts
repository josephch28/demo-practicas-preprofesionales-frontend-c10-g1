import { Blob as NodeBlob } from 'node:buffer'

globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob