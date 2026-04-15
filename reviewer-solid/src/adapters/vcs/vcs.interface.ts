import { Context, Effect } from "effect";
import { VCSError } from "~/lib/errors";
import { BranchInfo, CommitInfo } from "~/lib/types";

/**
 * VCS (Version Control System) adapter interface
 * Allows swapping between different VCS implementations (git, jj, etc)
 */

export interface VCSAdapter {
  /**
   * Get unified diff between two commits
   */
  getDiff(
    from: string,
    to: string,
    options?: { ignoreWhitespace?: boolean },
  ): Effect.Effect<string, VCSError>;

  /**
   * Get file content at a specific commit
   */
  getFileContent(path: string, commit: string): Effect.Effect<string, VCSError>;

  /**
   * Get list of recent commits
   */
  getCommits(
    limit?: number,
    options?: {
      branch?: string;
      offset?: number;
    },
  ): Effect.Effect<CommitInfo[], VCSError>;

  /**
   * Get current branch name
   */
  getCurrentBranch(): Effect.Effect<string, VCSError>;

  /**
   * Get list of branches
   */
  getBranches(): Effect.Effect<BranchInfo[], VCSError>;

  /**
   * Get number of commits between two revisions when supported
   */
  getCommitDistance(from: string, to: string): Effect.Effect<number | null, VCSError>;

  /**
   * Get list of available repositories (git directories)
   */
  listRepositories(
    basePaths?: string[],
  ): Effect.Effect<Array<{ path: string; name: string }>, VCSError>;
}

export class VCSAdapterTag extends Context.Tag("VCSAdapter")<VCSAdapterTag, VCSAdapter>() {}
