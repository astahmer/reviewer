/**
 * TanStack Start server functions for diff reviewer
 * These functions run on the server and are accessible from client components
 * They compose Effect-based services and cross the boundary only once
 */

import { Effect, Layer, ManagedRuntime } from "effect";
import { createHash } from "node:crypto";
import { createVCSAdapter } from "~/adapters/vcs/factory";
import { VCSContext } from "~/effects/context/vcs-context";
import { runEffectWithDeps, appLayer } from "~/effects/runtime";
import * as diffProcessor from "~/effects/services/diff-processor";
import * as vcsService from "~/effects/services/vcs-service";
import { isLocalRef } from "~/lib/local-refs";
import { BranchInfo, CommitInfo, Diff } from "~/lib/types";

const createRuntimeWithRepo = (repoPath: string) => {
  const repoLayer = Layer.succeed(VCSContext, createVCSAdapter(repoPath));
  const fullLayer = Layer.mergeAll(appLayer, repoLayer);
  return ManagedRuntime.make(fullLayer);
};

/**
 * Server function: Fetch and process a diff between two commits
 */
export async function getDiff(from: string, to: string, repoPath?: string): Promise<Diff> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(
      Effect.gen(function* () {
        const rawDiff = yield* vcsService.getDiff(from, to);
        const diffId =
          isLocalRef(from) || isLocalRef(to)
            ? `${from}-${to}-${createHash("sha1").update(rawDiff).digest("hex")}`
            : `${from}-${to}`;
        const diff = yield* diffProcessor.processAndCache(rawDiff, diffId, from, to);
        return diff;
      }),
    );
  } finally {
    runtime.dispose();
  }
}

/**
 * Server function: Get list of recent commits
 */
export async function getCommitList(
  limit: number = 20,
  repoPath?: string,
  branch?: string,
  offset: number = 0,
): Promise<CommitInfo[]> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(vcsService.getCommitsForBranch(limit, { branch, offset }));
  } finally {
    runtime.dispose();
  }
}

/**
 * Server function: Get current branch name
 */
export async function getCurrentBranch(repoPath?: string): Promise<string> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(vcsService.getCurrentBranch());
  } finally {
    runtime.dispose();
  }
}

/**
 * Server function: Get list of branches
 */
export async function getBranchesList(repoPath?: string): Promise<BranchInfo[]> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(vcsService.getBranches());
  } finally {
    runtime.dispose();
  }
}

/**
 * Server function: Get number of commits between two commits (distance)
 */
export async function getCommitDistance(
  from: string,
  to: string,
  repoPath?: string,
): Promise<number | null> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(vcsService.getCommitDistance(from, to));
  } catch {
    return null;
  } finally {
    runtime.dispose();
  }
}

/**
 * Server function: Get list of available repositories
 */
export async function getRepositoryList(
  basePaths?: string[],
): Promise<Array<{ path: string; name: string }>> {
  const paths = basePaths && basePaths.length > 0 ? basePaths : [];
  return runEffectWithDeps(vcsService.listRepositories(paths.length > 0 ? paths : undefined));
}

/**
 * Server function: Get file content at a specific commit
 */
export async function getFileContent(
  filePath: string,
  commit: string,
  repoPath?: string,
): Promise<string> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(vcsService.getFileContent(filePath, commit));
  } finally {
    runtime.dispose();
  }
}
