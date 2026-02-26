import { Context, Effect } from 'effect'
import { StorageError } from '~/lib/errors'

/**
 * Storage adapter interface
 * Allows swapping between different storage implementations (memory, IndexedDB, etc)
 */

export interface StorageAdapter {
  /**
   * Get a value from storage
   */
  get<T = unknown>(key: string): Effect.Effect<T | null, StorageError>

  /**
   * Set a value in storage
   */
  set<T>(key: string, value: T): Effect.Effect<void, StorageError>

  /**
   * Remove a value from storage
   */
  remove(key: string): Effect.Effect<void, StorageError>

  /**
   * Clear all storage
   */
  clear(): Effect.Effect<void, StorageError>

  /**
   * Get all keys in storage
   */
  keys(): Effect.Effect<string[], StorageError>
}

export class StorageAdapterTag extends Context.Tag('StorageAdapter')<StorageAdapterTag, StorageAdapter>() {
}
