import { Effect, Layer, ManagedRuntime } from "effect";
import { createVCSAdapter } from "~/adapters/vcs/factory";
import { createMemoryStorageAdapter } from "~/adapters/storage/memory";
import { createDiffParser } from "~/adapters/diff-parser/diff-parser";
import { VCSContext } from "~/effects/context/vcs-context";
import { StorageContext } from "~/effects/context/storage-context";
import { DiffParserContext } from "~/effects/context/diff-parser-context";

/**
 * Layer providing all VCS adapters
 */
const vcsLayer = Layer.succeed(VCSContext, createVCSAdapter(process.cwd()));

/**
 * Layer providing storage adapter
 */
const storageLayer = Layer.succeed(StorageContext, createMemoryStorageAdapter());

/**
 * Layer providing diff parser
 */
const diffParserLayer = Layer.succeed(DiffParserContext, createDiffParser());

/**
 * Combined layer with all dependencies
 */
export const appLayer = Layer.merge(Layer.merge(vcsLayer, storageLayer), diffParserLayer);

/**
 * Singleton managed runtime with all dependencies pre-loaded
 */
export const appRuntime = ManagedRuntime.make(appLayer);

/**
 * Helper to run an Effect with all dependencies
 * Use this in .start.ts server functions
 */
export const runEffectWithDeps = <A, E>(
  effect: Effect.Effect<A, E, VCSContext | StorageContext | DiffParserContext>,
): Promise<A> => {
  return appRuntime.runPromise(effect);
};
