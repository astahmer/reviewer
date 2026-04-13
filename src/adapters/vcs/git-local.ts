import { Effect } from "effect";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { GIT_DIFF_TIMEOUT_MS } from "~/lib/constants";
import { VCSError } from "~/lib/errors";
import { createLocalCommitEntries, isLocalRef, isStagedRef, isWorktreeRef } from "~/lib/local-refs";
import { BranchInfo, CommitInfo } from "~/lib/types";
import { listVcsRepositories } from "./shared";
import { VCSAdapter } from "./vcs.interface";

const execFileAsync = promisify(execFile);

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

interface GitLocalBranchRow {
  name: string;
  baseName: string;
  upstream?: string;
  latestCommit: CommitInfo;
}

interface GitRemoteBranchRow {
  name: string;
  baseName: string;
  remoteName: string;
  latestCommit: CommitInfo;
}

const createCommitInfo = (
  hash: string,
  message: string,
  author: string,
  rawDate: string,
): CommitInfo => ({
  hash,
  message,
  author,
  date: new Date(rawDate || Date.now()),
  kind: "commit",
});

const parseBranchLine = (line: string): string[] =>
  line
    .split("\u001f")
    .map((part) => part.trim())
    .filter((part, index) => index === 1 || part.length > 0);

const getRemoteName = (ref: string | undefined): string | undefined => {
  if (!ref) {
    return undefined;
  }

  return ref.split("/")[0];
};

const getRemoteBranchBaseName = (ref: string): string => ref.split("/").slice(1).join("/") || ref;

export const parseGitLocalBranchRows = (stdout: string): GitLocalBranchRow[] =>
  stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): GitLocalBranchRow | null => {
      const [name, upstream, author, rawDate, subject, objectName] = parseBranchLine(line);
      if (!name || !objectName) {
        return null;
      }

      return {
        name,
        baseName: name,
        upstream: upstream || undefined,
        latestCommit: createCommitInfo(objectName, subject || "", author || "", rawDate || ""),
      };
    })
    .filter((branch): branch is GitLocalBranchRow => branch != null);

export const parseGitRemoteBranchRows = (stdout: string): GitRemoteBranchRow[] =>
  stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): GitRemoteBranchRow | null => {
      const [name, author, rawDate, subject, objectName] = parseBranchLine(line);
      if (!name || !objectName || name.endsWith("/HEAD")) {
        return null;
      }

      const remoteName = getRemoteName(name);
      if (!remoteName) {
        return null;
      }

      return {
        name,
        baseName: getRemoteBranchBaseName(name),
        remoteName,
        latestCommit: createCommitInfo(objectName, subject || "", author || "", rawDate || ""),
      };
    })
    .filter((branch): branch is GitRemoteBranchRow => branch != null);

export const buildGitBranchInfo = (
  localBranches: GitLocalBranchRow[],
  remoteBranches: GitRemoteBranchRow[],
): BranchInfo[] => {
  const remoteNamesByBaseName = remoteBranches.reduce((acc, branch) => {
    const current = acc.get(branch.baseName) || [];
    acc.set(branch.baseName, Array.from(new Set([...current, branch.remoteName])).sort());
    return acc;
  }, new Map<string, string[]>());

  const localBaseNames = new Set(localBranches.map((branch) => branch.baseName));

  const branches: BranchInfo[] = [
    ...localBranches.map<BranchInfo>((branch) => {
      const remoteName =
        getRemoteName(branch.upstream) || remoteNamesByBaseName.get(branch.baseName)?.[0];

      return {
        name: branch.name,
        baseName: branch.baseName,
        displayName: remoteName ? `${branch.baseName}@${remoteName}` : branch.baseName,
        scope: remoteName ? "tracked" : "local",
        remoteName,
        latestCommit: branch.latestCommit,
      };
    }),
    ...remoteBranches
      .filter((branch) => !localBaseNames.has(branch.baseName))
      .map<BranchInfo>((branch) => ({
        name: branch.name,
        baseName: branch.baseName,
        displayName: `${branch.baseName}@${branch.remoteName}`,
        scope: "remote" as const,
        remoteName: branch.remoteName,
        latestCommit: branch.latestCommit,
      })),
  ];

  return branches.sort(
    (a, b) => new Date(b.latestCommit.date).getTime() - new Date(a.latestCommit.date).getTime(),
  );
};

const runGit = async (repoPath: string, args: string[], maxBuffer: number): Promise<string> => {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer,
  });
  return stdout;
};

const runGitSync = (repoPath: string, args: string[], maxBuffer: number): string =>
  execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer,
  });

const commandFailedWithDiff = (error: unknown): boolean =>
  typeof error === "object" &&
  error != null &&
  "status" in error &&
  (error as { status?: number }).status === 1;

const hasGitDiff = (repoPath: string, args: string[]): boolean => {
  try {
    execFileSync("git", args, {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "ignore", "pipe"],
    });
    return false;
  } catch (error) {
    if (commandFailedWithDiff(error)) {
      return true;
    }

    throw error;
  }
};

const getGitLocalRefState = (repoPath: string) => {
  const hasStaged = hasGitDiff(repoPath, ["diff", "--cached", "--quiet", "--exit-code", "--"]);
  const hasUnstaged = hasGitDiff(repoPath, ["diff", "--quiet", "--exit-code", "--"]);

  return {
    hasStaged,
    // The synthetic worktree snapshot represents tracked staged + unstaged changes.
    hasWorktree: hasStaged || hasUnstaged,
  };
};

function resolveGitRef(repoPath: string, ref: string): string {
  if (isStagedRef(ref)) {
    return runGitSync(repoPath, ["write-tree"], 1024 * 1024).trim();
  }

  if (isWorktreeRef(ref)) {
    const snapshot = runGitSync(repoPath, ["stash", "create"], 1024 * 1024).trim();

    return snapshot || "HEAD";
  }

  return ref;
}

/**
 * Git local VCS adapter
 * Executes git commands to fetch diffs and commits
 */
export class GitLocalAdapter implements VCSAdapter {
  constructor(private readonly _repoPath: string = process.cwd()) {}

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
          runGit(
            repoPath,
            ["diff", ...(options?.ignoreWhitespace ? ["--ignore-all-space"] : []), fromRef, toRef],
            50 * 1024 * 1024,
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
      try: () => runGit(repoPath, ["show", `${resolvedRef}:${path}`], 10 * 1024 * 1024),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get file content: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    });
  }

  getCommits(
    limit: number = 20,
    options?: { branch?: string; offset?: number },
  ): Effect.Effect<CommitInfo[], VCSError> {
    const repoPath = this._repoPath;
    const branch = options?.branch;
    const offset = options?.offset || 0;
    const format = "%x1e%H%x1f%s%x1f%an%x1f%aI";
    const args = [
      "log",
      `--pretty=format:${format}`,
      "--shortstat",
      "-n",
      String(limit),
      `--skip=${offset}`,
      branch || "--all",
    ];
    const command = `git ${args.join(" ")}`;

    return Effect.tryPromise({
      try: async () => {
        const localEntries =
          offset === 0 ? createLocalCommitEntries(getGitLocalRefState(repoPath)) : [];
        const stdout = await runGit(repoPath, args, 10 * 1024 * 1024);
        const commits = stdout
          .split("\u001e")
          .map((chunk) => parseCommitStats(chunk))
          .filter((commit): commit is CommitInfo => commit != null);

        return [...localEntries, ...commits];
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
      try: async () => (await runGit(repoPath, ["branch", "--show-current"], 1024 * 1024)).trim(),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
          command: "git branch --show-current",
        }),
    });
  }

  getBranches(): Effect.Effect<BranchInfo[], VCSError> {
    const repoPath = this._repoPath;
    const localArgs = [
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:short)%(upstream:short)%(authorname)%(authordate:iso8601-strict)%(subject)%(objectname)",
      "refs/heads",
    ];
    const remoteArgs = [
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:short)%(authorname)%(authordate:iso8601-strict)%(subject)%(objectname)",
      "refs/remotes",
    ];

    return Effect.tryPromise({
      try: async () => {
        const [localStdout, remoteStdout] = await Promise.all([
          runGit(repoPath, localArgs, 10 * 1024 * 1024),
          runGit(repoPath, remoteArgs, 10 * 1024 * 1024),
        ]);

        return buildGitBranchInfo(
          parseGitLocalBranchRows(localStdout),
          parseGitRemoteBranchRows(remoteStdout),
        );
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get branches: ${error instanceof Error ? error.message : String(error)}`,
          command: `git ${localArgs.join(" ")}`,
        }),
    });
  }

  getCommitDistance(from: string, to: string): Effect.Effect<number | null, VCSError> {
    if (isLocalRef(from) || isLocalRef(to)) {
      return Effect.succeed(null);
    }

    const repoPath = this._repoPath;
    const command = `git rev-list --count ${from}..${to}`;

    return Effect.tryPromise({
      try: async () => {
        const stdout = await runGit(
          repoPath,
          ["rev-list", "--count", `${from}..${to}`],
          1024 * 1024,
        );
        const count = parseInt(stdout.trim(), 10);
        return Number.isNaN(count) ? null : count;
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get commit distance: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    });
  }

  listRepositories(
    basePaths?: string[],
  ): Effect.Effect<Array<{ path: string; name: string }>, VCSError> {
    return Effect.tryPromise({
      try: () => listVcsRepositories(basePaths),
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
