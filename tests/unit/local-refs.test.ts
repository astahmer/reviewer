import { describe, expect, it } from "vitest";

import {
  createLocalCommitEntries,
  LOCAL_REF_STAGED,
  LOCAL_REF_WORKTREE,
} from "../../src/lib/local-refs";

describe("createLocalCommitEntries", () => {
  it("omits synthetic entries when the repo is clean", () => {
    expect(createLocalCommitEntries({ hasStaged: false, hasWorktree: false })).toEqual([]);
  });

  it("keeps only the worktree entry when there are unstaged-only changes", () => {
    expect(
      createLocalCommitEntries({ hasStaged: false, hasWorktree: true }).map(
        (commit) => commit.hash,
      ),
    ).toEqual([LOCAL_REF_WORKTREE]);
  });

  it("orders staging before worktree when both local states exist", () => {
    expect(
      createLocalCommitEntries({ hasStaged: true, hasWorktree: true }).map((commit) => commit.hash),
    ).toEqual([LOCAL_REF_STAGED, LOCAL_REF_WORKTREE]);
  });
});
