import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const MAX_DEPTH = 3;

const hasDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

async function scanForVcsRepos(
  basePath: string,
  repos: Array<{ path: string; name: string }>,
  seen: Set<string>,
  currentDepth = 0,
): Promise<void> {
  if (currentDepth > MAX_DEPTH) {
    return;
  }

  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      const fullPath = path.join(basePath, entry.name);
      const hasGit = await hasDirectory(path.join(fullPath, ".git"));
      const hasJj = await hasDirectory(path.join(fullPath, ".jj"));

      if (hasGit || hasJj) {
        if (!seen.has(fullPath)) {
          repos.push({ path: fullPath, name: entry.name });
          seen.add(fullPath);
        }
        continue;
      }

      await scanForVcsRepos(fullPath, repos, seen, currentDepth + 1);
    }
  } catch {
    // Skip inaccessible directories
  }
}

export const listVcsRepositories = async (
  basePaths?: string[],
): Promise<Array<{ path: string; name: string }>> => {
  const paths = (basePaths || []).filter(Boolean);

  if (paths.length === 0) {
    return [];
  }

  const repos: Array<{ path: string; name: string }> = [];
  const seen = new Set<string>();

  for (const basePath of paths) {
    try {
      await scanForVcsRepos(basePath, repos, seen);
    } catch {
      // Skip directories that don't exist or can't be read
    }
  }

  return repos;
};

export const isJjRepository = (repoPath: string): boolean => {
  try {
    execFileSync("jj", ["root"], {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
};
