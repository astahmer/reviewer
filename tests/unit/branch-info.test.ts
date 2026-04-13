import { describe, expect, it } from "vitest";

import {
  buildGitBranchInfo,
  parseGitLocalBranchRows,
  parseGitRemoteBranchRows,
} from "../../src/adapters/vcs/git-local";
import { buildJjBranchInfo, parseJjBookmarkRows } from "../../src/adapters/vcs/jj";
import { getDefaultBranchName } from "../../src/lib/branches";

const toJjCommitJson = (hash: string, description: string, timestamp: string) =>
  JSON.stringify({
    commit_id: hash,
    description: `${description}\n`,
    author: {
      name: "Reviewer",
      email: "reviewer@example.com",
      timestamp,
    },
    committer: {
      name: "Reviewer",
      email: "reviewer@example.com",
      timestamp,
    },
  });

describe("branch metadata", () => {
  it("formats git local, tracked, and remote-only branches for the unified selector", () => {
    const localStdout = [
      [
        "feat/local-only",
        "",
        "Reviewer",
        "2026-02-01T10:00:00Z",
        "Local only branch",
        "1111111111111111111111111111111111111111",
      ].join("\u001f"),
      [
        "fix/pushed",
        "origin/fix/pushed",
        "Reviewer",
        "2026-02-03T10:00:00Z",
        "Tracked branch",
        "2222222222222222222222222222222222222222",
      ].join("\u001f"),
    ].join("\n");

    const remoteStdout = [
      [
        "origin/fix/pushed",
        "Reviewer",
        "2026-02-03T10:00:00Z",
        "Tracked branch",
        "2222222222222222222222222222222222222222",
      ].join("\u001f"),
      [
        "upstream/release",
        "Reviewer",
        "2026-02-02T10:00:00Z",
        "Remote branch",
        "3333333333333333333333333333333333333333",
      ].join("\u001f"),
    ].join("\n");

    const branches = buildGitBranchInfo(
      parseGitLocalBranchRows(localStdout),
      parseGitRemoteBranchRows(remoteStdout),
    );

    expect(branches.find((branch) => branch.name === "feat/local-only")).toMatchObject({
      displayName: "feat/local-only",
      scope: "local",
    });
    expect(branches.find((branch) => branch.name === "fix/pushed")).toMatchObject({
      displayName: "fix/pushed@origin",
      scope: "tracked",
    });
    expect(branches.find((branch) => branch.name === "upstream/release")).toMatchObject({
      displayName: "release@upstream",
      scope: "remote",
    });
    expect(getDefaultBranchName(branches, "")).toBe("upstream/release");
  });

  it("ignores the synthetic jj git remote and surfaces pushed bookmarks", () => {
    const stdout = [
      [
        "feat/local-only",
        "",
        "0",
        "1",
        "1",
        toJjCommitJson(
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "Local only bookmark",
          "2026-03-01T10:00:00Z",
        ),
      ].join("\t"),
      [
        "fix/pushed",
        "",
        "0",
        "1",
        "1",
        toJjCommitJson(
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "Tracked bookmark",
          "2026-03-02T10:00:00Z",
        ),
      ].join("\t"),
      [
        "fix/pushed",
        "origin",
        "1",
        "1",
        "1",
        toJjCommitJson(
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "Tracked bookmark",
          "2026-03-02T10:00:00Z",
        ),
      ].join("\t"),
      [
        "main",
        "git",
        "1",
        "1",
        "1",
        toJjCommitJson(
          "cccccccccccccccccccccccccccccccccccccccc",
          "Git remote mirror",
          "2026-03-03T10:00:00Z",
        ),
      ].join("\t"),
    ].join("\n");

    const branches = buildJjBranchInfo(parseJjBookmarkRows(stdout));

    expect(branches.find((branch) => branch.name === "feat/local-only")).toMatchObject({
      displayName: "feat/local-only",
      scope: "local",
    });
    expect(branches.find((branch) => branch.name === "fix/pushed")).toMatchObject({
      displayName: "fix/pushed@origin",
      scope: "tracked",
    });
    expect(branches.find((branch) => branch.displayName === "main@git")).toBeUndefined();
  });
});
