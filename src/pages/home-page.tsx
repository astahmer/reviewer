import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { FC, useEffect, useMemo, useState, useRef } from "react";
import { CommitInfo, Diff, BranchInfo } from "~/lib/types";
import type { SearchParams } from "~/routes/index";
import { DiffViewer } from "~/components/diff-viewer";
import { BranchSelector } from "~/components/branch-selector";
import { CommitSelector } from "~/components/commit-selector";
import { CommitCompare } from "~/components/commit-compare";
import { Combobox, useListCollection } from "@ark-ui/react/combobox";
import { useFilter } from "@ark-ui/react/locale";
import { Portal } from "@ark-ui/react/portal";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";

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
    if (searchParams.baseBranch) setBaseBranch(searchParams.baseBranch);
    if (searchParams.headBranch) setHeadBranch(searchParams.headBranch);
    if (searchParams.baseCommit) setBaseCommit(searchParams.baseCommit);
    if (searchParams.headCommit) setHeadCommit(searchParams.headCommit);
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

  // Handle baseBranch change - clear baseCommit
  useEffect(() => {
    if (initialized && prevBaseBranchRef.current !== baseBranch) {
      prevBaseBranchRef.current = baseBranch;
      if (baseBranch) {
        setBaseCommit("");
        updateUrl({ baseCommit: "" });
      }
    }
  }, [baseBranch, initialized]);

  // Handle headBranch change - clear headCommit
  useEffect(() => {
    if (initialized && prevHeadBranchRef.current !== headBranch) {
      prevHeadBranchRef.current = headBranch;
      if (headBranch) {
        setHeadCommit("");
        updateUrl({ headCommit: "" });
      }
    }
  }, [headBranch, initialized]);

  // Sync base -> head branch when base changes and head is empty
  useEffect(() => {
    if (baseBranch && !headBranch && initialized) {
      setHeadBranch(baseBranch);
      updateUrl({ headBranch: baseBranch });
    }
  }, [baseBranch, headBranch, initialized]);

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

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">
              <Link to="/">Reviewer</Link>
            </h1>

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
                    setBaseBranch(branch);
                    updateUrl({ baseBranch: branch });
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
                    setHeadBranch(branch);
                    updateUrl({ headBranch: branch });
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

      <main className="flex-1 min-h-0 p-2 overflow-hidden">
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

export const ComboboxExample = () => {
  const { contains } = useFilter({ sensitivity: "base" });

  const { collection, filter } = useListCollection({
    initialItems: [
      { label: "Engineering", value: "engineering" },
      { label: "Marketing", value: "marketing" },
      { label: "Sales", value: "sales" },
      { label: "Finance", value: "finance" },
      { label: "Human Resources", value: "hr" },
      { label: "Operations", value: "operations" },
      { label: "Product", value: "product" },
      { label: "Customer Success", value: "customer-success" },
      { label: "Legal", value: "legal" },
      { label: "Information Technology", value: "information-technology" },
      { label: "Design", value: "design" },
    ],
    filter: contains,
  });

  const handleInputChange = (details: Combobox.InputValueChangeDetails) => {
    filter(details.inputValue);
  };

  return (
    <Combobox.Root
      collection={collection}
      onInputValueChange={handleInputChange}
      inputBehavior="autohighlight"
    >
      <Combobox.Label>Department</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input placeholder="e.g. Engineering" />
        <div>
          <Combobox.ClearTrigger>
            <XIcon />
          </Combobox.ClearTrigger>
          <Combobox.Trigger>
            <ChevronsUpDownIcon />
          </Combobox.Trigger>
        </div>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>No results found</Combobox.Empty>
            {collection.items.map((item) => (
              <Combobox.Item key={item.value} item={item}>
                <Combobox.ItemText>{item.label}</Combobox.ItemText>
                <Combobox.ItemIndicator>
                  <CheckIcon />
                </Combobox.ItemIndicator>
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};
