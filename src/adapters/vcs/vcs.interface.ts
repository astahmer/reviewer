import * as Effect from 'effect'

/**
 * VCS (Version Control System) adapter interface
 * Allows swapping between different VCS implementations (git, jj, etc)
 */

export interface VCSAdapter {
  /**
   * Get unified diff between two commits
   */
  getDiff(from: string, to: string, options?: { ignoreWhitespace?: boolean }): Effect.Effect<string>

  /**
   * Get list of recent commits
   */
  getCommits(limit?: number): Effect.Effect<Array<{ hash: string; message: string; author: string; date: Date }>>

  /**
   * Get current branch name
   */
  getCurrentBranch(): Effect.Effect<string>

  /**
   * Get list of branches
   */
  getBranches(): Effect.Effect<string[]>
}

export class VCSAdapterTag extends Effect.Tag<VCSAdapterTag>()('VCSAdapter') {
  readonly service: VCSAdapter = undefined!
}
