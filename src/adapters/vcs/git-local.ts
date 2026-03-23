import { Effect } from "effect";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { GIT_DIFF_TIMEOUT_MS } from "~/lib/constants";
import { VCSError } from "~/lib/errors";
import { isStagedRef, isWorktreeRef } from "~/lib/local-refs";
import { CommitInfo } from "~/lib/types";
import { VCSAdapter } from "./vcs.interface";

const execAsync = promisify(exec);

const MAX_DEPTH = 3;

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

  return {
    hash,
    message,
    author: author || "",
    date: new Date(rawDate || Date.now()),
    kind: "commit",
    additions: Number(statsLine.match(/(\d+) insertions?/i)?.[1] || 0),
    deletions: Number(statsLine.match(/(\d+) deletions?/i)?.[1] || 0),
  };
};

function resolveGitRef(repoPath: string, ref: string): string {
  if (isStagedRef(ref)) {
    return execSync("git write-tree", {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    }).trim();
  }

  if (isWorktreeRef(ref)) {
    const snapshot = execSync("git stash create", {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    }).trim();

    return snapshot || "HEAD";
  }

  return ref;
}

async function scanForGitRepos(
  basePath: string,
  repos: Array<{ path: string; name: string }>,
  currentDepth = 0,
): Promise<void> {
  if (currentDepth > MAX_DEPTH) return;

  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = path.join(basePath, entry.name);

      try {
        const gitPath = path.join(fullPath, ".git");
        await fs.access(gitPath);
        repos.push({ path: fullPath, name: entry.name });
      } catch {
        await scanForGitRepos(fullPath, repos, currentDepth + 1);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

/**
 * Git local VCS adapter
 * Executes git commands to fetch diffs and commits
 */
export class GitLocalAdapter implements VCSAdapter {
  constructor(private _repoPath: string = process.cwd()) {}

  getDiff(
    from: string,
    to: string,
    options?: { ignoreWhitespace?: boolean },
  ): Effect.Effect<string, VCSError> {
    const repoPath = this._repoPath;
    const whitespaceFlag = options?.ignoreWhitespace ? "--ignore-all-space" : "";
    const fromRef = resolveGitRef(repoPath, from);
    const toRef = resolveGitRef(repoPath, to);
    const command = `git diff ${whitespaceFlag} ${fromRef} ${toRef}`.trim();

    return Effect.tryPromise({
      try: () =>
        Promise.race([
          execAsync(command, { cwd: repoPath, maxBuffer: 50 * 1024 * 1024 }).then(
            ({ stdout }) => stdout,
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Git diff timeout")), GIT_DIFF_TIMEOUT_MS),
          ),
        ]),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get diff: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    });
  }

  getFileContent(path: string, commit: string): Effect.Effect<string, VCSError> {
    const repoPath = this._repoPath;
    const resolvedRef = resolveGitRef(repoPath, commit);
    const command = `git show ${resolvedRef}:${path}`;

    return Effect.tryPromise({
      try: () =>
        execAsync(command, { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }).then(
          ({ stdout }) => stdout,
        ),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get file content: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    });
  }

  getCommits(limit: number = 20, offset: number = 0): Effect.Effect<CommitInfo[], VCSError> {
    const repoPath = this._repoPath;
    const format = "%x1e%H%x1f%s%x1f%an%x1f%aI";
    const command = `git log --pretty=format:"${format}" --shortstat -n ${limit} --skip=${offset}`;

    return Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(command, { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 });
        return stdout
          .split("\u001e")
          .map((chunk) => parseCommitStats(chunk))
          .filter((commit): commit is CommitInfo => commit != null);
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get commits: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    });
  }

  getCurrentBranch(): Effect.Effect<string, VCSError> {
    const repoPath = this._repoPath;

    return Effect.tryPromise({
      try: () =>
        execAsync("git rev-parse --abbrev-ref HEAD", {
          cwd: repoPath,
          maxBuffer: 1 * 1024 * 1024,
        }).then(({ stdout }) => stdout.trim()),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
          command: "git rev-parse --abbrev-ref HEAD",
        }),
    });
  }

  getBranches(): Effect.Effect<string[], VCSError> {
    const repoPath = this._repoPath;

    return Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync("git branch --list", {
          cwd: repoPath,
          maxBuffer: 10 * 1024 * 1024,
        });
        return stdout
          .trim()
          .split("\n")
          .map((line) => line.replace(/^\*?\s+/, ""))
          .filter((line) => line.length > 0);
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get branches: ${error instanceof Error ? error.message : String(error)}`,
          command: "git branch --list",
        }),
    });
  }

  listRepositories(
    basePaths?: string[],
  ): Effect.Effect<Array<{ path: string; name: string }>, VCSError> {
    const paths = basePaths || [os.homedir()];
    const repos: Array<{ path: string; name: string }> = [];

    return Effect.tryPromise({
      try: async () => {
        for (const basePath of paths) {
          try {
            await scanForGitRepos(basePath, repos);
          } catch {
            // Skip directories that don't exist or can't be read
          }
        }
        return repos;
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to list repositories: ${error instanceof Error ? error.message : String(error)}`,
          command: "find git repos",
        }),
    });
  }
}

/**
 * Create a Git local adapter instance
 */
export const createGitLocalAdapter = (repoPath?: string): VCSAdapter => {
  return new GitLocalAdapter(repoPath);
};
