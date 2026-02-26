import * as Effect from 'effect'
import { VCSAdapter } from '~/adapters/vcs/vcs.interface'
import { CommitInfo } from '~/lib/types'
import { GIT_DIFF_TIMEOUT_MS } from '~/lib/constants'
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
): Effect.Effect<string, Error, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    // Retry up to 3 times on failure
    return yield* Effect.retry(
      vcs.getDiff(from, to, options),
      {
        times: 3,
        delay: () => Effect.sleep('100 millis'),
      },
    )
  })
}

/**
 * Get recent commits
 */
export const getCommits = (limit?: number): Effect.Effect<CommitInfo[], Error, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.getCommits(limit)
  })
}

/**
 * Get current branch
 */
export const getCurrentBranch = (): Effect.Effect<string, Error, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.getCurrentBranch()
  })
}

/**
 * Get list of branches
 */
export const getBranches = (): Effect.Effect<string[], Error, VCSContext> => {
  return Effect.gen(function* () {
    const vcs = yield* VCSContext
    return yield* vcs.getBranches()
  })
}
