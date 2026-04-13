import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface GitFixtureRepo {
  repoPath: string;
  cleanup: () => Promise<void>;
}

type RepoMode = "clean" | "with-local-changes";

const runGit = (cwd: string, args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

const writeFile = async (filePath: string, content: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
};

const commitAll = (repoPath: string, message: string) => {
  runGit(repoPath, ["add", "."]);
  runGit(repoPath, ["commit", "-m", message]);
};

export const createGitReviewRepo = async (mode: RepoMode): Promise<GitFixtureRepo> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "reviewer-e2e-"));
  const repoPath = path.join(tempDir, "repo");
  const remotePath = path.join(tempDir, "remote.git");
  const notesPath = path.join(repoPath, "notes.txt");

  runGit(tempDir, ["init", "--bare", remotePath]);
  runGit(tempDir, ["init", "-b", "main", repoPath]);
  runGit(repoPath, ["config", "user.name", "Reviewer E2E"]);
  runGit(repoPath, ["config", "user.email", "reviewer@example.com"]);

  await writeFile(notesPath, "main line\n");
  commitAll(repoPath, "initial commit");

  runGit(repoPath, ["remote", "add", "origin", remotePath]);
  runGit(repoPath, ["push", "-u", "origin", "main"]);

  runGit(repoPath, ["checkout", "-b", "fix/pushed"]);
  await fs.appendFile(notesPath, "pushed branch\n", "utf-8");
  commitAll(repoPath, "pushed branch commit");
  runGit(repoPath, ["push", "-u", "origin", "fix/pushed"]);

  runGit(repoPath, ["checkout", "main"]);
  runGit(repoPath, ["checkout", "-b", "feat/local-only"]);
  await fs.appendFile(notesPath, "local branch only\n", "utf-8");
  commitAll(repoPath, "local branch commit");

  runGit(repoPath, ["checkout", "fix/pushed"]);

  if (mode === "with-local-changes") {
    await fs.appendFile(notesPath, "staged change\n", "utf-8");
    runGit(repoPath, ["add", "notes.txt"]);
    await fs.appendFile(notesPath, "unstaged change\n", "utf-8");
  }

  return {
    repoPath,
    cleanup: () => fs.rm(tempDir, { recursive: true, force: true }),
  };
};