import { Effect, Schedule } from 'effect'
import { CommitInfo } from '~/lib/types'
import { VCSError } from '~/lib/errors'
import { VCSContext } from '~/effects/context/vcs-context'

/**
 * VCS service functions
 * Adds retry logic and error handling around VCS adapter
 * Dependencies are injected via Effect context
 */

/**
 * Get diff with retry logic
 */
export const getDiff = (
  from: string,
  to: string,
  options?: { ignoreWhitespace?: boolean },
): Effect.Effect<string, VCSError, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    // Retry up to 3 times on failure with 100ms delay
    return yield* vcs.getDiff(from, to, options).pipe(
      Effect.retry(Schedule.recurs(3).pipe(Schedule.addDelay(() => '100 millis'))),
    )
  })
}

/**
 * Get recent commits
 */
export const getCommits = (limit?: number): Effect.Effect<CommitInfo[], VCSError, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.getCommits(limit)
  })
}

/**
 * Get current branch
 */
export const getCurrentBranch = (): Effect.Effect<string, VCSError, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.getCurrentBranch()
  })
}

/**
 * Get list of branches
 */
export const getBranches = (): Effect.Effect<string[], VCSError, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.getBranches()
  })
}

/**
 * Get list of available repositories
 */
export const listRepositories = (
  basePaths?: string[],
): Effect.Effect<Array<{ path: string; name: string }>, VCSError, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.listRepositories(basePaths)
  })
}
