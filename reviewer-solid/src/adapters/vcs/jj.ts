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

const JJ_COMMIT_TEMPLATE =
  'json(self) ++ "\t" ++ json(local_bookmarks) ++ "\t" ++ json(remote_bookmarks) ++ "\\n"';
const JJ_BOOKMARK_TEMPLATE =
  'self.name() ++ "\t" ++ coalesce(self.remote(), "") ++ "\t" ++ if(self.tracked(), "1", "0") ++ "\t" ++ if(self.synced(), "1", "0") ++ "\t" ++ if(self.present(), "1", "0") ++ "\t" ++ if(self.present(), json(self.normal_target()), "") ++ "\\n"';
const JJ_LOCAL_BOOKMARKS_TEMPLATE = 'json(local_bookmarks) ++ "\\n"';
const JJ_CURRENT_BOOKMARK_SCAN_LIMIT = 32;

interface JjSignatureJson {
  name: string;
  email: string;
  timestamp: string;
}

interface JjCommitJson {
  commit_id: string;
  description: string;
  author: JjSignatureJson;
  committer: JjSignatureJson;
}

interface JjBookmarkJson {
  name: string;
  remote?: string;
  target?: string[];
  tracking_target?: string[];
}

interface JjBookmarkRow {
  name: string;
  remoteName?: string;
  tracked: boolean;
  synced: boolean;
  present: boolean;
  latestCommit?: CommitInfo;
}

const runJj = async (repoPath: string, args: string[], maxBuffer: number): Promise<string> => {
  const { stdout } = await execFileAsync("jj", args, {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer,
  });
  return stdout;
};

const buildCommitInfoFromJjJson = (commit: JjCommitJson, statsLine?: string): CommitInfo => ({
  hash: commit.commit_id,
  message: commit.description.trimEnd(),
  author: commit.author.name || commit.author.email || "",
  date: new Date(commit.author.timestamp || commit.committer.timestamp || Date.now()),
  kind: "commit",
  additions: Number(statsLine?.match(/(\d+) insertions?\(\+\)/i)?.[1] || 0),
  deletions: Number(statsLine?.match(/(\d+) deletions?\(-\)/i)?.[1] || 0),
});

const isCommitHeaderLine = (line: string): boolean => line.startsWith("{") && line.includes("\t[");

const parseJjCommitLog = (stdout: string): CommitInfo[] => {
  const lines = stdout.split("\n");
  const commits: CommitInfo[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (!isCommitHeaderLine(line)) {
      index += 1;
      continue;
    }

    const [commitJson] = line.split("\t", 1);
    if (!commitJson) {
      index += 1;
      continue;
    }

    const commit = JSON.parse(commitJson) as JjCommitJson;
    index += 1;

    let statsLine = "";
    while (index < lines.length) {
      const candidate = lines[index]?.trim() || "";
      if (!candidate) {
        index += 1;
        continue;
      }

      if (isCommitHeaderLine(candidate)) {
        break;
      }

      if (/files? changed,/i.test(candidate)) {
        statsLine = candidate;
      }

      index += 1;
    }

    if (commit.commit_id !== "0000000000000000000000000000000000000000") {
      commits.push(buildCommitInfoFromJjJson(commit, statsLine));
    }
  }

  return commits;
};

const parseJjBookmarkCommit = (commitJson: string): CommitInfo | undefined => {
  if (!commitJson) {
    return undefined;
  }

  const commit = JSON.parse(commitJson) as JjCommitJson;
  if (commit.commit_id === "0000000000000000000000000000000000000000") {
    return undefined;
  }

  return buildCommitInfoFromJjJson(commit);
};

export const parseJjBookmarkRows = (stdout: string): JjBookmarkRow[] =>
  stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): JjBookmarkRow | null => {
      const [name, remoteName, tracked, synced, present, commitJson] = line.split("\t");
      if (!name) {
        return null;
      }

      return {
        name,
        remoteName: remoteName || undefined,
        tracked: tracked === "1",
        synced: synced === "1",
        present: present === "1",
        latestCommit: parseJjBookmarkCommit(commitJson || ""),
      };
    })
    .filter((row): row is JjBookmarkRow => row != null);

export const buildJjBranchInfo = (bookmarkRows: JjBookmarkRow[]): BranchInfo[] => {
  const localRows = bookmarkRows.filter((row) => !row.remoteName && row.present);
  const remoteRows = bookmarkRows.filter(
    (row) => row.remoteName && row.remoteName !== "git" && row.present,
  );
  const remoteNamesByBookmark = remoteRows.reduce((acc, row) => {
    const current = acc.get(row.name) || [];
    acc.set(
      row.name,
      Array.from(new Set([...current, row.remoteName || ""]))
        .filter(Boolean)
        .sort(),
    );
    return acc;
  }, new Map<string, string[]>());
  const localNames = new Set(localRows.map((row) => row.name));

  const branches: BranchInfo[] = [
    ...localRows
      .filter((row) => row.latestCommit)
      .map<BranchInfo>((row) => {
        const remoteName = remoteNamesByBookmark.get(row.name)?.[0];
        return {
          name: row.name,
          baseName: row.name,
          displayName: remoteName ? `${row.name}@${remoteName}` : row.name,
          scope: remoteName ? "tracked" : "local",
          remoteName,
          latestCommit: row.latestCommit!,
        };
      }),
    ...remoteRows
      .filter((row) => !localNames.has(row.name) && row.latestCommit)
      .map<BranchInfo>((row) => ({
        name: `${row.name}@${row.remoteName}`,
        baseName: row.name,
        displayName: `${row.name}@${row.remoteName}`,
        scope: "remote" as const,
        remoteName: row.remoteName,
        latestCommit: row.latestCommit!,
      })),
  ];

  return branches.sort(
    (a, b) => new Date(b.latestCommit.date).getTime() - new Date(a.latestCommit.date).getTime(),
  );
};

const resolveJjRef = (ref: string): string => {
  if (isWorktreeRef(ref) || isStagedRef(ref)) {
    return "@";
  }

  return ref;
};

const hasJjWorktreeChanges = (repoPath: string): boolean => {
  const stdout = execFileSync("jj", ["diff", "-r", "@", "--git"], {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout.trim().length > 0;
};

const findFirstLocalBookmark = (stdout: string): string => {
  for (const line of stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const bookmarks = JSON.parse(line) as JjBookmarkJson[];
    const bookmark = bookmarks.find((entry) => entry.name && !entry.remote);
    if (bookmark?.name) {
      return bookmark.name;
    }
  }

  return "";
};

const getJjCurrentBookmark = async (repoPath: string): Promise<string> => {
  const directStdout = await runJj(
    repoPath,
    [
      "log",
      "--no-graph",
      "--limit",
      "2",
      "--revisions",
      "@|@-",
      "--template",
      JJ_LOCAL_BOOKMARKS_TEMPLATE,
    ],
    1024 * 1024,
  );

  const directBookmark = findFirstLocalBookmark(directStdout);
  if (directBookmark) {
    return directBookmark;
  }

  const ancestorStdout = await runJj(
    repoPath,
    [
      "log",
      "--no-graph",
      "--limit",
      String(JJ_CURRENT_BOOKMARK_SCAN_LIMIT),
      "--revisions",
      "::@",
      "--template",
      JJ_LOCAL_BOOKMARKS_TEMPLATE,
    ],
    1024 * 1024,
  );

  return findFirstLocalBookmark(ancestorStdout);
};

/**
 * JJ local VCS adapter
 * Executes jj commands to fetch diffs, bookmarks, and revisions
 */
class JjAdapter implements VCSAdapter {
  constructor(private readonly _repoPath: string = process.cwd()) {}

  getDiff(
    from: string,
    to: string,
    options?: { ignoreWhitespace?: boolean },
  ): Effect.Effect<string, VCSError> {
    const repoPath = this._repoPath;
    const fromRef = resolveJjRef(from);
    const toRef = resolveJjRef(to);
    const args = [
      "diff",
      "--from",
      fromRef,
      "--to",
      toRef,
      "--git",
      ...(options?.ignoreWhitespace ? ["-w"] : []),
    ];
    const command = `jj ${args.join(" ")}`;

    return Effect.tryPromise({
      try: () =>
        Promise.race([
          runJj(repoPath, args, 50 * 1024 * 1024),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("JJ diff timeout")), GIT_DIFF_TIMEOUT_MS),
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
    const resolvedRef = resolveJjRef(commit);
    const args = ["file", "show", "-r", resolvedRef, path];
    const command = `jj ${args.join(" ")}`;

    return Effect.tryPromise({
      try: () => runJj(repoPath, args, 10 * 1024 * 1024),
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
    const requested = limit + offset;
    const args = [
      "log",
      "--no-graph",
      "--limit",
      String(requested),
      ...(branch ? ["--revisions", `::${branch}`] : []),
      "--stat",
      "--template",
      JJ_COMMIT_TEMPLATE,
    ];
    const command = `jj ${args.join(" ")}`;

    return Effect.tryPromise({
      try: async () => {
        const localEntries =
          offset === 0 && hasJjWorktreeChanges(repoPath)
            ? createLocalCommitEntries({ hasStaged: false, hasWorktree: true })
            : [];
        const stdout = await runJj(repoPath, args, 20 * 1024 * 1024);
        const commits = parseJjCommitLog(stdout).slice(offset, offset + limit);
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
      try: () => getJjCurrentBookmark(repoPath),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
          command: "jj log --revisions @|@-",
        }),
    });
  }

  getBranches(): Effect.Effect<BranchInfo[], VCSError> {
    const repoPath = this._repoPath;
    const args = ["bookmark", "list", "-a", "--template", JJ_BOOKMARK_TEMPLATE];
    const command = `jj ${args.join(" ")}`;

    return Effect.tryPromise({
      try: async () =>
        buildJjBranchInfo(parseJjBookmarkRows(await runJj(repoPath, args, 10 * 1024 * 1024))),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get branches: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    });
  }

  getCommitDistance(from: string, to: string): Effect.Effect<number | null, VCSError> {
    if (isLocalRef(from) || isLocalRef(to)) {
      return Effect.succeed(null);
    }

    const repoPath = this._repoPath;
    const revset = `(${from}::${to}) & ~(${from})`;
    const args = ["log", "--count", "--revisions", revset];
    const command = `jj ${args.join(" ")}`;

    return Effect.tryPromise({
      try: async () => {
        const stdout = await runJj(repoPath, args, 1024 * 1024);
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
          command: "find jj repos",
        }),
    });
  }
}

export const createJjAdapter = (repoPath?: string): VCSAdapter => new JjAdapter(repoPath);
