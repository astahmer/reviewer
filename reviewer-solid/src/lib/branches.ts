import { BranchInfo } from "~/lib/types";

const DEFAULT_BRANCHES = ["main", "master", "develop", "dev", "release"];

export const findBranchByName = (
  branches: BranchInfo[],
  branchName: string | undefined,
): BranchInfo | undefined => {
  if (!branchName) {
    return undefined;
  }

  return branches.find((branch) => branch.name === branchName);
};

export const getBranchDisplayName = (
  branch: Pick<BranchInfo, "displayName" | "name"> | undefined,
): string => branch?.displayName || branch?.name || "";

export const getDefaultBranchName = (
  branches: BranchInfo[],
  currentBranch?: string,
): string | undefined => {
  if (currentBranch && branches.some((branch) => branch.name === currentBranch)) {
    return currentBranch;
  }

  return (
    branches.find((branch) => DEFAULT_BRANCHES.includes(branch.baseName.toLowerCase()))?.name ||
    branches[0]?.name
  );
};

export const getBranchScopeLabel = (branch: Pick<BranchInfo, "scope">): string => {
  if (branch.scope === "tracked") {
    return "remote";
  }

  return branch.scope;
};
