import type { FileDiffMetadata } from "@pierre/diffs";
import { useInfiniteQuery, useQuery } from "@tanstack/solid-query";
import { Link, useNavigate, useSearch } from "@tanstack/solid-router";
import { FolderOpen, History, Monitor, Moon, Shield, Sun } from "lucide-solid";
import {
  Show,
  Suspense,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  lazy,
  onMount,
} from "solid-js";
import { CommitCompare } from "~/components/commit-compare";
import { ErrorBanner } from "~/components/error-banner";
import {
  createLocalStorageSignal,
  getSystemColorMode,
  useColorMode,
  useGlobalColorMode,
  useTheme,
} from "~/components/hooks";
import { RepositorySelector } from "~/components/repository-selector";
import { RevisionSelector } from "~/components/revision-selector";
import { findBranchByName, getBranchDisplayName, getDefaultBranchName } from "~/lib/branches";
import { DARK_THEMES, LIGHT_THEMES, STORAGE_KEYS } from "~/lib/constants";
import {
  LOCAL_REF_WORKTREE,
  getCommitDisplayLabel,
  getDefaultCommit,
  isLocalRef,
  isRealCommitRef,
} from "~/lib/local-refs";
import type { BranchInfo, CommitInfo, Diff } from "~/lib/types";
import { queryClient } from "~/query-client";
import type { SearchParams } from "~/routes/index";

const REPO_STORAGE_KEY = "selectedRepoPath";
const CUSTOM_PATHS_KEY = "customSearchPaths";
const COMMITS_PER_PAGE = 20;

interface Repository {
  path: string;
  name: string;
}

type ReviewDiff = Diff & { pierreData?: FileDiffMetadata[] };
interface SelectedRepositoryViewProps {
  selectedRepo: Repository;
  repositories: Repository[];
  repositoriesLoading: boolean;
  customPaths: string[];
  globalColorMode: "light" | "dark" | "auto";
  onGlobalColorModeChange: (mode: "light" | "dark" | "auto") => void;
  onRepoChange: (repo: Repository) => void;
  onAddCustomPath: (path: string) => void;
  updateUrl: (updates: Partial<SearchParams>) => void;
  baseBranch: string;
  headBranch: string;
  baseCommit: string;
  headCommit: string;
}

const DiffViewer = lazy(async () => {
  const module = await import("~/components/diff-viewer");
  return { default: module.DiffViewer };
});

const toggleButtonClass = (selected: boolean) =>
  `rounded px-2 py-1 transition-colors ${
    selected
      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
  }`;

const toError = (error: unknown) => {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export function HomePage() {
  const navigate = useNavigate({ from: "/" });
  const repoPath = useSearch({
    from: "/",
    select: (search) => search.repoPath,
  });
  const baseBranchSearch = useSearch({
    from: "/",
    select: (search) => search.baseBranch,
  });
  const headBranchSearch = useSearch({
    from: "/",
    select: (search) => search.headBranch,
  });
  const baseCommitSearch = useSearch({
    from: "/",
    select: (search) => search.baseCommit,
  });
  const headCommitSearch = useSearch({
    from: "/",
    select: (search) => search.headCommit,
  });
  const [, setTheme] = useTheme();
  const [, setColorMode] = useColorMode();
  const [globalColorMode, setGlobalColorMode] = useGlobalColorMode();
  const [lastLightTheme] = createLocalStorageSignal<string>(
    STORAGE_KEYS.lastLightTheme,
    LIGHT_THEMES[0],
  );
  const [lastDarkTheme] = createLocalStorageSignal<string>(
    STORAGE_KEYS.lastDarkTheme,
    DARK_THEMES[0],
  );
  const [customPaths, setCustomPaths] = createLocalStorageSignal<string[]>(CUSTOM_PATHS_KEY, []);
  const [lastSelectedRepo, setLastSelectedRepo] = createLocalStorageSignal<Repository | null>(
    REPO_STORAGE_KEY,
    null,
  );

  const selectedRepo = createMemo<Repository | null>(() => {
    const nextRepoPath = repoPath();

    if (!nextRepoPath) {
      return null;
    }

    return {
      path: nextRepoPath,
      name: nextRepoPath.split("/").pop() || "repo",
    };
  });
  const baseBranch = createMemo(() => baseBranchSearch() ?? "");
  const headBranch = createMemo(() => headBranchSearch() ?? "");
  const baseCommit = createMemo(() => baseCommitSearch() ?? "");
  const headCommit = createMemo(() => headCommitSearch() ?? "");

  const updateUrl = (updates: Partial<SearchParams>) =>
    navigate({
      search: (previous: SearchParams) => ({
        ...previous,
        ...updates,
      }),
    });

  const handleGlobalColorModeChange = (nextMode: "light" | "dark" | "auto") => {
    setGlobalColorMode(nextMode);

    if (nextMode === "light") {
      setColorMode("light");
      setTheme(lastLightTheme());
      return;
    }

    if (nextMode === "dark") {
      setColorMode("dark");
      setTheme(lastDarkTheme());
      return;
    }

    const systemMode = getSystemColorMode();
    setColorMode("auto");
    setTheme(systemMode === "dark" ? lastDarkTheme() : lastLightTheme());
  };

  const [repositories] = createResource(
    customPaths,
    async (paths) => {
      if (paths.length === 0) {
        return [] as Repository[];
      }

      const params = new URLSearchParams();
      paths.forEach((path) => params.append("basePath", path));

      const response = await fetch(`/api/repositories?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }

      return (await response.json()) as Repository[];
    },
    { initialValue: [] },
  );

  const hasSearchRoots = createMemo(() => customPaths().length > 0);
  const repositoriesLoading = createMemo(() => hasSearchRoots() && repositories.loading);
  const repositoriesError = createMemo(() => toError(repositories.error));

  const handleRepoSelection = (repo: Repository) => {
    setLastSelectedRepo(repo);

    updateUrl({
      repoPath: repo.path,
      baseBranch: undefined,
      headBranch: undefined,
      baseCommit: undefined,
      headCommit: undefined,
    });
  };

  const handleAddCustomPath = (path: string) => {
    const nextPath = path.trim();

    if (!nextPath || customPaths().includes(nextPath)) {
      return;
    }

    setCustomPaths((currentPaths) => [...currentPaths, nextPath]);
  };

  return (
    <Show
      when={selectedRepo()}
      fallback={
        <div class="flex min-h-screen flex-col bg-[var(--app-bg)]">
          <header class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2 dark:border-slate-800">
            <h1 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Reviewer</h1>
            <div class="flex items-center gap-1 rounded-lg border border-slate-200 bg-[var(--app-panel-muted)] p-1 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleGlobalColorModeChange("light")}
                class={toggleButtonClass(globalColorMode() === "light")}
                aria-label="Light mode"
                title="Light mode"
              >
                <Sun size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleGlobalColorModeChange("auto")}
                class={toggleButtonClass(globalColorMode() === "auto")}
                aria-label="Auto mode"
                title="Auto mode"
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleGlobalColorModeChange("dark")}
                class={toggleButtonClass(globalColorMode() === "dark")}
                aria-label="Dark mode"
                title="Dark mode"
              >
                <Moon size={14} />
              </button>
            </div>
          </header>

          <main class="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden p-6 sm:p-8">
            <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(100,116,139,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.08),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.10),transparent_32%)]" />
            <div class="relative w-full max-w-5xl rounded-[2rem] border border-slate-200/80 bg-[var(--app-panel)]/95 p-5 shadow-[0_32px_120px_-52px_rgba(15,23,42,0.28)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/88 dark:shadow-[0_32px_120px_-52px_rgba(0,0,0,0.72)] sm:p-6">
              <ErrorBanner error={repositoriesError()} />

              <div class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
                <section class="space-y-5">
                  <div class="space-y-3">
                    <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Repository setup
                    </span>
                    <div class="space-y-2">
                      <h2 class="max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                        Open a repository.
                      </h2>
                      <p class="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Reviewer looks only inside the folders you add here. Open something recent,
                        or add a folder and pick a repository from it.
                      </p>
                    </div>
                  </div>

                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
                      <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <History class="h-3.5 w-3.5" />
                        Last repository
                      </div>
                      <Show
                        when={lastSelectedRepo()}
                        fallback={
                          <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            You haven't opened a repository here yet.
                          </p>
                        }
                      >
                        <button
                          type="button"
                          onClick={() => handleRepoSelection(lastSelectedRepo()!)}
                          class="mt-3 w-full rounded-2xl border border-slate-200 bg-[var(--app-panel)] px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
                        >
                          <span class="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {lastSelectedRepo()!.name}
                          </span>
                          <span class="block truncate pt-1 text-xs text-slate-500 dark:text-slate-400">
                            {lastSelectedRepo()!.path}
                          </span>
                        </button>
                      </Show>
                    </div>

                    <div class="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
                      <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <Shield class="h-3.5 w-3.5" />
                        Scan roots
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <Show
                          when={customPaths().length > 0}
                          fallback={
                            <span class="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              No folders added
                            </span>
                          }
                        >
                          {customPaths().map((rootPath) => (
                            <span class="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {rootPath}
                            </span>
                          ))}
                        </Show>
                      </div>
                      <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        {hasSearchRoots()
                          ? `Searching ${customPaths().length} folder${customPaths().length === 1 ? "" : "s"}.`
                          : "Add a folder to start browsing repositories."}
                      </p>
                    </div>
                  </div>
                </section>

                <section class="rounded-2xl border border-slate-200/80 bg-[var(--app-panel-muted)] p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/30">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <FolderOpen class="h-3.5 w-3.5" />
                      Repository
                    </div>
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Choose a repository
                    </h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">
                      Pick from the folders you've added, or add another one.
                    </p>
                  </div>

                  <div class="mt-4">
                    <RepositorySelector
                      repositories={repositories()}
                      selectedRepo={null}
                      onRepoChange={handleRepoSelection}
                      onAddCustomPath={handleAddCustomPath}
                      searchRoots={customPaths()}
                      isLoading={repositoriesLoading()}
                      triggerClass="w-full"
                    />
                  </div>

                  <div class="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-300">
                    {repositoriesLoading()
                      ? `Scanning ${customPaths().length || 1} folder${customPaths().length === 1 ? "" : "s"}...`
                      : repositories().length > 0
                        ? `${repositories().length} repos found in ${customPaths().length} folder${customPaths().length === 1 ? "" : "s"}.`
                        : hasSearchRoots()
                          ? "No repositories found in the folders you've added."
                          : "Add a folder to list repositories here."}
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      }
    >
      {(currentSelectedRepo) => (
        <SelectedRepositoryView
          selectedRepo={currentSelectedRepo()}
          repositories={repositories()}
          repositoriesLoading={repositoriesLoading()}
          customPaths={customPaths()}
          globalColorMode={globalColorMode()}
          onGlobalColorModeChange={handleGlobalColorModeChange}
          onRepoChange={handleRepoSelection}
          onAddCustomPath={handleAddCustomPath}
          updateUrl={updateUrl}
          baseBranch={baseBranch()}
          headBranch={headBranch()}
          baseCommit={baseCommit()}
          headCommit={headCommit()}
        />
      )}
    </Show>
  );
}

function SelectedRepositoryView(props: SelectedRepositoryViewProps) {
  const [clientReady, setClientReady] = createSignal(false);

  onMount(() => {
    setClientReady(true);
  });

  return (
    <Show
      when={clientReady()}
      fallback={
        <div class="flex h-screen flex-col bg-[var(--app-bg)]">
          <div class="flex flex-1 items-center justify-center">
            <div class="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-[var(--app-panel)] px-6 py-5 shadow-sm dark:border-slate-800">
              <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 dark:border-slate-700" />
              <p class="text-sm text-slate-600 dark:text-slate-300">Loading reviewer...</p>
            </div>
          </div>
        </div>
      }
    >
      <SelectedRepositoryWorkspaceClient {...props} />
    </Show>
  );
}

function SelectedRepositoryWorkspaceClient(props: SelectedRepositoryViewProps) {
  const [initialized, setInitialized] = createSignal(false);

  let prevBaseBranch = "";
  let prevHeadBranch = "";
  let baseCommitsLoaded = false;
  let headCommitsLoaded = false;

  const baseBranch = () => props.baseBranch;
  const headBranch = () => props.headBranch;
  const baseCommit = () => props.baseCommit;
  const headCommit = () => props.headCommit;

  const baseCommitsQuery = useInfiniteQuery(() => ({
    queryKey: ["commits", props.selectedRepo.path, baseBranch()],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const url = new URL("/api/commits", window.location.origin);
      url.searchParams.set("repoPath", props.selectedRepo.path);
      if (baseBranch()) {
        url.searchParams.set("branch", baseBranch());
      }
      url.searchParams.set("limit", String(COMMITS_PER_PAGE));
      url.searchParams.set("offset", String(pageParam));

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch commits");
      }

      return (await response.json()) as CommitInfo[];
    },
    getNextPageParam: (lastPage: CommitInfo[], allPages: CommitInfo[][]) => {
      const realInLast = lastPage.filter((commit) => !isLocalRef(commit.hash));
      if (realInLast.length < COMMITS_PER_PAGE) {
        return undefined;
      }

      return allPages.flat().filter((commit) => !isLocalRef(commit.hash)).length;
    },
  }));

  const baseCommits = createMemo(() => baseCommitsQuery.data?.pages.flat() ?? []);

  const currentBranchQuery = useQuery(() => ({
    queryKey: ["currentBranch", props.selectedRepo.path],
    queryFn: async () => {
      const url = new URL("/api/current-branch", window.location.origin);
      url.searchParams.set("repoPath", props.selectedRepo.path);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch current branch");
      }

      return response.text();
    },
  }));
  const currentBranch = createMemo(() => currentBranchQuery.data ?? "");

  const headCommitsQuery = useInfiniteQuery(() => ({
    queryKey: ["commits", props.selectedRepo.path, headBranch()],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const url = new URL("/api/commits", window.location.origin);
      url.searchParams.set("repoPath", props.selectedRepo.path);
      if (headBranch()) {
        url.searchParams.set("branch", headBranch());
      }
      url.searchParams.set("limit", String(COMMITS_PER_PAGE));
      url.searchParams.set("offset", String(pageParam));

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch commits");
      }

      return (await response.json()) as CommitInfo[];
    },
    getNextPageParam: (lastPage: CommitInfo[], allPages: CommitInfo[][]) => {
      const realInLast = lastPage.filter((commit) => !isLocalRef(commit.hash));
      if (realInLast.length < COMMITS_PER_PAGE) {
        return undefined;
      }

      return allPages.flat().filter((commit) => !isLocalRef(commit.hash)).length;
    },
  }));

  const headCommits = createMemo(() => headCommitsQuery.data?.pages.flat() ?? []);
  const filteredHeadCommits = createMemo(() => {
    if (baseBranch() === headBranch() && baseCommit() && isRealCommitRef(baseCommit())) {
      return headCommits().filter(
        (commit) =>
          isLocalRef(commit.hash) ||
          (commit.hash !== baseCommit() && !commit.hash.startsWith(baseCommit().slice(0, 7))),
      );
    }

    return headCommits();
  });

  const branchesQuery = useQuery(() => ({
    queryKey: ["branchesWithCommits", props.selectedRepo.path],
    queryFn: async () => {
      const url = new URL("/api/branches-with-commits", window.location.origin);
      url.searchParams.set("repoPath", props.selectedRepo.path);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      return (await response.json()) as BranchInfo[];
    },
  }));

  const branches = createMemo(() => branchesQuery.data ?? []);
  const defaultBranch = createMemo(() => getDefaultBranchName(branches(), currentBranch()));
  const selectedBaseBranchInfo = createMemo(() =>
    findBranchByName(branches(), baseBranch() || defaultBranch()),
  );
  const selectedHeadBranchInfo = createMemo(() =>
    findBranchByName(branches(), headBranch() || defaultBranch()),
  );
  const baseBranchLabel = createMemo(
    () => getBranchDisplayName(selectedBaseBranchInfo()) || baseBranch(),
  );
  const headBranchLabel = createMemo(
    () => getBranchDisplayName(selectedHeadBranchInfo()) || headBranch(),
  );
  const isSameBranchComparison = createMemo(() => !!baseBranch() && baseBranch() === headBranch());
  const selectedBaseCommitInfo = createMemo(() =>
    baseCommit()
      ? baseCommits().find(
          (commit) => commit.hash === baseCommit() || commit.hash.startsWith(baseCommit()),
        )
      : undefined,
  );
  const selectedHeadCommitInfo = createMemo(() =>
    headCommit()
      ? headCommits().find(
          (commit) => commit.hash === headCommit() || commit.hash.startsWith(headCommit()),
        )
      : undefined,
  );

  const commitDistanceQuery = useQuery(() => ({
    queryKey: [
      "commitDistance",
      baseCommit(),
      headCommit(),
      props.selectedRepo.path,
      baseBranch(),
      headBranch(),
    ],
    enabled:
      !!baseCommit() &&
      !!headCommit() &&
      baseBranch() === headBranch() &&
      isRealCommitRef(baseCommit()) &&
      isRealCommitRef(headCommit()),
    queryFn: async () => {
      if (!baseCommit() || !headCommit() || baseBranch() !== headBranch()) {
        return null;
      }

      const url = new URL("/api/commit-distance", window.location.origin);
      url.searchParams.set("base", baseCommit());
      url.searchParams.set("head", headCommit());
      url.searchParams.set("repoPath", props.selectedRepo.path);

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { distance: number | null };
      return data.distance;
    },
  }));

  const diffQuery = useQuery(() => ({
    queryKey: ["diff", baseCommit(), headCommit(), props.selectedRepo.path],
    enabled: !!baseCommit() && !!headCommit(),
    queryFn: async () => {
      const url = new URL("/api/diff", window.location.origin);
      url.searchParams.set("base", baseCommit());
      url.searchParams.set("head", headCommit());
      url.searchParams.set("repoPath", props.selectedRepo.path);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch diff");
      }

      return (await response.json()) as ReviewDiff;
    },
  }));

  const diffStats = createMemo(() => {
    if (!diffQuery.data) {
      return null;
    }

    let additions = 0;
    let deletions = 0;

    for (const line of diffQuery.data.flatLines) {
      if (line.type === "add") {
        additions += 1;
      } else if (line.type === "remove") {
        deletions += 1;
      }
    }

    return {
      files: diffQuery.data.files.length,
      additions,
      deletions,
    };
  });

  const combinedError = createMemo(
    () =>
      toError(baseCommitsQuery.error) ||
      toError(headCommitsQuery.error) ||
      toError(diffQuery.error),
  );

  createEffect(() => {
    props.selectedRepo.path;
    setInitialized(false);
  });

  createEffect(() => {
    if (branches().length === 0 || initialized() || currentBranchQuery.isPending) {
      return;
    }

    const nextUpdates: { baseBranch?: string; headBranch?: string } = {};
    const nextDefaultBranch = defaultBranch();

    setInitialized(true);

    if (!baseBranch() && nextDefaultBranch) {
      nextUpdates.baseBranch = nextDefaultBranch;
    }

    if (!headBranch() && nextDefaultBranch) {
      nextUpdates.headBranch = nextDefaultBranch;
    }

    if (Object.keys(nextUpdates).length > 0) {
      props.updateUrl(nextUpdates);
    }
  });

  createEffect(() => {
    if (baseCommits().length === 0 || !baseBranch() || baseCommit() || !initialized()) {
      return;
    }

    const shouldAutoSelect = !baseCommitsLoaded || prevBaseBranch === baseBranch();
    const defaultBaseCommit = getDefaultCommit(baseCommits());

    if (shouldAutoSelect) {
      baseCommitsLoaded = true;
      props.updateUrl({ baseCommit: defaultBaseCommit?.hash || "" });
    }
  });

  createEffect(() => {
    if (headCommits().length === 0 || !headBranch() || headCommit() || !initialized()) {
      return;
    }

    const shouldAutoSelect = !headCommitsLoaded || prevHeadBranch === headBranch();

    if (shouldAutoSelect) {
      headCommitsLoaded = true;
      const defaultHeadCommit = headCommits().find((commit) => commit.hash === LOCAL_REF_WORKTREE)
        ? LOCAL_REF_WORKTREE
        : getDefaultCommit(filteredHeadCommits())?.hash || "";
      props.updateUrl({ headCommit: defaultHeadCommit });
    }
  });

  return (
    <div class="flex h-screen flex-col bg-[var(--app-bg)]">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2.5 dark:border-slate-800">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <h1 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Link to="/">Reviewer</Link>
          </h1>
          <RepositorySelector
            repositories={props.repositories}
            selectedRepo={props.selectedRepo}
            onRepoChange={props.onRepoChange}
            onAddCustomPath={props.onAddCustomPath}
            searchRoots={props.customPaths}
            isLoading={props.repositoriesLoading}
            showPath={false}
            triggerClass="w-[15rem] sm:w-[16rem] xl:w-[17rem]"
          />
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-[11px] text-slate-500 dark:text-slate-400">Base</span>
            <RevisionSelector
              label="Base"
              branches={branches()}
              commits={baseCommits()}
              branchValue={baseBranch()}
              commitValue={baseCommit()}
              onBranchChange={(branch) => {
                prevBaseBranch = branch;
                if (!headBranch()) {
                  props.updateUrl({ baseBranch: branch, baseCommit: "", headBranch: branch });
                  return;
                }

                props.updateUrl({ baseBranch: branch, baseCommit: "" });
              }}
              onCommitChange={(hash) => {
                props.updateUrl({ baseCommit: hash, headCommit: "" });
              }}
              defaultBranch={defaultBranch()}
              placeholder="base revision"
              isBranchLoading={branchesQuery.isPending || branchesQuery.isFetching}
              isCommitLoading={baseCommitsQuery.isPending || baseCommitsQuery.isFetching}
            />
          </div>
          <span class="text-slate-400 dark:text-slate-600">→</span>
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-[11px] text-slate-500 dark:text-slate-400">Head</span>
            <RevisionSelector
              label="Head"
              branches={branches()}
              commits={filteredHeadCommits()}
              branchValue={headBranch()}
              commitValue={headCommit()}
              onBranchChange={(branch) => {
                prevHeadBranch = branch;
                props.updateUrl({ headBranch: branch, headCommit: "" });
              }}
              onCommitChange={(hash) => {
                props.updateUrl({ headCommit: hash });
              }}
              defaultBranch={defaultBranch()}
              placeholder="head revision"
              isBranchLoading={branchesQuery.isPending || branchesQuery.isFetching}
              isCommitLoading={headCommitsQuery.isPending || headCommitsQuery.isFetching}
            />
            <Show
              when={
                isSameBranchComparison() && selectedBaseCommitInfo() && selectedHeadCommitInfo()
              }
            >
              <div class="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 pl-1 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span class="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">
                    {getCommitDisplayLabel(selectedBaseCommitInfo())}
                  </span>
                </span>
                <span class="text-slate-300 dark:text-slate-600">→</span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span class="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">
                    {getCommitDisplayLabel(selectedHeadCommitInfo())}
                  </span>
                </span>
              </div>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Show when={diffStats()}>
            <div class="flex items-center gap-1.5 border-r border-slate-200 pr-2.5 text-[11px] dark:border-slate-700">
              <span class="text-slate-400 dark:text-slate-500">{diffStats()!.files} files</span>
              <Show when={(diffStats()?.additions || 0) > 0}>
                <span class="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{diffStats()!.additions}
                </span>
              </Show>
              <Show when={(diffStats()?.deletions || 0) > 0}>
                <span class="font-semibold text-rose-500 dark:text-rose-400">
                  -{diffStats()!.deletions}
                </span>
              </Show>
            </div>
          </Show>

          <div class="flex items-center gap-1 rounded-lg border border-slate-200 bg-[var(--app-panel-muted)] p-1 dark:border-slate-700">
            <button
              type="button"
              onClick={() => props.onGlobalColorModeChange("light")}
              class={toggleButtonClass(props.globalColorMode === "light")}
              title="Global light mode"
              aria-label="Global light mode"
            >
              <Sun size={14} />
            </button>
            <button
              type="button"
              onClick={() => props.onGlobalColorModeChange("auto")}
              class={toggleButtonClass(props.globalColorMode === "auto")}
              title="Global auto mode"
              aria-label="Global auto mode"
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              onClick={() => props.onGlobalColorModeChange("dark")}
              class={toggleButtonClass(props.globalColorMode === "dark")}
              title="Global dark mode"
              aria-label="Global dark mode"
            >
              <Moon size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["diff"] });
            }}
            class="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh diff"
          >
            ↻
          </button>
        </div>
      </div>

      <ErrorBanner error={combinedError()} />

      <Show when={baseCommit() && headCommit()}>
        <CommitCompare
          baseCommit={selectedBaseCommitInfo()}
          headCommit={selectedHeadCommitInfo()}
          baseBranchLabel={baseBranchLabel()}
          headBranchLabel={headBranchLabel()}
          isSameBranchComparison={isSameBranchComparison()}
          distance={commitDistanceQuery.data ?? null}
        />
      </Show>

      <main class="z-0 flex-1 overflow-hidden p-2">
        <Show
          when={!baseCommitsQuery.isPending && !headCommitsQuery.isPending && !diffQuery.isPending}
          fallback={
            <div class="flex h-full flex-col items-center justify-center rounded border border-slate-200 bg-[var(--app-panel)] dark:border-slate-800">
              <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 dark:border-slate-700" />
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Loading diff...</p>
            </div>
          }
        >
          <Suspense
            fallback={
              <div class="flex h-full flex-col items-center justify-center rounded border border-slate-200 bg-[var(--app-panel)] dark:border-slate-800">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 dark:border-slate-700" />
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Loading diff...</p>
              </div>
            }
          >
            <DiffViewer
              diff={diffQuery.data}
              repoPath={props.selectedRepo.path}
              baseBranchLabel={baseBranchLabel()}
              headBranchLabel={headBranchLabel()}
              isSameBranchComparison={isSameBranchComparison()}
              baseCommits={baseCommits()}
              headCommits={headCommits()}
              baseCommit={baseCommit()}
              headCommit={headCommit()}
              onBaseCommitChange={(hash) => props.updateUrl({ baseCommit: hash, headCommit: "" })}
              onHeadCommitChange={(hash) => props.updateUrl({ headCommit: hash })}
              onLoadMoreBaseCommits={() => {
                void baseCommitsQuery.fetchNextPage();
              }}
              onLoadMoreHeadCommits={() => {
                void headCommitsQuery.fetchNextPage();
              }}
              hasMoreBaseCommits={baseCommitsQuery.hasNextPage}
              hasMoreHeadCommits={headCommitsQuery.hasNextPage}
            />
          </Suspense>
        </Show>
      </main>
    </div>
  );
}
