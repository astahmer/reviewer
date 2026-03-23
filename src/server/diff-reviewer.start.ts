/**
 * TanStack Start server functions for diff reviewer
 * These functions run on the server and are accessible from client components
 * They compose Effect-based services and cross the boundary only once
 */

import { Effect, Layer, ManagedRuntime } from "effect";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Diff, CommitInfo } from "~/lib/types";
import { createLocalCommitEntries, isLocalRef } from "~/lib/local-refs";
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

const parseCommitStats = (chunk: string): CommitInfo | null => {
  const lines = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const [header, ...rest] = lines;
  if (!header) {
    return null;
  }

  const [hash, message, author, rawDate] = header.split("\u001f");
  if (!hash || !message) {
    return null;
  }

  const statsLine = rest.find((line) => /files? changed|insertions?|deletions?/.test(line)) || "";
  const additions = Number(statsLine.match(/(\d+) insertions?/i)?.[1] || 0);
  const deletions = Number(statsLine.match(/(\d+) deletions?/i)?.[1] || 0);

  return {
    hash,
    message,
    author: author || "",
    date: new Date(rawDate || Date.now()),
    kind: "commit",
    additions,
    deletions,
  };
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
  const cwd = repoPath || process.cwd();
  const localEntries = offset === 0 ? createLocalCommitEntries() : [];

  try {
    const format = "%x1e%H%x1f%s%x1f%an%x1f%aI";
    const branchArg = branch ? [branch] : ["--all"];
    const cmd = `git log ${branchArg.join(" ")} --max-count=${limit} --skip=${offset} --format=${format} --shortstat`;

    const stdout = execSync(cmd, { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });

    if (!stdout) {
      return [];
    }

    const commits = stdout
      .split("\u001e")
      .map((chunk) => parseCommitStats(chunk))
      .filter((commit): commit is CommitInfo => commit != null);

    return [...localEntries, ...commits];
  } catch {
    const runtime = createRuntimeWithRepo(cwd);
    try {
      return await runtime.runPromise(vcsService.getCommits(limit)).then((commits) => [
        ...localEntries,
        ...commits.map((c) => ({
          hash: c.hash,
          message: c.message,
          author: c.author,
          date: c.date,
          kind: c.kind,
          additions: c.additions,
          deletions: c.deletions,
        })),
      ]);
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
 * Server function: Get number of commits between two commits (distance)
 */
export async function getCommitDistance(
  from: string,
  to: string,
  repoPath?: string,
): Promise<number | null> {
  const cwd = repoPath || process.cwd();
  try {
    const cmd = `git rev-list --count ${from}..${to}`;
    const stdout = execSync(cmd, { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    const count = parseInt(stdout.trim(), 10);
    return isNaN(count) ? null : count;
  } catch {
    return null;
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
