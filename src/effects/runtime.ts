import * as Effect from 'effect'
import * as Layer from 'effect/Layer'
import { createGitLocalAdapter } from '~/adapters/vcs/git-local'
import { createMemoryStorageAdapter } from '~/adapters/storage/memory'
import { createJsDiffParser } from '~/adapters/diff-parser/diff-parser'
import { VCSContext } from '~/effects/context/vcs-context'
import { StorageContext } from '~/effects/context/storage-context'
import { DiffParserContext } from '~/effects/context/diff-parser-context'

/**
 * Layer providing all VCS adapters
 */
const vcsLayer = Layer.succeed(VCSContext, createGitLocalAdapter(process.cwd()))

/**
 * Layer providing storage adapter
 */
const storageLayer = Layer.succeed(StorageContext, createMemoryStorageAdapter())

/**
 * Layer providing diff parser
 */
const diffParserLayer = Layer.succeed(DiffParserContext, createJsDiffParser())

/**
 * Combined layer with all dependencies
 */
export const appLayer = Layer.merge(Layer.merge(vcsLayer, storageLayer), diffParserLayer)

/**
 * Managed runtime for running Effects with all dependencies injected
 * Use this to run Effects in server functions
 */
export const createManagedRuntime = () => {
  return Layer.toRuntime(appLayer)
}

/**
 * Helper to run an Effect with all dependencies
 * Use this in .start.ts server functions
 */
export const runEffectWithDeps = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  return Effect.runPromise(effect.pipe(Effect.provide(appLayer)))
}
