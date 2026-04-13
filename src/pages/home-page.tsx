import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import React, { FC, useCallback, useEffect, useMemo, useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CommitCompare } from "~/components/commit-compare";
import { DiffViewer } from "~/components/diff-viewer";
import { ErrorBanner } from "~/components/error-banner.tsx";
import {
  getSystemColorMode,
  useColorMode,
  useGlobalColorMode,
  useLocalStorage,
  useTheme,
} from "~/components/hooks";
import { RevisionSelector } from "~/components/revision-selector";
import { RepositorySelector } from "~/components/repository-selector";
import { findBranchByName, getBranchDisplayName, getDefaultBranchName } from "~/lib/branches";
import { DARK_THEMES, LIGHT_THEMES, STORAGE_KEYS } from "~/lib/constants";
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
const COMMITS_PER_PAGE = 20;

interface Repository {
  path: string;
  name: string;
}

export const HomePage: FC = () => {
  const navigate = useNavigate({ from: "/" });
  const searchParams = useSearch({ from: "/" });
  const queryClient = useQueryClient();
  const [, setTheme] = useTheme();
  const [, setColorMode] = useColorMode();
  const [globalColorMode, setGlobalColorMode] = useGlobalColorMode();
  const [lastLightTheme] = useLocalStorage<string>(STORAGE_KEYS.lastLightTheme, LIGHT_THEMES[0]);
  const [lastDarkTheme] = useLocalStorage<string>(STORAGE_KEYS.lastDarkTheme, DARK_THEMES[0]);

  const [customPaths, setCustomPaths] = React.useState<string[]>([]);
  const [initialized, setInitialized] = React.useState(false);
  const prevBaseBranchRef = useRef<string>("");
  const prevHeadBranchRef = useRef<string>("");
  const baseCommitsLoadedRef = useRef(false);
  const headCommitsLoadedRef = useRef(false);

  const selectedRepo = useMemo(
    () =>
      searchParams.repoPath
        ? {
            path: searchParams.repoPath,
            name: searchParams.repoPath.split("/").pop() || "repo",
          }
        : null,
    [searchParams.repoPath],
  );

  const baseBranch = searchParams.baseBranch ?? "";
  const headBranch = searchParams.headBranch ?? "";
  const baseCommit = searchParams.baseCommit ?? "";
  const headCommit = searchParams.headCommit ?? "";

  const updateUrl = useCallback(
    (updates: Partial<SearchParams>) =>
      navigate({
        search: (prev: SearchParams) => ({
          ...prev,
          ...updates,
        }),
      }),
    [navigate],
  );

  const handleGlobalColorModeChange = (nextMode: "light" | "dark" | "auto") => {
    setGlobalColorMode(nextMode);

    if (nextMode === "light") {
      setColorMode("light");
      setTheme(lastLightTheme);
      return;
    }

    if (nextMode === "dark") {
      setColorMode("dark");
      setTheme(lastDarkTheme);
      return;
    }

    const systemMode = getSystemColorMode();
    setColorMode("auto");
    setTheme(systemMode === "dark" ? lastDarkTheme : lastLightTheme);
  };

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
    data: baseCommitsData,
    fetchNextPage: fetchMoreBaseCommits,
    hasNextPage: hasMoreBaseCommits,
    isLoading: baseCommitsLoading,
    error: baseCommitsError,
  } = useInfiniteQuery({
    queryKey: ["commits", selectedRepo?.path, baseBranch],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const url = new URL("/api/commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      if (baseBranch) url.searchParams.set("branch", baseBranch);
      url.searchParams.set("limit", String(COMMITS_PER_PAGE));
      url.searchParams.set("offset", String(pageParam));
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return (await response.json()) as CommitInfo[];
    },
    getNextPageParam: (lastPage: CommitInfo[], allPages: CommitInfo[][]) => {
      const realInLast = lastPage.filter((c) => !isLocalRef(c.hash));
      if (realInLast.length < COMMITS_PER_PAGE) return undefined;
      return allPages.flat().filter((c) => !isLocalRef(c.hash)).length;
    },
    initialPageParam: 0,
    enabled: !!selectedRepo,
  });

  const baseCommits = useMemo(() => baseCommitsData?.pages.flat() ?? [], [baseCommitsData]);

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
    data: headCommitsData,
    fetchNextPage: fetchMoreHeadCommits,
    hasNextPage: hasMoreHeadCommits,
    isLoading: headCommitsLoading,
    error: headCommitsError,
  } = useInfiniteQuery({
    queryKey: ["commits", selectedRepo?.path, headBranch],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const url = new URL("/api/commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      if (headBranch) url.searchParams.set("branch", headBranch);
      url.searchParams.set("limit", String(COMMITS_PER_PAGE));
      url.searchParams.set("offset", String(pageParam));
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return (await response.json()) as CommitInfo[];
    },
    getNextPageParam: (lastPage: CommitInfo[], allPages: CommitInfo[][]) => {
      const realInLast = lastPage.filter((c) => !isLocalRef(c.hash));
      if (realInLast.length < COMMITS_PER_PAGE) return undefined;
      return allPages.flat().filter((c) => !isLocalRef(c.hash)).length;
    },
    initialPageParam: 0,
    enabled: !!selectedRepo,
  });

  const headCommits = useMemo(() => headCommitsData?.pages.flat() ?? [], [headCommitsData]);

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
    return getDefaultBranchName(branches, currentBranch);
  }, [branches, currentBranch]);

  const selectedBaseBranchInfo = useMemo(
    () => findBranchByName(branches, baseBranch || defaultBranch),
    [baseBranch, branches, defaultBranch],
  );
  const selectedHeadBranchInfo = useMemo(
    () => findBranchByName(branches, headBranch || defaultBranch),
    [branches, defaultBranch, headBranch],
  );
  const baseBranchLabel = getBranchDisplayName(selectedBaseBranchInfo) || baseBranch;
  const headBranchLabel = getBranchDisplayName(selectedHeadBranchInfo) || headBranch;
  const isSameBranchComparison = !!baseBranch && baseBranch === headBranch;

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

  const diffStats = useMemo(() => {
    if (!diff) return null;
    let additions = 0;
    let deletions = 0;
    for (const line of diff.flatLines) {
      if (line.type === "add") additions++;
      else if (line.type === "remove") deletions++;
    }
    return { files: diff.files.length, additions, deletions };
  }, [diff]);

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
    updateUrl,
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
  }, [baseCommits, baseBranch, baseCommit, initialized, updateUrl]);

  // Auto-select most recent headCommit when headCommits load after branch change
  useEffect(() => {
    if (headCommits.length > 0 && headBranch && !headCommit && initialized) {
      const shouldAutoSelect =
        !headCommitsLoadedRef.current || prevHeadBranchRef.current === headBranch;
      if (shouldAutoSelect) {
        headCommitsLoadedRef.current = true;
        const defaultHeadCommit = headCommits.find((commit) => commit.hash === LOCAL_REF_WORKTREE)
          ? LOCAL_REF_WORKTREE
          : getDefaultCommit(filteredHeadCommits)?.hash || "";
        updateUrl({ headCommit: defaultHeadCommit });
      }
    }
  }, [filteredHeadCommits, headBranch, headCommit, headCommits, initialized, updateUrl]);

  const combinedError = baseCommitsError || headCommitsError || diffError;

  if (!selectedRepo) {
    return (
      <div className="flex h-screen flex-col bg-[var(--app-bg)]">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2 dark:border-slate-800">
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reviewer</h1>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[var(--app-panel-muted)] p-1 dark:border-slate-700">
            <button
              onClick={() => handleGlobalColorModeChange("light")}
              className={`rounded px-2 py-1 transition-colors ${
                globalColorMode === "light"
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
              title="Light mode"
              aria-label="Light mode"
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => handleGlobalColorModeChange("auto")}
              className={`rounded px-2 py-1 transition-colors ${
                globalColorMode === "auto"
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
              title="Auto mode (follows system)"
              aria-label="Auto mode"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => handleGlobalColorModeChange("dark")}
              className={`rounded px-2 py-1 transition-colors ${
                globalColorMode === "dark"
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
              title="Dark mode"
              aria-label="Dark mode"
            >
              <Moon size={14} />
            </button>
          </div>
        </header>
        <main className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 p-8">
          <ErrorBanner error={combinedError ? new Error(String(combinedError)) : null} />
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a repository to get started
            </p>
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
              onAddCustomPath={(path) => {
                if (path && !customPaths.includes(path)) {
                  const newPaths = [...customPaths, path];
                  setCustomPaths(newPaths);
                  localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
                }
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--app-bg)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2 dark:border-slate-800">
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
            <RevisionSelector
              label="Base"
              branches={branches}
              commits={baseCommits}
              branchValue={baseBranch}
              commitValue={baseCommit}
              onBranchChange={(branch) => {
                prevBaseBranchRef.current = branch;
                if (!headBranch) {
                  updateUrl({ baseBranch: branch, baseCommit: "", headBranch: branch });
                } else {
                  updateUrl({ baseBranch: branch, baseCommit: "" });
                }
              }}
              onCommitChange={(hash: string) => {
                updateUrl({ baseCommit: hash, headCommit: "" });
              }}
              defaultBranch={defaultBranch}
              placeholder="base revision"
              isBranchLoading={branchesLoading}
              isCommitLoading={baseCommitsLoading}
            />
          </div>
          <span className="text-slate-400 dark:text-slate-600">→</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Head</span>
            <RevisionSelector
              label="Head"
              branches={branches}
              commits={filteredHeadCommits}
              branchValue={headBranch}
              commitValue={headCommit}
              onBranchChange={(branch) => {
                prevHeadBranchRef.current = branch;
                updateUrl({ headBranch: branch, headCommit: "" });
              }}
              onCommitChange={(hash) => {
                updateUrl({ headCommit: hash });
              }}
              defaultBranch={defaultBranch}
              placeholder="head revision"
              isBranchLoading={branchesLoading}
              isCommitLoading={headCommitsLoading}
            />
            {isSameBranchComparison && selectedBaseCommitInfo && selectedHeadCommitInfo ? (
              <div className="flex items-center gap-2 pl-1 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">
                    {getCommitDisplayLabel(selectedBaseCommitInfo)}
                  </span>
                </span>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">
                    {getCommitDisplayLabel(selectedHeadCommitInfo)}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {diffStats ? (
            <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2.5 text-[11px] dark:border-slate-700">
              <span className="text-slate-400 dark:text-slate-500">{diffStats.files} files</span>
              {diffStats.additions > 0 && (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{diffStats.additions}
                </span>
              )}
              {diffStats.deletions > 0 && (
                <span className="font-semibold text-rose-500 dark:text-rose-400">
                  -{diffStats.deletions}
                </span>
              )}
            </div>
          ) : null}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[var(--app-panel-muted)] p-1 dark:border-slate-700">
            <button
              onClick={() => handleGlobalColorModeChange("light")}
              className={`rounded px-2 py-1 transition-colors ${
                globalColorMode === "light"
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
              title="Global light mode"
              aria-label="Global light mode"
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => handleGlobalColorModeChange("auto")}
              className={`rounded px-2 py-1 transition-colors ${
                globalColorMode === "auto"
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
              title="Global auto mode"
              aria-label="Global auto mode"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => handleGlobalColorModeChange("dark")}
              className={`rounded px-2 py-1 transition-colors ${
                globalColorMode === "dark"
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
              title="Global dark mode"
              aria-label="Global dark mode"
            >
              <Moon size={14} />
            </button>
          </div>
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
          baseBranchLabel={baseBranchLabel}
          headBranchLabel={headBranchLabel}
          isSameBranchComparison={isSameBranchComparison}
          distance={commitDistance ?? null}
        />
      )}

      <main className="flex-1 min-h-0 p-2 overflow-hidden z-0">
        {baseCommitsLoading || headCommitsLoading || diffLoading ? (
          <div className="flex h-full flex-col items-center justify-center rounded border border-slate-200 bg-[var(--app-panel)] dark:border-slate-800">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 dark:border-slate-700"></div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Loading diff...</p>
          </div>
        ) : (
          <DiffViewer
            diff={diff}
            repoPath={selectedRepo?.path}
            baseBranchLabel={baseBranchLabel}
            headBranchLabel={headBranchLabel}
            isSameBranchComparison={isSameBranchComparison}
            baseCommits={baseCommits}
            headCommits={headCommits}
            baseCommit={baseCommit}
            headCommit={headCommit}
            onBaseCommitChange={(hash) => updateUrl({ baseCommit: hash, headCommit: "" })}
            onHeadCommitChange={(hash) => updateUrl({ headCommit: hash })}
            onLoadMoreBaseCommits={() => fetchMoreBaseCommits()}
            onLoadMoreHeadCommits={() => fetchMoreHeadCommits()}
            hasMoreBaseCommits={hasMoreBaseCommits}
            hasMoreHeadCommits={hasMoreHeadCommits}
          />
        )}
      </main>
    </div>
  );
};
