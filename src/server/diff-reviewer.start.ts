/**
 * TanStack Start server functions for diff reviewer
 * These functions run on the server and are accessible from client components
 * They compose Effect-based services and cross the boundary only once
 */

import { Effect, Layer, ManagedRuntime } from "effect";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { Diff, CommitInfo } from "~/lib/types";
import { runEffectWithDeps, appLayer } from "~/effects/runtime";
import * as diffProcessor from "~/effects/services/diff-processor";
import * as vcsService from "~/effects/services/vcs-service";
import { createGitLocalAdapter } from "~/adapters/vcs/git-local";
import { VCSContext } from "~/effects/context/vcs-context";

const createRuntimeWithRepo = (repoPath: string) => {
  const repoLayer = Layer.succeed(VCSContext, createGitLocalAdapter(repoPath));
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
        const diff = yield* diffProcessor.processAndCache(rawDiff, `${from}-${to}`, from, to);
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
): Promise<CommitInfo[]> {
  const cwd = repoPath || process.cwd();

  try {
    const format = "%H%n%s%n%an%n%aI";
    const branchArg = branch ? [branch] : ["--all"];
    const cmd = `git log ${branchArg.join(" ")} --max-count=${limit} --format=${format}`;

    const stdout = execSync(cmd, { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });

    if (!stdout) {
      return [];
    }

    const lines = stdout.trim().split("\n");
    const commits: CommitInfo[] = [];
    for (let i = 0; i < lines.length; i += 4) {
      if (lines[i] && lines[i + 1]) {
        commits.push({
          hash: lines[i],
          message: lines[i + 1],
          author: lines[i + 2] || "",
          date: new Date(lines[i + 3] || Date.now()),
        });
      }
    }
    return commits;
  } catch {
    const runtime = createRuntimeWithRepo(cwd);
    try {
      return await runtime.runPromise(vcsService.getCommits(limit)).then((commits) =>
        commits.map((c) => ({
          hash: c.hash,
          message: c.message,
          author: c.author,
          date: c.date,
        })),
      );
    } finally {
      runtime.dispose();
    }
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
export async function getBranchesList(repoPath?: string): Promise<string[]> {
  const runtime = createRuntimeWithRepo(repoPath || process.cwd());
  try {
    return await runtime.runPromise(vcsService.getBranches());
  } finally {
    runtime.dispose();
  }
}

/**
 * Server function: Get list of available repositories
 */
export async function getRepositoryList(
  basePath?: string,
): Promise<Array<{ path: string; name: string }>> {
  const paths = basePath
    ? [basePath]
    : [path.join(os.homedir(), "dev"), path.join(os.homedir(), "projects")];
  return runEffectWithDeps(vcsService.listRepositories(paths));
}
