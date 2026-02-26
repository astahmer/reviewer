import * as Effect from 'effect'
import { DiffParser } from '~/adapters/diff-parser/types'
import { StorageAdapter } from '~/adapters/storage/storage.interface'
import { Diff } from '~/lib/types'
import { StorageContext } from '~/effects/context/storage-context'
import { DiffParserContext } from '~/effects/context/diff-parser-context'

/**
 * Diff processor service
 * Orchestrates diff parsing, caching, and retrieval
 * All dependencies are injected via Effect context
 */

/**
 * Get or create a diff from raw diff string
 * Caches result in storage for subsequent requests
 */
export const processAndCache = (
  rawDiff: string,
  id: string,
  from: string,
  to: string,
): Effect.Effect<Diff, Error, StorageContext | DiffParserContext> => {
  return Effect.gen(function* () {
    const storage = yield* StorageContext
    const parser = yield* DiffParserContext

    // Try to get from cache first
    const cacheKey = `diff:${id}`
    const cached = yield* storage.get<Diff>(cacheKey)

    if (cached) {
      return cached
    }

    // Parse the diff
    const parsed = yield* parser.parse(rawDiff, id, from, to)

    // Store in cache
    yield* storage.set(cacheKey, parsed)

    return parsed
  })
}

/**
 * Get a cached diff by ID
 */
export const getCached = (id: string): Effect.Effect<Diff | null, Error, StorageContext> => {
  return Effect.gen(function* () {
    const storage = yield* StorageContext
    const cacheKey = `diff:${id}`
    return yield* storage.get<Diff | null>(cacheKey)
  })
}

/**
 * Clear diff cache
 */
export const clearCache = (id: string): Effect.Effect<void, Error, StorageContext> => {
  return Effect.gen(function* () {
    const storage = yield* StorageContext
    const cacheKey = `diff:${id}`
    yield* storage.remove(cacheKey)
  })
}

/**
 * Clear all diffs from cache
 */
export const clearAllCache = (): Effect.Effect<void, Error, StorageContext> => {
  return Effect.gen(function* () {
    const storage = yield* StorageContext
    yield* storage.clear()
  })
}
