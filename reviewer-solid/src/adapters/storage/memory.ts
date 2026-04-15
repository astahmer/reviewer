import { Effect } from "effect";
import { StorageError } from "~/lib/errors";
import { StorageAdapter } from "./storage.interface";

/**
 * In-memory storage adapter
 * Used for development and MVP; can be swapped with IndexedDB for production
 */
class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  get<T = unknown>(key: string): Effect.Effect<T | null, StorageError> {
    return Effect.sync(() => {
      const value = this.store.get(key);
      return (value ?? null) as T | null;
    });
  }

  set<T>(key: string, value: T): Effect.Effect<void, StorageError> {
    return Effect.sync(() => {
      this.store.set(key, value);
    });
  }

  remove(key: string): Effect.Effect<void, StorageError> {
    return Effect.sync(() => {
      this.store.delete(key);
    });
  }

  clear(): Effect.Effect<void, StorageError> {
    return Effect.sync(() => {
      this.store.clear();
    });
  }

  keys(): Effect.Effect<string[]> {
    return Effect.sync(() => {
      return Array.from(this.store.keys());
    });
  }
}

/**
 * Create a memory storage adapter instance
 */
export const createMemoryStorageAdapter = (): StorageAdapter => {
  return new MemoryStorageAdapter();
};
