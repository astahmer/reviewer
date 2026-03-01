import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { FC, useEffect, useMemo, useState, useRef } from "react";
import { CommitInfo, Diff, BranchInfo } from "~/lib/types";
import type { SearchParams } from "~/routes/index";
import { DiffViewer } from "~/components/diff-viewer";
import { BranchSelector } from "~/components/branch-selector";
import { CommitSelector } from "~/components/commit-selector";
import { CommitCompare } from "~/components/commit-compare";
import { Combobox, createListCollection } from "@ark-ui/react/combobox";
import { useFilter } from "@ark-ui/react/locale";
import { Portal } from "@ark-ui/react/portal";
import { Popover } from "@ark-ui/react/popover";
import { ChevronDown } from "lucide-react";

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
  const [customPathInput, setCustomPathInput] = useState("");
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const prevBaseBranchRef = useRef<string>("");
  const prevHeadBranchRef = useRef<string>("");
  const baseCommitsLoadedRef = useRef(false);
  const headCommitsLoadedRef = useRef(false);

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

    // Load from URL search params if available
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

  // Filter headCommits when branches are the same - exclude baseCommit
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

  // Initialize base/head branches to default branch when repo is first loaded
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

  // Auto-select most recent baseCommit when baseCommits load after branch change
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

  // Auto-select most recent headCommit when headCommits load after branch change
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

  const handleRepoChange = (repo: Repository) => {
    setSelectedRepo(repo);
    setBaseCommit("");
    setHeadCommit("");
    localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repo));

    // Reset refs
    prevBaseBranchRef.current = "";
    prevHeadBranchRef.current = "";
    baseCommitsLoadedRef.current = false;
    headCommitsLoadedRef.current = false;

    // Update URL with repo path
    updateUrl({
      repoPath: repo.path,
      baseBranch: "",
      headBranch: "",
      baseCommit: "",
      headCommit: "",
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

  const baseDisplay = getRefDisplay(baseCommit, baseCommits);
  const headDisplay = getRefDisplay(headCommit, headCommits);

  const filters = useFilter({ sensitivity: "base" });
  const collection = createListCollection({
    items: repositories,
    itemToString: (item) => item.name,
    itemToValue: (item) => item.path,
  });

  const [repoInputValue, setRepoInputValue] = useState("");
  const [repoOpen, setRepoOpen] = useState(false);

  const filteredRepos = collection.items.filter(
    (repo) =>
      filters.contains(repo.name, repoInputValue) || filters.contains(repo.path, repoInputValue),
  );

  const handleRepoValueChange = (details: Combobox.ValueChangeDetails) => {
    if (details.value.length > 0) {
      const repo = repositories.find((r) => r.path === details.value[0]);
      if (repo) {
        handleRepoChange(repo);
        setRepoOpen(false);
      }
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="relative z-1 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">
              <Link to="/">Reviewer</Link>
            </h1>

            <div className="flex items-center gap-2">
              {/* <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
                Repository:
              </label> */}
              <Popover.Root
                open={repoOpen}
                onOpenChange={(details) => {
                  setRepoOpen(details.open);
                  if (details.open) {
                    setRepoInputValue("");
                  }
                }}
                positioning={{ sameWidth: true }}
              >
                <Popover.Trigger asChild>
                  <button className="flex w-56 items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50">
                    <span className="truncate text-gray-900">
                      {selectedRepo?.name || "Select repository..."}
                    </span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
                  </button>
                </Popover.Trigger>
                <Portal>
                  <Popover.Positioner>
                    <Popover.Content className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                      <Combobox.Root
                        openOnClick
                        loopFocus
                        inputBehavior="autohighlight"
                        collection={collection}
                        value={selectedRepo ? [selectedRepo.path] : []}
                        onValueChange={handleRepoValueChange}
                        onInputValueChange={(details) => setRepoInputValue(details.inputValue)}
                      >
                        <Combobox.Control className="relative border-b border-gray-200">
                          <Combobox.Input
                            autoFocus
                            className="w-full bg-white px-2 py-1.5 text-xs outline-none placeholder:text-gray-400 focus:ring-0"
                            placeholder="Search repositories..."
                          />
                        </Combobox.Control>
                        <Combobox.List className="max-h-64 w-full overflow-y-auto p-1">
                          <Combobox.Empty className="px-2 py-3 text-center text-xs text-gray-400">
                            No repositories found
                          </Combobox.Empty>
                          {filteredRepos.map((repo) => (
                            <Combobox.Item
                              key={repo.path}
                              item={repo}
                              className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-50 data-[highlighted]:bg-gray-50 data-[selected]:bg-blue-50"
                            >
                              <span className="truncate">{repo.name}</span>
                              <Combobox.ItemIndicator>
                                <svg
                                  className="h-4 w-4 flex-shrink-0 text-blue-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </Combobox.ItemIndicator>
                            </Combobox.Item>
                          ))}
                        </Combobox.List>
                      </Combobox.Root>
                    </Popover.Content>
                  </Popover.Positioner>
                </Portal>
              </Popover.Root>
            </div>
          </div>

          {selectedRepo && diff && (
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <span className="font-mono" title={baseDisplay.sublabel}>
                {baseDisplay.label}
              </span>
              <span className="text-gray-400">→</span>
              <span className="font-mono" title={headDisplay.sublabel}>
                {headDisplay.label}
              </span>
              {currentBranch && (
                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-1 font-mono text-xs font-medium text-blue-700 ml-2">
                  {currentBranch}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
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
        </div>
      </header>

      {!controlsCollapsed && selectedRepo && (
        <div className="border-b border-gray-200 bg-white p-3 relative">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-700">Base</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch</label>
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
                  placeholder="Select branch..."
                  isLoading={branchesLoading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Commit</label>
                <CommitSelector
                  commits={baseCommits}
                  value={baseCommit}
                  onChange={(hash) => {
                    setBaseCommit(hash);
                    setHeadCommit("");
                    updateUrl({ baseCommit: hash, headCommit: "" });
                  }}
                  isLoading={baseCommitsLoading}
                  placeholder="Select commit..."
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-700">Head</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch</label>
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
                  placeholder="Select branch..."
                  isLoading={branchesLoading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Commit</label>
                <CommitSelector
                  commits={filteredHeadCommits}
                  value={headCommit}
                  onChange={(hash) => {
                    setHeadCommit(hash);
                    updateUrl({ headCommit: hash });
                  }}
                  isLoading={headCommitsLoading}
                  placeholder="Select commit..."
                />
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

          {(baseCommitsError || headCommitsError || diffError) && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
              {baseCommitsError instanceof Error
                ? baseCommitsError.message
                : headCommitsError instanceof Error
                  ? headCommitsError.message
                  : diffError instanceof Error
                    ? diffError.message
                    : "An error occurred"}
            </div>
          )}
        </div>
      )}

      {baseCommit && headCommit && (
        <div className="mt-4">
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
        </div>
      )}

      <main className="flex-1 min-h-0 p-2 overflow-hidden z-0">
        {!selectedRepo ? (
          <div className="h-full rounded border border-gray-200 bg-white flex items-center justify-center text-gray-600 text-sm">
            Select a repository to get started.
          </div>
        ) : baseCommitsLoading || headCommitsLoading || diffLoading ? (
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
