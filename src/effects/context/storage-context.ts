import * as Effect from 'effect'
import { StorageAdapter } from '~/adapters/storage/storage.interface'

export class StorageContext extends Effect.Tag<StorageContext>()('StorageContext') {
  readonly service: StorageAdapter = undefined!
}
