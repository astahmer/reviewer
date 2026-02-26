/**
 * TanStack Start server functions for diff reviewer
 * These functions run on the server and are accessible from client components
 * They compose Effect-based services and cross the boundary only once
 */

import * as Effect from 'effect'
import { Diff, CommitInfo } from '~/lib/types'
import { runEffectWithDeps } from '~/effects/runtime'
import * as diffProcessor from '~/effects/services/diff-processor'
import * as vcsService from '~/effects/services/vcs-service'

/**
 * Server function: Fetch and process a diff between two commits
 */
export async function getDiff(from: string, to: string): Promise<Diff> {
  return runEffectWithDeps(
    Effect.gen(function* () {
      // Get raw diff from git
      const rawDiff = yield* vcsService.getDiff(from, to)

      // Process and cache the diff
      const diff = yield* diffProcessor.processAndCache(
        rawDiff,
        `${from}-${to}`,
        from,
        to,
      )

      return diff
    }),
  )
}

/**
 * Server function: Get list of recent commits
 */
export async function getCommitList(limit: number = 20): Promise<CommitInfo[]> {
  return runEffectWithDeps(vcsService.getCommits(limit))
}

/**
 * Server function: Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  return runEffectWithDeps(vcsService.getCurrentBranch())
}

/**
 * Server function: Get list of branches
 */
export async function getBranchesList(): Promise<string[]> {
  return runEffectWithDeps(vcsService.getBranches())
}
