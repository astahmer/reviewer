import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import React, { FC, useEffect, useMemo, useRef } from "react";
import { BranchSelector } from "~/components/branch-selector";
import { CommitCompare } from "~/components/commit-compare";
import { CommitSelector } from "~/components/commit-selector";
import { DiffViewer } from "~/components/diff-viewer";
import { EmptyState } from "~/components/empty-state";
import { ErrorBanner } from "~/components/error-banner.tsx";
import { RepositorySelector } from "~/components/repository-selector";
import {
  LOCAL_REF_WORKTREE,
  getCommitDisplayLabel,
  getDefaultCommit,
  isLocalRef,
  isRealCommitRef,
} from "~/lib/local-refs";
import { BranchInfo, CommitInfo, Diff } from "~/lib/types";
import type { SearchParams } from "~/routes/index";

const REPO_STORAGE_KEY = "selectedRepoPath";
const CUSTOM_PATHS_KEY = "customSearchPaths";

interface Repository {
  path: string;
  name: string;
}

export const HomePage: FC = () => {
  const navigate = useNavigate({ from: "/" });
  const searchParams = useSearch({ from: "/" });
  const queryClient = useQueryClient();

  const [customPaths, setCustomPaths] = React.useState<string[]>([]);
  const [initialized, setInitialized] = React.useState(false);
  const prevBaseBranchRef = useRef<string>("");
  const prevHeadBranchRef = useRef<string>("");
  const baseCommitsLoadedRef = useRef(false);
  const headCommitsLoadedRef = useRef(false);

  const selectedRepo = searchParams.repoPath
    ? {
        path: searchParams.repoPath,
        name: searchParams.repoPath.split("/").pop() || "repo",
      }
    : null;

  const baseBranch = searchParams.baseBranch ?? "";
  const headBranch = searchParams.headBranch ?? "";
  const baseCommit = searchParams.baseCommit ?? "";
  const headCommit = searchParams.headCommit ?? "";

  const updateUrl = (updates: Partial<SearchParams>) =>
    navigate({
      search: (prev: SearchParams) => ({
        ...prev,
        ...updates,
      }),
    });

  useEffect(() => {
    const savedPaths = localStorage.getItem(CUSTOM_PATHS_KEY);
    if (savedPaths) {
      try {
        setCustomPaths(JSON.parse(savedPaths));
      } catch {}
    }
  }, []);

  const allSearchPaths = useMemo(() => {
    return customPaths;
  }, [customPaths]);

  const { data: repositories = [] } = useQuery({
    queryKey: ["repositories", customPaths],
    queryFn: async () => {
      const params = new URLSearchParams();
      allSearchPaths.forEach((p) => params.append("basePath", p));
      const response = await fetch(`/api/repositories?${params}`);
      if (!response.ok) throw new Error("Failed to fetch repositories");
      return (await response.json()) as Repository[];
    },
  });

  const {
    data: baseCommits = [],
    isLoading: baseCommitsLoading,
    error: baseCommitsError,
  } = useQuery({
    queryKey: ["commits", selectedRepo?.path, baseBranch],
    queryFn: async () => {
      const url = new URL("/api/commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      if (baseBranch) url.searchParams.set("branch", baseBranch);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return (await response.json()) as CommitInfo[];
    },
    enabled: !!selectedRepo,
  });

  const { data: currentBranch, isLoading: currentBranchLoading } = useQuery({
    queryKey: ["currentBranch", selectedRepo?.path],
    queryFn: async () => {
      const url = new URL("/api/current-branch", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch current branch");
      return response.text();
    },
    enabled: !!selectedRepo,
  });

  const {
    data: headCommits = [],
    isLoading: headCommitsLoading,
    error: headCommitsError,
  } = useQuery({
    queryKey: ["commits", selectedRepo?.path, headBranch],
    queryFn: async () => {
      const url = new URL("/api/commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      if (headBranch) url.searchParams.set("branch", headBranch);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return (await response.json()) as CommitInfo[];
    },
    enabled: !!selectedRepo,
  });

  const filteredHeadCommits = useMemo(() => {
    if (baseBranch === headBranch && baseCommit && isRealCommitRef(baseCommit)) {
      return headCommits.filter(
        (c) =>
          isLocalRef(c.hash) ||
          (c.hash !== baseCommit && !c.hash.startsWith(baseCommit.slice(0, 7))),
      );
    }
    return headCommits;
  }, [headCommits, baseBranch, headBranch, baseCommit]);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branchesWithCommits", selectedRepo?.path],
    queryFn: async () => {
      const url = new URL("/api/branches-with-commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch branches");
      return (await response.json()) as BranchInfo[];
    },
    enabled: !!selectedRepo,
  });

  const defaultBranch = useMemo(() => {
    if (currentBranch && branches.some((branch) => branch.name === currentBranch)) {
      return currentBranch;
    }

    const defaults = ["main", "master", "develop", "dev", "release"];
    return branches.find((b) => defaults.includes(b.name.toLowerCase()))?.name || branches[0]?.name;
  }, [branches, currentBranch]);

  const selectedBaseCommitInfo = useMemo(
    () => baseCommits.find((c) => c.hash === baseCommit || c.hash.startsWith(baseCommit)),
    [baseCommit, baseCommits],
  );
  const selectedHeadCommitInfo = useMemo(
    () => headCommits.find((c) => c.hash === headCommit || c.hash.startsWith(headCommit)),
    [headCommit, headCommits],
  );

  useEffect(() => {
    setInitialized(false);
  }, [selectedRepo?.path]);

  const { data: commitDistance } = useQuery({
    queryKey: [
      "commitDistance",
      baseCommit,
      headCommit,
      selectedRepo?.path,
      baseBranch,
      headBranch,
    ],
    queryFn: async () => {
      if (!baseCommit || !headCommit || baseBranch !== headBranch) return null;
      const url = new URL("/api/commit-distance", window.location.origin);
      url.searchParams.set("base", baseCommit);
      url.searchParams.set("head", headCommit);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data.distance;
    },
    enabled:
      !!selectedRepo &&
      !!baseCommit &&
      !!headCommit &&
      baseBranch === headBranch &&
      isRealCommitRef(baseCommit) &&
      isRealCommitRef(headCommit),
  });

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useQuery({
    queryKey: ["diff", baseCommit, headCommit, selectedRepo?.path],
    queryFn: async () => {
      const url = new URL("/api/diff", window.location.origin);
      url.searchParams.set("base", baseCommit);
      url.searchParams.set("head", headCommit);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch diff");
      return (await response.json()) as Diff;
    },
    enabled: !!selectedRepo && !!baseCommit && !!headCommit,
  });

  // Initialize base/head branches to default branch when repo is first loaded
  useEffect(() => {
    if (selectedRepo && branches.length > 0 && !initialized && !currentBranchLoading) {
      setInitialized(true);
      if (!baseBranch && defaultBranch) {
        updateUrl({ baseBranch: defaultBranch });
      }
      if (!headBranch && defaultBranch) {
        updateUrl({ headBranch: defaultBranch });
      }
    }
  }, [
    selectedRepo,
    branches,
    defaultBranch,
    initialized,
    baseBranch,
    headBranch,
    currentBranchLoading,
  ]);

  // Auto-select most recent baseCommit when baseCommits load after branch change
  useEffect(() => {
    if (baseCommits.length > 0 && baseBranch && !baseCommit && initialized) {
      const shouldAutoSelect =
        !baseCommitsLoadedRef.current || prevBaseBranchRef.current === baseBranch;
      const defaultBaseCommit = getDefaultCommit(baseCommits);
      if (shouldAutoSelect) {
        baseCommitsLoadedRef.current = true;
        updateUrl({ baseCommit: defaultBaseCommit?.hash || "" });
      }
    }
  }, [baseCommits, baseBranch, baseCommit, initialized]);

  // Auto-select most recent headCommit when headCommits load after branch change
  useEffect(() => {
    if (headCommits.length > 0 && headBranch && !headCommit && initialized) {
      const shouldAutoSelect =
        !headCommitsLoadedRef.current || prevHeadBranchRef.current === headBranch;
      if (shouldAutoSelect) {
        headCommitsLoadedRef.current = true;
        updateUrl({ headCommit: LOCAL_REF_WORKTREE });
      }
    }
  }, [headCommits, headBranch, headCommit, initialized]);

  const combinedError = baseCommitsError || headCommitsError || diffError;

  if (!selectedRepo) {
    return (
      <div className="flex h-screen flex-col bg-gray-50">
        <main className="flex-1 min-h-0 p-2 overflow-hidden z-0">
          <ErrorBanner error={combinedError ? new Error(String(combinedError)) : null} />
          <EmptyState>
            <RepositorySelector
              repositories={repositories}
              selectedRepo={selectedRepo}
              onRepoChange={(repo) => {
                console.log("onRepoChange", repo);
                localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repo));

                prevBaseBranchRef.current = "";
                prevHeadBranchRef.current = "";
                baseCommitsLoadedRef.current = false;
                headCommitsLoadedRef.current = false;

                updateUrl({
                  repoPath: repo.path,
                  baseBranch: "",
                  headBranch: "",
                  baseCommit: "",
                  headCommit: "",
                });
              }}
              onAddCustomPath={(path) => {
                if (path && !customPaths.includes(path)) {
                  const newPaths = [...customPaths, path];
                  setCustomPaths(newPaths);
                  localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
                }
              }}
            />
          </EmptyState>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--app-bg)]">
      <div className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2 hover:bg-slate-50 select-none dark:border-slate-800 dark:hover:bg-slate-900">
        <div className="flex flex-1 items-center gap-2.5">
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Link to="/">Reviewer</Link>
          </h1>
          <RepositorySelector
            repositories={repositories}
            selectedRepo={selectedRepo}
            onRepoChange={(repo) => {
              localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repo));

              prevBaseBranchRef.current = "";
              prevHeadBranchRef.current = "";
              baseCommitsLoadedRef.current = false;
              headCommitsLoadedRef.current = false;

              updateUrl({
                repoPath: repo.path,
                baseBranch: "",
                headBranch: "",
                baseCommit: "",
                headCommit: "",
              });
            }}
            onAddCustomPath={(path: string) => {
              if (path && !customPaths.includes(path)) {
                const newPaths = [...customPaths, path];
                setCustomPaths(newPaths);
                localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
                queryClient.invalidateQueries({ queryKey: ["repositories"] });
              }
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Base</span>
            <BranchSelector
              branches={branches}
              value={baseBranch}
              onChange={(branch) => {
                prevBaseBranchRef.current = branch;
                if (!headBranch) {
                  updateUrl({ baseBranch: branch, baseCommit: "", headBranch: branch });
                } else {
                  updateUrl({ baseBranch: branch, baseCommit: "" });
                }
              }}
              defaultBranch={defaultBranch}
              placeholder="branch"
              isLoading={branchesLoading}
            />
            <CommitSelector
              commits={baseCommits}
              value={baseCommit}
              onChange={(hash: string) => {
                updateUrl({ baseCommit: hash, headCommit: "" });
              }}
              isLoading={baseCommitsLoading}
              placeholder="commit"
            />
          </div>
          <span className="text-slate-400 dark:text-slate-600">→</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Head</span>
            <BranchSelector
              branches={branches}
              value={headBranch}
              onChange={(branch) => {
                prevHeadBranchRef.current = branch;
                updateUrl({ headBranch: branch, headCommit: "" });
              }}
              defaultBranch={defaultBranch}
              placeholder="branch"
              isLoading={branchesLoading}
            />
            <CommitSelector
              commits={filteredHeadCommits}
              value={headCommit}
              onChange={(hash) => {
                updateUrl({ headCommit: hash });
              }}
              isLoading={headCommitsLoading}
              placeholder="commit"
            />
            {baseBranch === headBranch && selectedBaseCommitInfo && selectedHeadCommitInfo ? (
              <div className="flex items-center gap-1 pl-1.5">
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                  Base {getCommitDisplayLabel(selectedBaseCommitInfo)}
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Head {getCommitDisplayLabel(selectedHeadCommitInfo)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["diff"] })}
            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh diff"
          >
            ↻
          </button>
        </div>
      </div>

      <ErrorBanner error={combinedError ? new Error(String(combinedError)) : null} />

      {baseCommit && headCommit && (
        <CommitCompare
          baseCommit={baseCommits.find(
            (c) => c.hash === baseCommit || c.hash.startsWith(baseCommit),
          )}
          headCommit={headCommits.find(
            (c) => c.hash === headCommit || c.hash.startsWith(headCommit),
          )}
          baseBranch={baseBranch}
          headBranch={headBranch}
          distance={commitDistance ?? null}
        />
      )}

      <main className="flex-1 min-h-0 p-2 overflow-hidden z-0">
        {baseCommitsLoading || headCommitsLoading || diffLoading ? (
          <div className="flex h-full flex-col items-center justify-center rounded border border-slate-200 bg-[var(--app-panel)] dark:border-slate-800">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 dark:border-slate-700"></div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Loading diff...</p>
          </div>
        ) : diff ? (
          <DiffViewer
            diff={diff}
            repoPath={selectedRepo?.path}
            baseBranch={baseBranch}
            headBranch={headBranch}
            baseCommits={baseCommits}
            headCommits={filteredHeadCommits}
            baseCommit={baseCommit}
            headCommit={headCommit}
            onBaseCommitChange={(hash) => updateUrl({ baseCommit: hash, headCommit: "" })}
            onHeadCommitChange={(hash) => updateUrl({ headCommit: hash })}
          />
        ) : (
          <EmptyState message="No diff available for the selected refs." />
        )}
      </main>
    </div>
  );
};
