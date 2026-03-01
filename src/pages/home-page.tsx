import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { FC, useEffect, useMemo, useState, useRef } from "react";
import { CommitInfo, Diff, BranchInfo } from "~/lib/types";
import type { SearchParams } from "~/routes/index";
import { DiffViewer } from "~/components/diff-viewer";
import { BranchSelector } from "~/components/branch-selector";
import { CommitSelector } from "~/components/commit-selector";
import { CommitCompare } from "~/components/commit-compare";
import { RepositorySelector } from "~/components/repository-selector";
import { CustomPathsInput } from "~/components/custom-paths-input";
import { ErrorBanner } from "~/components/error-banner";
import { EmptyState } from "~/components/empty-state";

const REPO_STORAGE_KEY = "selectedRepoPath";
const CUSTOM_PATHS_KEY = "customSearchPaths";
const CONTROLS_COLLAPSED_KEY = "controlsCollapsed";

interface Repository {
  path: string;
  name: string;
}

export const HomePage: FC = () => {
  const navigate = useNavigate({ from: "/" });
  const searchParams = useSearch({ from: "/" });
  const queryClient = useQueryClient();

  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [baseBranch, setBaseBranch] = useState<string>("");
  const [headBranch, setHeadBranch] = useState<string>("");
  const [baseCommit, setBaseCommit] = useState<string>("");
  const [headCommit, setHeadCommit] = useState<string>("");
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const prevBaseBranchRef = useRef<string>("");
  const prevHeadBranchRef = useRef<string>("");
  const baseCommitsLoadedRef = useRef(false);
  const headCommitsLoadedRef = useRef(false);

  const updateUrl = (updates: Partial<SearchParams>) =>
    navigate({
      search: (prev: SearchParams) => ({
        ...prev,
        ...updates,
      }),
    });

  useEffect(() => {
    const saved = localStorage.getItem(REPO_STORAGE_KEY);
    if (saved) {
      try {
        const repo = JSON.parse(saved);
        setSelectedRepo(repo);
      } catch {}
    }
    const savedPaths = localStorage.getItem(CUSTOM_PATHS_KEY);
    if (savedPaths) {
      try {
        setCustomPaths(JSON.parse(savedPaths));
      } catch {}
    }
    const savedCollapsed = localStorage.getItem(CONTROLS_COLLAPSED_KEY);
    if (savedCollapsed) {
      setControlsCollapsed(JSON.parse(savedCollapsed));
    }

    if (searchParams.repoPath && !selectedRepo) {
      const repo = {
        path: searchParams.repoPath,
        name: searchParams.repoPath.split("/").pop() || "repo",
      };
      setSelectedRepo(repo);
    }
    if (searchParams.baseBranch) setBaseBranch(searchParams.baseBranch);
    if (searchParams.headBranch) setHeadBranch(searchParams.headBranch);
    if (searchParams.baseCommit) setBaseCommit(searchParams.baseCommit);
    if (searchParams.headCommit) setHeadCommit(searchParams.headCommit);
  }, []);

  const allSearchPaths = useMemo(() => {
    const defaults = ["/Users/astahmer/dev", "/Users/astahmer/projects"];
    return [...customPaths, ...defaults.filter((d) => !customPaths.includes(d))];
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
    if (baseBranch === headBranch && baseCommit) {
      return headCommits.filter(
        (c) => c.hash !== baseCommit && !c.hash.startsWith(baseCommit.slice(0, 7)),
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
    const defaults = ["main", "master", "develop", "dev", "release"];
    return branches.find((b) => defaults.includes(b.name.toLowerCase()))?.name || branches[0]?.name;
  }, [branches]);

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
    enabled: !!selectedRepo && !!baseCommit && !!headCommit && baseBranch === headBranch,
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

  useEffect(() => {
    if (selectedRepo && branches.length > 0 && !initialized) {
      setInitialized(true);
      if (!baseBranch && defaultBranch) {
        setBaseBranch(defaultBranch);
        updateUrl({ baseBranch: defaultBranch });
      }
      if (!headBranch && defaultBranch) {
        setHeadBranch(defaultBranch);
        updateUrl({ headBranch: defaultBranch });
      }
    }
  }, [selectedRepo, branches, defaultBranch]);

  useEffect(() => {
    if (baseCommits.length > 0 && baseBranch && !baseCommit && initialized) {
      const shouldAutoSelect =
        !baseCommitsLoadedRef.current || prevBaseBranchRef.current === baseBranch;
      if (shouldAutoSelect) {
        baseCommitsLoadedRef.current = true;
        setBaseCommit(baseCommits[0]?.hash || "");
        updateUrl({ baseCommit: baseCommits[0]?.hash || "" });
      }
    }
  }, [baseCommits, baseBranch, baseCommit, initialized]);

  useEffect(() => {
    if (headCommits.length > 0 && headBranch && !headCommit && initialized) {
      const shouldAutoSelect =
        !headCommitsLoadedRef.current || prevHeadBranchRef.current === headBranch;
      if (shouldAutoSelect) {
        headCommitsLoadedRef.current = true;
        setHeadCommit(headCommits[0]?.hash || "");
        updateUrl({ headCommit: headCommits[0]?.hash || "" });
      }
    }
  }, [headCommits, headBranch, headCommit, initialized]);

  const combinedError = baseCommitsError || headCommitsError || diffError;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="relative z-1 border-b border-gray-200 bg-white"></header>

      {selectedRepo && (
        <details
          open={!controlsCollapsed}
          onToggle={(e) => {
            const open = (e.target as HTMLDetailsElement).open;
            setControlsCollapsed(!open);
            localStorage.setItem(CONTROLS_COLLAPSED_KEY, JSON.stringify(!open));
          }}
          className="border-b border-gray-200 bg-white"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 select-none">
            <div className="flex items-center justify-between gap-4 px-4">
              <h1 className="font-semibold text-gray-900">
                <Link to="/">Reviewer</Link>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <RepositorySelector
                repositories={repositories}
                selectedRepo={selectedRepo}
                onRepoChange={(repo) => {
                  setSelectedRepo(repo);
                  setBaseCommit("");
                  setHeadCommit("");
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
              />
            </div>

            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Base:</span>
                <BranchSelector
                  branches={branches}
                  value={baseBranch}
                  onChange={(branch) => {
                    prevBaseBranchRef.current = branch;
                    setBaseBranch(branch);
                    setBaseCommit("");
                    if (!headBranch) {
                      setHeadBranch(branch);
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
                    setBaseCommit(hash);
                    setHeadCommit("");
                    updateUrl({ baseCommit: hash, headCommit: "" });
                  }}
                  isLoading={baseCommitsLoading}
                  placeholder="commit"
                />
              </div>
              <span className="text-gray-400">→</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Head:</span>
                <BranchSelector
                  branches={branches}
                  value={headBranch}
                  onChange={(branch) => {
                    prevHeadBranchRef.current = branch;
                    setHeadBranch(branch);
                    setHeadCommit("");
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
                    setHeadCommit(hash);
                    updateUrl({ headCommit: hash });
                  }}
                  isLoading={headCommitsLoading}
                  placeholder="commit"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["diff"] })}
                className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                title="Refresh diff"
              >
                ↻
              </button>
            </div>
          </summary>
          <div className="bg-white p-3">
            <CustomPathsInput
              customPaths={customPaths}
              onAddPath={(path) => {
                if (path && !customPaths.includes(path)) {
                  const newPaths = [...customPaths, path];
                  setCustomPaths(newPaths);
                  localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
                }
              }}
              onRemovePath={(path) => {
                const newPaths = customPaths.filter((p) => p !== path);
                setCustomPaths(newPaths);
                localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
              }}
            />
            <ErrorBanner error={combinedError ? new Error(String(combinedError)) : null} />
          </div>
        </details>
      )}

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
        {!selectedRepo ? (
          <EmptyState />
        ) : baseCommitsLoading || headCommitsLoading || diffLoading ? (
          <div className="h-full rounded border border-gray-200 bg-white flex flex-col items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
            <p className="mt-2 text-sm text-gray-600">Loading diff...</p>
          </div>
        ) : diff ? (
          <DiffViewer diff={diff} repoPath={selectedRepo?.path} />
        ) : (
          <EmptyState message="No diff available for the selected refs." />
        )}
      </main>
    </div>
  );
};
