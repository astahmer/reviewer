import { createGitLocalAdapter } from "~/adapters/vcs/git-local";
import { createJjAdapter } from "~/adapters/vcs/jj";
import { isJjRepository } from "~/adapters/vcs/shared";
import { VCSAdapter } from "~/adapters/vcs/vcs.interface";

export const createVCSAdapter = (repoPath?: string): VCSAdapter => {
  const resolvedPath = repoPath || process.cwd();
  return isJjRepository(resolvedPath)
    ? createJjAdapter(resolvedPath)
    : createGitLocalAdapter(resolvedPath);
};
