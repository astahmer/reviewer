import { Context, Effect } from 'effect'
import { VCSError } from '~/lib/errors'

/**
 * VCS (Version Control System) adapter interface
 * Allows swapping between different VCS implementations (git, jj, etc)
 */

export interface VCSAdapter {
  /**
   * Get unified diff between two commits
   */
  getDiff(from: string, to: string, options?: { ignoreWhitespace?: boolean }): Effect.Effect<string, VCSError>

  /**
   * Get list of recent commits
   */
  getCommits(limit?: number): Effect.Effect<Array<{ hash: string; message: string; author: string; date: Date }>, VCSError>

  /**
   * Get current branch name
   */
  getCurrentBranch(): Effect.Effect<string, VCSError>

  /**
   * Get list of branches
   */
  getBranches(): Effect.Effect<string[], VCSError>
}

export class VCSAdapterTag extends Context.Tag('VCSAdapter')<VCSAdapterTag, VCSAdapter>() {
}
