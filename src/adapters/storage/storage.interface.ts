import * as Effect from 'effect'

/**
 * Storage adapter interface
 * Allows swapping between different storage implementations (memory, IndexedDB, etc)
 */

export interface StorageAdapter {
  /**
   * Get a value from storage
   */
  get<T = unknown>(key: string): Effect.Effect<T | null>

  /**
   * Set a value in storage
   */
  set<T>(key: string, value: T): Effect.Effect<void>

  /**
   * Remove a value from storage
   */
  remove(key: string): Effect.Effect<void>

  /**
   * Clear all storage
   */
  clear(): Effect.Effect<void>

  /**
   * Get all keys in storage
   */
  keys(): Effect.Effect<string[]>
}

export class StorageAdapterTag extends Effect.Tag<StorageAdapterTag>()('StorageAdapter') {
  readonly service: StorageAdapter = undefined!
}
