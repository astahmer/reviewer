import { Context } from 'effect'
import { StorageAdapter } from '~/adapters/storage/storage.interface'

export class StorageContext extends Context.Tag('StorageContext')<StorageContext, StorageAdapter>() {
}
