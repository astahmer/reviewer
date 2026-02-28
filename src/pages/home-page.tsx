import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FC, useEffect, useMemo, useState } from "react";
import { CommitInfo, Diff } from "~/lib/types";
import type { SearchParams } from "~/routes/index";
import { DiffViewer } from "~/components/diff-viewer";

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
  const [fromBranch, setFromBranch] = useState<string>("");
  const [toBranch, setToBranch] = useState<string>("");
  const [fromCommit, setFromCommit] = useState<string>("");
  const [toCommit, setToCommit] = useState<string>("");
  const [customPathInput, setCustomPathInput] = useState("");
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);

  // Update URL whenever relevant state changes
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
        setSelectedRepo(JSON.parse(saved));
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

    // Load from URL search params if available
    if (searchParams.repoPath && !selectedRepo) {
      setSelectedRepo({
        path: searchParams.repoPath,
        name: searchParams.repoPath.split("/").pop() || "repo",
      });
    }
    if (searchParams.fromBranch) setFromBranch(searchParams.fromBranch);
    if (searchParams.toBranch) setToBranch(searchParams.toBranch);
    if (searchParams.fromCommit) setFromCommit(searchParams.fromCommit);
    if (searchParams.toCommit) setToCommit(searchParams.toCommit);
  }, []);

  const allSearchPaths = useMemo(() => {
    const defaults = ["/Users/astahmer/dev", "/Users/astahmer/projects"];
    return [...customPaths, ...defaults.filter((d) => !customPaths.includes(d))];
  }, [customPaths]);

  const { data: repositories = [], isLoading: reposLoading } = useQuery({
    queryKey: ["repositories", customPaths],
    queryFn: async () => {
      const params = new URLSearchParams();
      allSearchPaths.forEach((p) => params.append("basePath", p));
      const response = await fetch(`/api/repositories?${params}`);
      if (!response.ok) throw new Error("Failed to fetch repositories");
      return (await response.json()) as Repository[];
    },
  });

  const addCustomPath = () => {
    const path = customPathInput.trim();
    if (path && !customPaths.includes(path)) {
      const newPaths = [...customPaths, path];
      setCustomPaths(newPaths);
      localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
      setCustomPathInput("");
    }
  };

  const removeCustomPath = (path: string) => {
    const newPaths = customPaths.filter((p) => p !== path);
    setCustomPaths(newPaths);
    localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths));
  };

  const {
    data: fromCommits = [],
    isLoading: fromCommitsLoading,
    error: fromCommitsError,
  } = useQuery({
    queryKey: ["commits", selectedRepo?.path, fromBranch],
    queryFn: async () => {
      const url = new URL("/api/commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      if (fromBranch) url.searchParams.set("branch", fromBranch);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return (await response.json()) as CommitInfo[];
    },
    enabled: !!selectedRepo,
  });

  const {
    data: toCommits = [],
    isLoading: toCommitsLoading,
    error: toCommitsError,
  } = useQuery({
    queryKey: ["commits", selectedRepo?.path, toBranch],
    queryFn: async () => {
      const url = new URL("/api/commits", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      if (toBranch) url.searchParams.set("branch", toBranch);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch commits");
      return (await response.json()) as CommitInfo[];
    },
    enabled: !!selectedRepo,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", selectedRepo?.path],
    queryFn: async () => {
      const url = new URL("/api/branches", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch branches");
      return (await response.json()) as string[];
    },
    enabled: !!selectedRepo,
  });

  const { data: currentBranch = "main" } = useQuery({
    queryKey: ["currentBranch", selectedRepo?.path],
    queryFn: async () => {
      const url = new URL("/api/current-branch", window.location.origin);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch branch");
      return response.text();
    },
    enabled: !!selectedRepo,
  });

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useQuery({
    queryKey: ["diff", fromCommit, toCommit, selectedRepo?.path],
    queryFn: async () => {
      const url = new URL("/api/diff", window.location.origin);
      url.searchParams.set("from", fromCommit);
      url.searchParams.set("to", toCommit);
      if (selectedRepo) url.searchParams.set("repoPath", selectedRepo.path);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch diff");
      return (await response.json()) as Diff;
    },
    enabled: !!selectedRepo && !!fromCommit && !!toCommit,
  });

  const handleRepoChange = (repo: Repository) => {
    setSelectedRepo(repo);
    setFromCommit("");
    setToCommit("");
    localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repo));

    // Update URL with repo path
    updateUrl({
      repoPath: repo.path,
      fromBranch: "",
      toBranch: "",
      fromCommit: "",
      toCommit: "",
    });
  };

  const toggleControlsCollapsed = () => {
    const newState = !controlsCollapsed;
    setControlsCollapsed(newState);
    localStorage.setItem(CONTROLS_COLLAPSED_KEY, JSON.stringify(newState));
  };

  const getRefDisplay = (ref: string, commitList: CommitInfo[]) => {
    const info = commitList.find((c) => c.hash.startsWith(ref.slice(0, 7)) || ref === c.hash);
    if (ref === "" || ref === "") {
      return { label: ref, sublabel: info?.message || "" };
    }
    return {
      label: ref.slice(0, 7),
      sublabel: info?.message || "",
    };
  };

  const fromDisplay = getRefDisplay(fromCommit, fromCommits);
  const toDisplay = getRefDisplay(toCommit, toCommits);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Git Diff Reviewer</h1>

            <select
              value={selectedRepo?.path || ""}
              onChange={(e) => {
                const repo = repositories.find((r) => r.path === e.target.value);
                if (repo) handleRepoChange(repo);
              }}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              disabled={reposLoading}
            >
              <option value="">Select repository...</option>
              {repositories.map((repo: Repository) => (
                <option key={repo.path} value={repo.path}>
                  {repo.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRepo && diff && (
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <span className="font-mono" title={fromDisplay.sublabel}>
                {fromDisplay.label}
              </span>
              <span className="text-gray-400">→</span>
              <span className="font-mono" title={toDisplay.sublabel}>
                {toDisplay.label}
              </span>
              {currentBranch && (
                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-1 font-mono text-xs font-medium text-blue-700 ml-2">
                  {currentBranch}
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["diff"] })}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            title="Refresh diff"
          >
            ↻ Refresh
          </button>

          <button
            onClick={toggleControlsCollapsed}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            {controlsCollapsed ? "▼ Show" : "▲ Hide"} Controls
          </button>
        </div>
      </header>

      {!controlsCollapsed && selectedRepo && (
        <div className="border-b border-gray-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-700">From</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch (optional)</label>
                <input
                  list="from-branches"
                  value={fromBranch}
                  onChange={(e) => {
                    setFromBranch(e.target.value);
                    updateUrl({ fromBranch: e.target.value });
                  }}
                  placeholder="All branches"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <datalist id="from-branches">
                  {branches.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Commit</label>
                <input
                  list="from-commits"
                  value={fromCommit}
                  onChange={(e) => {
                    setFromCommit(e.target.value);
                    updateUrl({ fromCommit: e.target.value });
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                />
                <datalist id="from-commits">
                  {fromCommits.slice(0, 50).map((commit: CommitInfo) => (
                    <option key={commit.hash} value={commit.hash}>
                      {commit.hash.slice(0, 7)} - {commit.message}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-700">To</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch (optional)</label>
                <input
                  list="to-branches"
                  value={toBranch}
                  onChange={(e) => {
                    setToBranch(e.target.value);
                    updateUrl({ toBranch: e.target.value });
                  }}
                  placeholder="All branches"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <datalist id="to-branches">
                  {branches.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Commit</label>
                <input
                  list="to-commits"
                  value={toCommit}
                  onChange={(e) => {
                    setToCommit(e.target.value);
                    updateUrl({ toCommit: e.target.value });
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                />
                <datalist id="to-commits">
                  {toCommits.slice(0, 50).map((commit: CommitInfo) => (
                    <option key={commit.hash} value={commit.hash}>
                      {commit.hash.slice(0, 7)} - {commit.message}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <label className="block text-xs font-medium text-gray-700 mb-1">Custom Paths</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomPath()}
                placeholder="Add path to search for repos..."
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <button
                onClick={addCustomPath}
                className="rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
              >
                Add
              </button>
            </div>
            {customPaths.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {customPaths.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs"
                  >
                    {p}
                    <button
                      onClick={() => removeCustomPath(p)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {(fromCommitsError || toCommitsError || diffError) && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
              {fromCommitsError instanceof Error
                ? fromCommitsError.message
                : toCommitsError instanceof Error
                  ? toCommitsError.message
                  : diffError instanceof Error
                    ? diffError.message
                    : "An error occurred"}
            </div>
          )}
        </div>
      )}

      <main className="flex-1 min-h-0 p-2 overflow-hidden">
        {!selectedRepo ? (
          <div className="h-full rounded border border-gray-200 bg-white flex items-center justify-center text-gray-600 text-sm">
            Select a repository to get started.
          </div>
        ) : fromCommitsLoading || toCommitsLoading || diffLoading ? (
          <div className="h-full rounded border border-gray-200 bg-white flex flex-col items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
            <p className="mt-2 text-sm text-gray-600">Loading diff...</p>
          </div>
        ) : diff ? (
          <DiffViewer diff={diff} repoPath={selectedRepo?.path} />
        ) : (
          <div className="h-full rounded border border-gray-200 bg-white flex items-center justify-center text-gray-600 text-sm">
            No diff available for the selected refs.
          </div>
        )}
      </main>
    </div>
  );
};
