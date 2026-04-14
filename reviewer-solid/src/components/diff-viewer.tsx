import { parseDiffFromFile } from "@pierre/diffs";
import type { FileContents, FileDiffMetadata } from "@pierre/diffs";
import { ChevronDown, Eye, Monitor, Moon, Sun, WrapText } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useNavigate, useSearch } from "@tanstack/solid-router";
import { DARK_THEMES, LIGHT_THEMES, STORAGE_KEYS, type ThemeName } from "~/lib/constants";
import type { CommitInfo, Diff } from "~/lib/types";
import type { SearchParams } from "~/routes/index";
import {
  useColorMode,
  useIgnoreWhitespace,
  useLocalStorage,
  useSidebarCollapsed,
  useSidebarPosition,
  useSidebarSize,
  useTheme,
  useViewMode,
  useWrapping,
} from "./hooks";
import { CommitHistoryPanel } from "./commit-history-panel";
import { FileTreeSidebar } from "./file-tree-sidebar";
import { ReactFileDiff } from "./react-file-diff";

interface DiffViewerProps {
  diff?: Diff & { pierreData?: FileDiffMetadata[] };
  repoPath?: string;
  baseBranchLabel: string;
  headBranchLabel: string;
  isSameBranchComparison: boolean;
  baseCommits: CommitInfo[];
  headCommits: CommitInfo[];
  baseCommit: string;
  headCommit: string;
  onBaseCommitChange?: (hash: string) => void;
  onHeadCommitChange?: (hash: string) => void;
  onLoadMoreBaseCommits?: () => void;
  onLoadMoreHeadCommits?: () => void;
  hasMoreBaseCommits?: boolean;
  hasMoreHeadCommits?: boolean;
}

interface ExpandedFileData {
  file: FileDiffMetadata;
}

interface ParsedSearchQuery {
  pathFilter?: string;
  contentQuery: string;
}

const SIDEBAR_MIN_SIZE = 16;
const SIDEBAR_MAX_SIZE = 60;
const SIDEBAR_COLLAPSED_WIDTH_REM = 3.5;

const parseSearchQuery = (query: string | undefined): ParsedSearchQuery => {
  if (!query || !query.trim()) {
    return { contentQuery: "" };
  }

  const pathMatch = query.trim().match(/^path:(\S+)\s*(.*)$/);
  if (pathMatch?.[1]) {
    return {
      pathFilter: pathMatch[1],
      contentQuery: (pathMatch[2] || "").trim(),
    };
  }

  return { contentQuery: query.trim() };
};

const fileMatchesContentQuery = (file: FileDiffMetadata, contentQuery: string) => {
  const tokens = contentQuery
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = [
    file.name,
    file.prevName || "",
    ...(file.additionLines || []),
    ...(file.deletionLines || []),
  ]
    .join("\n")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
};

const getFileMatchCount = (file: FileDiffMetadata, query: ParsedSearchQuery): number => {
  const filePath = file.prevName || file.name;

  if (query.pathFilter && !filePath.includes(query.pathFilter)) {
    return 0;
  }

  if (!query.contentQuery) {
    return query.pathFilter ? 1 : 0;
  }

  const tokens = query.contentQuery
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const searchableEntries = [
    filePath,
    ...(file.additionLines || []),
    ...(file.deletionLines || []),
  ];
  const lineMatches = searchableEntries.filter((entry) =>
    tokens.every((token) => entry.toLowerCase().includes(token)),
  ).length;

  return lineMatches > 0 ? lineMatches : fileMatchesContentQuery(file, query.contentQuery) ? 1 : 0;
};

const readStoredPaths = (key: string) => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [] as string[];
  }
};

export function DiffViewer(props: DiffViewerProps) {
  const navigate = useNavigate({ from: "/" });
  const searchQuery = useSearch({
    from: "/",
    select: (search) => search.searchQuery,
  });

  const [viewMode, setViewMode] = useViewMode();
  const [theme, setTheme] = useTheme();
  const [colorMode, setColorMode] = useColorMode();
  const [wrapping, setWrapping] = useWrapping();
  const [ignoreWhitespace, setIgnoreWhitespace] = useIgnoreWhitespace();
  const [sidebarPosition, setSidebarPosition] = useSidebarPosition();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [sidebarSize, setSidebarSize] = useSidebarSize();
  const [lastLightTheme, setLastLightTheme] = useLocalStorage<string>(
    STORAGE_KEYS.lastLightTheme,
    LIGHT_THEMES[0],
  );
  const [lastDarkTheme, setLastDarkTheme] = useLocalStorage<string>(
    STORAGE_KEYS.lastDarkTheme,
    DARK_THEMES[0],
  );
  const [autoMarkViewed, setAutoMarkViewed] = useLocalStorage<boolean>(
    STORAGE_KEYS.autoMarkViewed,
    false,
  );

  const [expandedFiles, setExpandedFiles] = createSignal<Map<string, ExpandedFileData>>(new Map());
  const [loadingFiles, setLoadingFiles] = createSignal<Set<string>>(new Set());
  const [collapsedDiffFiles, setCollapsedDiffFiles] = createSignal<Set<string>>(new Set());
  const [searchInput, setSearchInput] = createSignal(searchQuery() || "");
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [viewedPathsArray, setViewedPathsArray] = createSignal<string[]>([]);

  const fileRefs = new Map<string, HTMLDivElement>();
  let layoutRef: HTMLDivElement | undefined;
  let contentScrollRef: HTMLDivElement | undefined;

  const diffKey = createMemo(() => `${props.baseCommit}:${props.headCommit}`);
  const viewedStorageKey = createMemo(() => `reviewer_app:viewed:${diffKey()}`);
  const parsedSearchQuery = createMemo(() => parseSearchQuery(searchQuery()));

  const updateSearchQuery = () => {
    navigate({
      search: (previous: SearchParams) => ({
        ...previous,
        searchQuery: searchInput().trim() ? searchInput().trim() : undefined,
      }),
    });
  };

  const markPathsViewed = (paths: string[]) => {
    setViewedPathsArray((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      let changed = false;

      for (const path of paths) {
        if (!nextPaths.has(path)) {
          nextPaths.add(path);
          changed = true;
        }
      }

      return changed ? Array.from(nextPaths) : currentPaths;
    });
  };

  const handleToggleViewed = (paths: string[]) => {
    setViewedPathsArray((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      const allViewed = paths.every((path) => nextPaths.has(path));

      for (const path of paths) {
        if (allViewed) {
          nextPaths.delete(path);
        } else {
          nextPaths.add(path);
        }
      }

      return Array.from(nextPaths);
    });
  };

  const handleToggleDiffFileCollapse = (filePath: string) => {
    setCollapsedDiffFiles((current) => {
      const next = new Set(current);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleThemeChange = (nextTheme: string) => {
    setTheme(nextTheme);

    if (LIGHT_THEMES.includes(nextTheme as (typeof LIGHT_THEMES)[number])) {
      setLastLightTheme(nextTheme);
      setColorMode("light");
      return;
    }

    if (DARK_THEMES.includes(nextTheme as (typeof DARK_THEMES)[number])) {
      setLastDarkTheme(nextTheme);
      setColorMode("dark");
    }
  };

  const handleExpandFile = async (
    fileName: string,
    oldPath: string,
    newPath: string,
    expandType: "full" | "top" | "bottom",
  ) => {
    if (!props.diff) {
      return;
    }

    const key = `${fileName}-${expandType}`;
    if (expandedFiles().has(key) || loadingFiles().has(key)) {
      return;
    }

    setLoadingFiles((current) => new Set(current).add(key));

    try {
      const [oldContentRes, newContentRes] = await Promise.all([
        fetch(
          `/api/file-content?filePath=${encodeURIComponent(oldPath)}&commit=${encodeURIComponent(props.diff.from)}&repoPath=${encodeURIComponent(props.repoPath || "")}`,
        ),
        fetch(
          `/api/file-content?filePath=${encodeURIComponent(newPath)}&commit=${encodeURIComponent(props.diff.to)}&repoPath=${encodeURIComponent(props.repoPath || "")}`,
        ),
      ]);

      if (!oldContentRes.ok || !newContentRes.ok) {
        return;
      }

      const [{ content: oldContent }, { content: newContent }] = await Promise.all([
        oldContentRes.json() as Promise<{ content: string }>,
        newContentRes.json() as Promise<{ content: string }>,
      ]);

      const oldFile: FileContents = {
        name: oldPath,
        contents: oldContent,
      };
      const newFile: FileContents = {
        name: newPath,
        contents: newContent,
      };

      const fullDiff = parseDiffFromFile(oldFile, newFile);
      setExpandedFiles((current) => {
        const next = new Map(current);
        next.set(key, { file: fullDiff });
        return next;
      });
    } catch (error) {
      console.error("Failed to expand file:", error);
    } finally {
      setLoadingFiles((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const handleExpandHunk = (
    fileKey: string,
    _hunkIndex: number,
    direction: "up" | "down" | "both",
    expandFully?: boolean,
  ) => {
    const file = props.diff?.pierreData?.find(
      (candidate, index) => `${candidate.prevName || candidate.name}-${index}` === fileKey,
    );

    if (!file) {
      return;
    }

    const fileName = file.name;
    const oldPath = file.prevName || fileName;
    const newPath = fileName;

    if (expandFully || direction === "both") {
      void handleExpandFile(fileName, oldPath, newPath, "full");
      return;
    }

    if (direction === "up") {
      void handleExpandFile(fileName, oldPath, newPath, "top");
      return;
    }

    void handleExpandFile(fileName, oldPath, newPath, "bottom");
  };

  const renderFiles = createMemo(() => {
    const baseFiles = props.diff?.pierreData || [];
    let filtered = baseFiles;

    if (parsedSearchQuery().pathFilter) {
      filtered = filtered.filter((file) => {
        const filePath = file.prevName || file.name;
        return filePath.includes(parsedSearchQuery().pathFilter || "");
      });
    }

    if (parsedSearchQuery().contentQuery) {
      filtered = filtered.filter((file) =>
        fileMatchesContentQuery(file, parsedSearchQuery().contentQuery),
      );
    }

    if (filtered.length === 0 || expandedFiles().size === 0) {
      return filtered;
    }

    return filtered.map((file) => expandedFiles().get(`${file.name}-full`)?.file || file);
  });

  const renderPaths = createMemo(() => renderFiles().map((file) => file.name));
  const renderPathSet = createMemo(() => new Set(renderPaths()));
  const visibleViewedPaths = createMemo(
    () => new Set(viewedPathsArray().filter((path) => renderPathSet().has(path))),
  );
  const allRenderedPaths = createMemo(() => renderFiles().map((file) => file.name));
  const allFilesCollapsed = createMemo(
    () =>
      allRenderedPaths().length > 0 &&
      allRenderedPaths().every((path) => collapsedDiffFiles().has(path)),
  );
  const allFilesViewed = createMemo(
    () =>
      allRenderedPaths().length > 0 &&
      allRenderedPaths().every((path) => visibleViewedPaths().has(path)),
  );
  const fileMatchCounts = createMemo(
    () =>
      new Map(
        renderFiles().map((file) => [file.name, getFileMatchCount(file, parsedSearchQuery())]),
      ),
  );
  const hasActiveSearch = createMemo(() =>
    Boolean(parsedSearchQuery().pathFilter || parsedSearchQuery().contentQuery),
  );

  const setFileRef = (path: string, element: HTMLDivElement | undefined) => {
    if (element) {
      fileRefs.set(path, element);
    } else {
      fileRefs.delete(path);
    }
  };

  const handleSelectPath = (path: string) => {
    setSelectedPath(path);
    fileRefs.get(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startResize = (event: MouseEvent) => {
    if (!layoutRef || sidebarCollapsed()) {
      return;
    }

    event.preventDefault();
    const initialSidebarSize = sidebarSize();
    const layoutRect = layoutRef.getBoundingClientRect();
    const startX = event.clientX;

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / layoutRect.width) * 100;
      const nextSize =
        sidebarPosition() === "left"
          ? initialSidebarSize + deltaPercent
          : initialSidebarSize - deltaPercent;

      setSidebarSize(Math.min(SIDEBAR_MAX_SIZE, Math.max(SIDEBAR_MIN_SIZE, nextSize)));
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  createEffect(() => {
    setSearchInput(searchQuery() || "");
  });

  createEffect(() => {
    viewedStorageKey();
    setViewedPathsArray(readStoredPaths(viewedStorageKey()));
  });

  createEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(viewedStorageKey(), JSON.stringify(viewedPathsArray()));
    } catch {
      // ignore storage failures
    }
  });

  createEffect(() => {
    diffKey();
    setExpandedFiles(new Map<string, ExpandedFileData>());
    setLoadingFiles(new Set<string>());
    setCollapsedDiffFiles(new Set<string>());
    setSelectedPath(null);
  });

  createEffect(() => {
    const paths = renderPaths();

    if (paths.length === 0) {
      if (selectedPath() !== null) {
        setSelectedPath(null);
      }
      return;
    }

    if (!selectedPath() || !paths.includes(selectedPath() || "")) {
      setSelectedPath(paths[0] || null);
    }
  });

  createEffect(() => {
    const scrollElement = contentScrollRef;
    const files = renderFiles();

    if (!scrollElement || files.length === 0) {
      return;
    }

    let frameId = 0;

    const syncFromScroll = () => {
      frameId = 0;

      const scrollRect = scrollElement.getBoundingClientRect();
      const activeLine = scrollRect.top + 56;
      const pathsToMark: string[] = [];
      let currentPath: string | null = null;
      let nextPath: string | null = null;
      let nextPathDistance = Number.POSITIVE_INFINITY;

      for (const [path, element] of fileRefs.entries()) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.bottom > scrollRect.top && rect.top < scrollRect.bottom;

        if (!isVisible) {
          continue;
        }

        if (autoMarkViewed() && rect.bottom > activeLine) {
          pathsToMark.push(path);
        }

        if (rect.top <= activeLine && rect.bottom >= activeLine) {
          currentPath = path;
          break;
        }

        if (rect.top > activeLine) {
          const distance = rect.top - activeLine;
          if (distance < nextPathDistance) {
            nextPathDistance = distance;
            nextPath = path;
          }
        }
      }

      const nextSelectedPath = currentPath ?? nextPath ?? files[0]?.name ?? null;
      if (nextSelectedPath && nextSelectedPath !== selectedPath()) {
        setSelectedPath(nextSelectedPath);
      }

      if (autoMarkViewed() && pathsToMark.length > 0) {
        markPathsViewed(pathsToMark);
      }
    };

    const onScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(syncFromScroll);
    };

    syncFromScroll();
    scrollElement.addEventListener("scroll", onScroll, { passive: true });

    onCleanup(() => {
      scrollElement.removeEventListener("scroll", onScroll);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    });
  });

  const renderSidebar = () => (
    <FileTreeSidebar
      files={renderFiles()}
      selectedPath={selectedPath()}
      onSelectPath={handleSelectPath}
      position={sidebarPosition()}
      onTogglePosition={() => setSidebarPosition(sidebarPosition() === "left" ? "right" : "left")}
      collapsed={sidebarCollapsed()}
      onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed())}
      matchCounts={fileMatchCounts()}
      showMatchCounts={hasActiveSearch()}
      viewedPaths={visibleViewedPaths()}
      onToggleViewed={handleToggleViewed}
      autoMarkViewed={autoMarkViewed()}
      onToggleAutoMarkViewed={() => setAutoMarkViewed(!autoMarkViewed())}
      footer={
        <CommitHistoryPanel
          baseBranchLabel={props.baseBranchLabel}
          headBranchLabel={props.headBranchLabel}
          isSameBranchComparison={props.isSameBranchComparison}
          baseCommits={props.baseCommits}
          headCommits={props.headCommits}
          selectedBaseCommit={props.baseCommit}
          selectedHeadCommit={props.headCommit}
          onBaseCommitChange={props.onBaseCommitChange}
          onHeadCommitChange={props.onHeadCommitChange}
          onLoadMoreBase={props.onLoadMoreBaseCommits}
          onLoadMoreHead={props.onLoadMoreHeadCommits}
          hasMoreBase={props.hasMoreBaseCommits}
          hasMoreHead={props.hasMoreHeadCommits}
        />
      }
    />
  );

  const renderContent = () => (
    <div ref={(element) => (contentScrollRef = element)} class="min-w-0 h-full overflow-auto">
      <Show
        when={renderFiles().length > 0}
        fallback={
          <div class="flex h-full items-center justify-center px-6 text-center text-slate-600 dark:text-slate-400">
            No diff available for the selected refs.
          </div>
        }
      >
        <div>
          <For each={renderFiles()}>
            {(file, index) => {
              const fileKey = () => `${file.prevName || file.name}-${index()}`;
              const isLoading = () => loadingFiles().has(`${file.name}-full`);
              const isExpanded = () => expandedFiles().has(`${file.name}-full`);
              const isSelected = () => selectedPath() === file.name;
              const isDiffCollapsed = () => collapsedDiffFiles().has(file.name);
              const isViewed = () => visibleViewedPaths().has(file.name);
              const additions = () => file.additionLines?.length ?? 0;
              const deletions = () => file.deletionLines?.length ?? 0;

              return (
                <div
                  data-file-path={file.name}
                  ref={(element) => setFileRef(file.name, element || undefined)}
                  class={`relative scroll-mt-4 border-b border-slate-200 dark:border-slate-800 last:border-b-0 ${
                    isSelected() ? "bg-sky-50/30 dark:bg-sky-950/10" : ""
                  }`}
                >
                  <div
                    class={`sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 backdrop-blur-sm dark:border-slate-800 ${
                      isDiffCollapsed()
                        ? "border-t-0 bg-white/95 dark:bg-slate-900/95"
                        : "bg-slate-50/95 dark:bg-slate-900/95"
                    } ${isViewed() ? "opacity-60" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleDiffFileCollapse(file.name)}
                      class="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={isDiffCollapsed() ? "Expand diff" : "Collapse diff"}
                    >
                      <ChevronDown
                        size={14}
                        class={`shrink-0 text-slate-500 transition-transform ${
                          isDiffCollapsed() ? "-rotate-90" : ""
                        }`}
                      />
                      <span class="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                        {file.prevName && file.prevName !== file.name
                          ? `${file.prevName} → ${file.name}`
                          : file.name}
                      </span>
                      <Show when={additions() > 0 || deletions() > 0}>
                        <span class="flex shrink-0 items-center gap-1 text-[11px] font-semibold">
                          <Show when={additions() > 0}>
                            <span class="text-emerald-600 dark:text-emerald-400">
                              +{additions()}
                            </span>
                          </Show>
                          <Show when={deletions() > 0}>
                            <span class="text-rose-500 dark:text-rose-400">-{deletions()}</span>
                          </Show>
                        </span>
                      </Show>
                    </button>
                    <button
                      type="button"
                      title={isViewed() ? "Mark as not viewed" : "Mark as viewed"}
                      onClick={() => handleToggleViewed([file.name])}
                      class={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        isViewed()
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Eye size={12} />
                      <span>{isViewed() ? "Viewed" : "Mark viewed"}</span>
                    </button>
                  </div>

                  <Show when={!isDiffCollapsed()}>
                    <Show when={!isExpanded() && !isLoading()}>
                      <button
                        type="button"
                        onClick={() => handleExpandHunk(fileKey(), 0, "both", true)}
                        class="absolute top-12 right-2 z-10 rounded bg-blue-500 px-2 py-1 text-xs text-white shadow transition-colors hover:bg-blue-600"
                      >
                        Load full file
                      </button>
                    </Show>
                    <Show when={isLoading()}>
                      <div class="absolute top-12 right-2 z-10 rounded bg-slate-700 px-2 py-1 text-xs text-white dark:bg-slate-600">
                        Loading...
                      </div>
                    </Show>
                    <ReactFileDiff
                      fileDiff={file}
                      options={{
                        theme: theme() as ThemeName,
                        diffStyle: viewMode(),
                        overflow: wrapping() ? "wrap" : "scroll",
                        disableLineNumbers: false,
                      }}
                    />
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );

  return (
    <div class="flex h-full flex-col">
      <div class="flex shrink-0 flex-wrap items-center gap-3 overflow-x-auto border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2 dark:border-slate-800">
        <div class="flex min-w-[18rem] flex-1 items-center gap-2">
          <input
            type="text"
            value={searchInput()}
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                updateSearchQuery();
              }
            }}
            placeholder="Search diffs... (text or path:src/file.tsx token)"
            class="h-9 min-w-[14rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={updateSearchQuery}
            class="h-9 rounded-md bg-blue-500 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Search
          </button>
        </div>

        <div class="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setViewMode("unified")}
            class={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode() === "unified"
                ? "border border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
            title="Unified diff view"
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            class={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode() === "split"
                ? "border border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
            title="Split diff view"
          >
            Split
          </button>
        </div>

        <div class="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setColorMode("light");
              setTheme(lastLightTheme());
            }}
            class={`rounded p-1.5 transition-colors ${
              colorMode() === "light"
                ? "border border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
            title="Light diff theme"
          >
            <Sun size={16} />
          </button>
          <button
            type="button"
            onClick={() => setColorMode("auto")}
            class={`rounded p-1.5 transition-colors ${
              colorMode() === "auto"
                ? "border border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
            title="Auto diff theme"
          >
            <Monitor size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setColorMode("dark");
              setTheme(lastDarkTheme());
            }}
            class={`rounded p-1.5 transition-colors ${
              colorMode() === "dark"
                ? "border border-slate-600 bg-slate-800 text-slate-100 shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
            title="Dark diff theme"
          >
            <Moon size={16} />
          </button>

          <select
            value={theme()}
            onChange={(event) => handleThemeChange(event.currentTarget.value)}
            class="rounded border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-700 outline-none dark:border-slate-700 dark:text-slate-200"
            title="Diff theme"
          >
            <optgroup label="Light themes">
              <For each={LIGHT_THEMES}>
                {(themeName) => <option value={themeName}>{themeName}</option>}
              </For>
            </optgroup>
            <optgroup label="Dark themes">
              <For each={DARK_THEMES}>
                {(themeName) => <option value={themeName}>{themeName}</option>}
              </For>
            </optgroup>
          </select>
        </div>

        <div class="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              if (allFilesCollapsed()) {
                setCollapsedDiffFiles(new Set<string>());
                return;
              }

              setCollapsedDiffFiles(new Set(allRenderedPaths()));
            }}
            class={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              allFilesCollapsed()
                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            title={allFilesCollapsed() ? "Expand all files" : "Collapse all files"}
            disabled={allRenderedPaths().length === 0}
          >
            {allFilesCollapsed() ? "Expand all" : "Collapse all"}
          </button>
          <button
            type="button"
            onClick={() => handleToggleViewed(allRenderedPaths())}
            class={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              allFilesViewed()
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            title={allFilesViewed() ? "Mark all files as not viewed" : "Mark all files as viewed"}
            disabled={allRenderedPaths().length === 0}
          >
            {allFilesViewed() ? "Viewed all" : "Mark all viewed"}
          </button>
          <button
            type="button"
            onClick={() => setWrapping(!wrapping())}
            class={`rounded p-1.5 transition-colors ${
              wrapping()
                ? "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            title="Toggle line wrapping"
          >
            <WrapText size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIgnoreWhitespace(!ignoreWhitespace())}
            class={`rounded p-1.5 transition-colors ${
              ignoreWhitespace()
                ? "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            title="Ignore whitespace"
          >
            <Eye size={18} />
          </button>
        </div>

        <Show when={expandedFiles().size > 0}>
          <div class="ml-auto flex shrink-0 items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <span>{expandedFiles().size} file(s) fully expanded</span>
          </div>
        </Show>
      </div>

      <div
        ref={(element) => (layoutRef = element)}
        class="flex min-h-0 flex-1 overflow-hidden rounded-b border border-t-0 border-slate-200 bg-[var(--app-panel)] dark:border-slate-800"
      >
        <Show
          when={sidebarPosition() === "left"}
          fallback={
            <>
              <div class="min-w-0 flex-1 overflow-hidden">{renderContent()}</div>
              <Show when={!sidebarCollapsed()}>
                <button
                  type="button"
                  onMouseDown={(event) => startResize(event)}
                  aria-label="Resize sidebar"
                  class="group flex w-1.5 shrink-0 items-center justify-center bg-slate-100/90 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <span class="h-8 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500 dark:bg-slate-700 dark:group-hover:bg-slate-500" />
                </button>
              </Show>
              <div
                class="min-h-0 shrink-0 overflow-hidden border-l border-slate-200 dark:border-slate-800"
                style={{
                  width: sidebarCollapsed()
                    ? `${SIDEBAR_COLLAPSED_WIDTH_REM}rem`
                    : `${sidebarSize()}%`,
                  "min-width": sidebarCollapsed() ? `${SIDEBAR_COLLAPSED_WIDTH_REM}rem` : "16rem",
                }}
              >
                {renderSidebar()}
              </div>
            </>
          }
        >
          <div
            class="min-h-0 shrink-0 overflow-hidden border-r border-slate-200 dark:border-slate-800"
            style={{
              width: sidebarCollapsed() ? `${SIDEBAR_COLLAPSED_WIDTH_REM}rem` : `${sidebarSize()}%`,
              "min-width": sidebarCollapsed() ? `${SIDEBAR_COLLAPSED_WIDTH_REM}rem` : "16rem",
            }}
          >
            {renderSidebar()}
          </div>
          <Show when={!sidebarCollapsed()}>
            <button
              type="button"
              onMouseDown={(event) => startResize(event)}
              aria-label="Resize sidebar"
              class="group flex w-1.5 shrink-0 items-center justify-center bg-slate-100/90 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <span class="h-8 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500 dark:bg-slate-700 dark:group-hover:bg-slate-500" />
            </button>
          </Show>
          <div class="min-w-0 flex-1 overflow-hidden">{renderContent()}</div>
        </Show>
      </div>
    </div>
  );
}
