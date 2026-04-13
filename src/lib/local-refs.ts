import { CommitInfo } from "~/lib/types";

export const LOCAL_REF_STAGED = "__local_ref_staged__";
export const LOCAL_REF_WORKTREE = "__local_ref_worktree__";

export const isStagedRef = (ref: string): boolean => ref === LOCAL_REF_STAGED;

export const isWorktreeRef = (ref: string): boolean => ref === LOCAL_REF_WORKTREE;

export const isLocalRef = (ref: string): boolean => isStagedRef(ref) || isWorktreeRef(ref);

export const isRealCommitRef = (ref: string): boolean => !isLocalRef(ref);

export const isLocalCommit = (commit: Pick<CommitInfo, "hash">): boolean => isLocalRef(commit.hash);

export const getLocalRefLabel = (ref: string): string => {
  if (isWorktreeRef(ref)) {
    return "Working tree";
  }

  if (isStagedRef(ref)) {
    return "Staging area";
  }

  return ref;
};

export const getLocalRefDescription = (ref: string): string => {
  if (isWorktreeRef(ref)) {
    return "Tracked local changes: staged + unstaged";
  }

  if (isStagedRef(ref)) {
    return "Tracked staged changes only";
  }

  return "";
};

export interface LocalRefState {
  hasStaged: boolean;
  hasWorktree: boolean;
}

export const getCommitDisplayLabel = (commit?: Pick<CommitInfo, "hash" | "label">): string => {
  if (!commit) {
    return "";
  }

  return (
    commit.label ||
    (isLocalRef(commit.hash) ? getLocalRefLabel(commit.hash) : commit.hash.slice(0, 7))
  );
};

export const createLocalCommitEntries = ({
  hasStaged,
  hasWorktree,
}: LocalRefState): CommitInfo[] => {
  const entries: CommitInfo[] = [];

  if (hasStaged) {
    entries.push({
      hash: LOCAL_REF_STAGED,
      message: getLocalRefDescription(LOCAL_REF_STAGED),
      author: "Local state",
      date: new Date(0),
      kind: "local-staged",
      label: getLocalRefLabel(LOCAL_REF_STAGED),
    });
  }

  if (hasWorktree) {
    entries.push({
      hash: LOCAL_REF_WORKTREE,
      message: getLocalRefDescription(LOCAL_REF_WORKTREE),
      author: "Local state",
      date: new Date(0),
      kind: "local-worktree",
      label: getLocalRefLabel(LOCAL_REF_WORKTREE),
    });
  }

  return entries;
};

export const getDefaultCommit = (commits: CommitInfo[]): CommitInfo | undefined =>
  commits.find((commit) => !isLocalCommit(commit)) || commits[0];
