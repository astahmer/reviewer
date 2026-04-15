import { FC, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { FileDiff as FileDiffComponent } from "@pierre/diffs/react";
import { parseDiffFromFile } from "@pierre/diffs";
import type { FileDiffMetadata, FileContents } from "@pierre/diffs";
import * as Ark from "@ark-ui/react";
import { Sun, Moon, ChevronDown, WrapText, Eye } from "lucide-react";
import {
  useViewMode,
  useTheme,
  useColorMode,
  useWrapping,
  useIgnoreWhitespace,
  useLocalStorage,
  useSidebarPosition,
  useSidebarCollapsed,
  useSidebarSize,
} from "~/components/hooks";
import { LIGHT_THEMES, DARK_THEMES, STORAGE_KEYS, ThemeName } from "~/lib/constants";
import { CommitInfo, Diff } from "~/lib/types";
import type { SearchParams } from "~/routes/index";
import { CommitHistoryPanel } from "./commit-history-panel";
import { FileTreeSidebar } from "./file-tree-sidebar";
import { Tooltip } from "./tooltip";

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
  oldContent: string;
  newContent: string;
}

interface ParsedSearchQuery {
  pathFilter?: string;
  contentQuery: string;
}

const parseSearchQuery = (query: string | undefined): ParsedSearchQuery => {
  if (!query || !query.trim()) {
    return { contentQuery: "" };
  }

  const pathMatch = query.trim().match(/^path:(\S+)\s*(.*)$/);
  if (pathMatch && pathMatch[1]) {
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

const SIDEBAR_DEFAULT_SIZE = 28;
const SIDEBAR_MIN_SIZE = 16;
const SIDEBAR_COLLAPSED_SIZE = 3.2;

/**
 * Unified and Split diff viewer using @pierre/diffs
 */
export const DiffViewer: FC<DiffViewerProps> = ({
  diff,
  repoPath,
  baseBranchLabel,
  headBranchLabel,
  isSameBranchComparison,
  baseCommits,
  headCommits,
  baseCommit,
  headCommit,
  onBaseCommitChange,
  onHeadCommitChange,
  onLoadMoreBaseCommits,
  onLoadMoreHeadCommits,
  hasMoreBaseCommits,
  hasMoreHeadCommits,
}) => {
  const navigate = useNavigate({ from: "/" });
  const searchParams = useSearch({ from: "/" });

  const [viewMode, setViewMode] = useViewMode();
  const [theme, setTheme] = useTheme();
  const [colorMode, setColorMode] = useColorMode();
  const [wrapping, setWrapping] = useWrapping();
  const [ignoreWhitespace, setIgnoreWhitespace] = useIgnoreWhitespace();
  const [sidebarPosition, setSidebarPosition] = useSidebarPosition();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [sidebarSize, setSidebarSize] = useSidebarSize();

  const [expandedFiles, setExpandedFiles] = useState<Map<string, ExpandedFileData>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [collapsedDiffFiles, setCollapsedDiffFiles] = useState<Set<string>>(new Set());
  const [autoMarkViewed, setAutoMarkViewed] = useLocalStorage<boolean>(
    STORAGE_KEYS.autoMarkViewed,
    false,
  );
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const diffKey = `${baseCommit}:${headCommit}`;
  const [viewedPathsArray, setViewedPathsArray] = useLocalStorage<string[]>(
    `reviewer_app:viewed:${diffKey}`,
    [],
  );

  const markPathsViewed = useCallback(
    (paths: string[]) => {
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
    },
    [setViewedPathsArray],
  );

  const handleToggleViewed = (paths: string[]) => {
    setViewedPathsArray((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      const allViewed = paths.every((path) => nextPaths.has(path));

      if (allViewed) {
        for (const path of paths) {
          nextPaths.delete(path);
        }
      } else {
        for (const path of paths) {
          nextPaths.add(path);
        }
      }

      return Array.from(nextPaths);
    });
  };

  const handleToggleDiffFileCollapse = useCallback((filePath: string) => {
    setCollapsedDiffFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);
  const [lightMenuOpen, setLightMenuOpen] = useState(false);
  const [darkMenuOpen, setDarkMenuOpen] = useState(false);
  const [lightSearch, setLightSearch] = useState("");
  const [darkSearch, setDarkSearch] = useState("");
  const prevThemeOnMenuOpenRef = useRef<string | null>(null);
  const menuSelectionMadeRef = useRef(false);
  const [searchInput, setSearchInput] = useState(searchParams.searchQuery || "");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const layoutSplitter = Ark.useSplitter({
    id: `reviewer-diff-layout-${sidebarPosition}`,
    defaultSize:
      sidebarPosition === "left"
        ? [
            sidebarCollapsed ? SIDEBAR_COLLAPSED_SIZE : sidebarSize,
            sidebarCollapsed ? 100 - SIDEBAR_COLLAPSED_SIZE : 100 - sidebarSize,
          ]
        : [
            sidebarCollapsed ? 100 - SIDEBAR_COLLAPSED_SIZE : 100 - sidebarSize,
            sidebarCollapsed ? SIDEBAR_COLLAPSED_SIZE : sidebarSize,
          ],
    panels:
      sidebarPosition === "left"
        ? [
            {
              id: "sidebar",
              minSize: SIDEBAR_MIN_SIZE,
              collapsible: true,
              collapsedSize: SIDEBAR_COLLAPSED_SIZE,
            },
            {
              id: "content",
              minSize: 40,
            },
          ]
        : [
            {
              id: "content",
              minSize: 40,
            },
            {
              id: "sidebar",
              minSize: SIDEBAR_MIN_SIZE,
              collapsible: true,
              collapsedSize: SIDEBAR_COLLAPSED_SIZE,
            },
          ],
    onCollapse: (details) => {
      if (details.panelId === "sidebar") {
        setSidebarCollapsed(true);
      }
    },
    onExpand: (details) => {
      if (details.panelId === "sidebar") {
        setSidebarCollapsed(false);
      }
    },
    onResizeEnd: (details) => {
      const nextSidebarSize = sidebarPosition === "left" ? details.size[0] : details.size[1];
      if (typeof nextSidebarSize === "number" && nextSidebarSize > SIDEBAR_COLLAPSED_SIZE) {
        setSidebarSize(nextSidebarSize);
      }
    },
  });
  const parsedSearchQuery = useMemo(
    () => parseSearchQuery(searchParams.searchQuery),
    [searchParams.searchQuery],
  );
  const layoutSplitterRef = useRef(layoutSplitter);

  useEffect(() => {
    layoutSplitterRef.current = layoutSplitter;
  }, [layoutSplitter]);

  useEffect(() => {
    setSearchInput(searchParams.searchQuery || "");
  }, [searchParams.searchQuery]);

  useEffect(() => {
    if (sidebarCollapsed) {
      layoutSplitterRef.current.collapsePanel("sidebar");
      return;
    }

    if (layoutSplitterRef.current.isPanelCollapsed("sidebar")) {
      layoutSplitterRef.current.expandPanel("sidebar", sidebarSize || SIDEBAR_DEFAULT_SIZE);
    }
    const nextSizes =
      sidebarPosition === "left"
        ? [sidebarSize, 100 - sidebarSize]
        : [100 - sidebarSize, sidebarSize];
    layoutSplitterRef.current.setSizes(nextSizes);
  }, [sidebarCollapsed, sidebarPosition, sidebarSize]);

  const handleExpandFile = useCallback(
    async (
      fileName: string,
      oldPath: string,
      newPath: string,
      expandType: "full" | "top" | "bottom",
    ) => {
      if (!diff) {
        return;
      }

      const key = `${fileName}-${expandType}`;
      if (expandedFiles.has(key) || loadingFiles.has(key)) {
        return;
      }

      setLoadingFiles((prev) => new Set(prev).add(key));

      try {
        const [oldContentRes, newContentRes] = await Promise.all([
          fetch(
            `/api/file-content?filePath=${encodeURIComponent(oldPath)}&commit=${encodeURIComponent(diff.from)}&repoPath=${encodeURIComponent(repoPath || "")}`,
          ),
          fetch(
            `/api/file-content?filePath=${encodeURIComponent(newPath)}&commit=${encodeURIComponent(diff.to)}&repoPath=${encodeURIComponent(repoPath || "")}`,
          ),
        ]);

        const [{ content: oldContent }, { content: newContent }] = await Promise.all([
          oldContentRes.json(),
          newContentRes.json(),
        ]);

        if (oldContentRes.ok && newContentRes.ok) {
          const oldFile: FileContents = {
            name: oldPath,
            contents: oldContent,
          };
          const newFile: FileContents = {
            name: newPath,
            contents: newContent,
          };

          const fullDiff = parseDiffFromFile(oldFile, newFile);

          setExpandedFiles((prev) => {
            const newMap = new Map(prev);
            newMap.set(key, {
              file: fullDiff,
              oldContent,
              newContent,
            });
            return newMap;
          });
        }
      } catch (error) {
        console.error("Failed to expand file:", error);
      } finally {
        setLoadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    },
    [diff, expandedFiles, loadingFiles, repoPath],
  );

  const handleExpandHunk = useCallback(
    (
      fileKey: string,
      hunkIndex: number,
      direction: "up" | "down" | "both",
      expandFully?: boolean,
    ) => {
      const file = diff?.pierreData?.find((f, idx) => `${f.prevName || f.name}-${idx}` === fileKey);
      if (!file) return;

      const fileName = file.name;
      const oldPath = file.prevName || fileName;
      const newPath = fileName;

      if (expandFully || direction === "both") {
        handleExpandFile(fileName, oldPath, newPath, "full");
      } else if (direction === "up") {
        handleExpandFile(fileName, oldPath, newPath, "top");
      } else if (direction === "down") {
        handleExpandFile(fileName, oldPath, newPath, "bottom");
      }
    },
    [diff?.pierreData, handleExpandFile],
  );

  // Track last selected light and dark themes with localStorage
  const [lastLightTheme, setLastLightTheme] = useLocalStorage<string>(
    STORAGE_KEYS.lastLightTheme,
    LIGHT_THEMES[0],
  );
  const [lastDarkTheme, setLastDarkTheme] = useLocalStorage<string>(
    STORAGE_KEYS.lastDarkTheme,
    DARK_THEMES[0],
  );

  // Update last light theme when light dropdown changes
  const handleLightThemeChange = (newTheme: string) => {
    if (LIGHT_THEMES.includes(newTheme as (typeof LIGHT_THEMES)[number])) {
      menuSelectionMadeRef.current = true;
      setTheme(newTheme);
      setLastLightTheme(newTheme);
      setColorMode("light");
      setLightMenuOpen(false);
    }
  };

  // Update last dark theme when dark dropdown changes
  const handleDarkThemeChange = (newTheme: string) => {
    if (DARK_THEMES.includes(newTheme as (typeof DARK_THEMES)[number])) {
      menuSelectionMadeRef.current = true;
      setTheme(newTheme);
      setLastDarkTheme(newTheme);
      setColorMode("dark");
      setDarkMenuOpen(false);
    }
  };

  // Get files to render - use expanded full diff if available, otherwise use partial
  const getRenderFiles = useCallback(() => {
    const baseFiles = diff?.pierreData || [];

    let filtered = baseFiles;

    if (parsedSearchQuery.pathFilter) {
      filtered = filtered.filter((file) => {
        const filePath = file.prevName || file.name;
        return filePath.includes(parsedSearchQuery.pathFilter || "");
      });
    }

    if (parsedSearchQuery.contentQuery) {
      filtered = filtered.filter((file) =>
        fileMatchesContentQuery(file, parsedSearchQuery.contentQuery),
      );
    }

    if (filtered.length === 0) {
      return filtered;
    }

    if (expandedFiles.size === 0) {
      return filtered;
    }

    return filtered.map((file) => {
      const key = `${file.name}-full`;
      const expanded = expandedFiles.get(key);
      if (expanded) {
        return expanded.file;
      }
      return file;
    });
  }, [diff?.pierreData, expandedFiles, parsedSearchQuery]);

  const renderFiles = useMemo(() => getRenderFiles(), [getRenderFiles]);
  const renderFilePaths = useMemo(() => renderFiles.map((file) => file.name), [renderFiles]);
  const renderFilePathSet = useMemo(() => new Set(renderFilePaths), [renderFilePaths]);
  const visibleViewedPaths = useMemo(
    () => new Set(viewedPathsArray.filter((path) => renderFilePathSet.has(path))),
    [renderFilePathSet, viewedPathsArray],
  );
  const allRenderedPaths = renderFiles.map((file) => file.name);
  const allFilesCollapsed =
    allRenderedPaths.length > 0 && allRenderedPaths.every((path) => collapsedDiffFiles.has(path));
  const allFilesViewed =
    allRenderedPaths.length > 0 && allRenderedPaths.every((path) => visibleViewedPaths.has(path));
  const fileMatchCounts = useMemo(
    () =>
      new Map(renderFiles.map((file) => [file.name, getFileMatchCount(file, parsedSearchQuery)])),
    [parsedSearchQuery, renderFiles],
  );
  const hasActiveSearch = Boolean(parsedSearchQuery.pathFilter || parsedSearchQuery.contentQuery);

  const fileRefs = useRef(new Map<string, HTMLDivElement>());

  const setFileRef = useCallback((path: string, element: HTMLDivElement | null) => {
    if (element) {
      fileRefs.current.set(path, element);
    } else {
      fileRefs.current.delete(path);
    }
  }, []);

  const handleSelectPath = useCallback((path: string) => {
    setSelectedPath(path);
    fileRefs.current.get(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const renderPaths = useMemo(() => renderFiles.map((file) => file.name), [renderFiles]);

  useEffect(() => {
    const scrollElement = contentScrollRef.current;
    if (!scrollElement) {
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

      for (const [path, element] of fileRefs.current.entries()) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.bottom > scrollRect.top && rect.top < scrollRect.bottom;

        if (!isVisible) {
          continue;
        }

        if (autoMarkViewed && rect.bottom > activeLine) {
          pathsToMark.push(path);
        }

        const containsActiveLine = rect.top <= activeLine && rect.bottom >= activeLine;
        if (containsActiveLine) {
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

      const nextSelectedPath = currentPath ?? nextPath ?? renderFiles[0]?.name ?? null;
      if (nextSelectedPath && nextSelectedPath !== selectedPath) {
        setSelectedPath(nextSelectedPath);
      }

      if (autoMarkViewed && pathsToMark.length > 0) {
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

    return () => {
      scrollElement.removeEventListener("scroll", onScroll);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [autoMarkViewed, markPathsViewed, renderFiles, selectedPath, viewedPathsArray]);

  useEffect(() => {
    if (renderPaths.length === 0) {
      if (selectedPath !== null) {
        setSelectedPath(null);
      }
      return;
    }

    if (!selectedPath || !renderPaths.includes(selectedPath)) {
      setSelectedPath(renderPaths[0] ?? null);
    }
  }, [renderPaths, selectedPath]);

  const Controls = (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-slate-200 bg-[var(--app-panel)] px-3 py-2 dark:border-slate-800">
      {/* Search diffs input */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              navigate({
                search: (prev: SearchParams) => ({
                  ...prev,
                  searchQuery: searchInput || undefined,
                }),
              });
            }
          }}
          placeholder="Search diffs... (text or path:src/file.tsx token)"
          className="h-9 min-w-[14rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          onClick={() => {
            navigate({
              search: (prev: SearchParams) => ({
                ...prev,
                searchQuery: searchInput || undefined,
              }),
            });
          }}
          className="h-9 rounded-md bg-blue-500 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        >
          Search
        </button>
      </div>

      {/* View mode toggle group */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={() => setViewMode("unified")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
            viewMode === "unified"
              ? "border border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          }`}
          title="Unified diff view (stacked)"
        >
          Unified
        </button>
        <button
          onClick={() => setViewMode("split")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
            viewMode === "split"
              ? "border border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          }`}
          title="Split diff view (side-by-side)"
        >
          Split
        </button>
      </div>

      {/* Color mode and theme toggle-split group */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {/* Auto button */}
        <Tooltip content="Auto theme">
          <button
            onClick={() => {
              setColorMode("auto");
              setTheme(theme);
            }}
            className={`px-2 py-1.5 transition-colors rounded border ${
              colorMode === "auto"
                ? "border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            ⚙️
          </button>
        </Tooltip>

        {/* Light theme split button */}
        <Ark.Menu.Root
          open={lightMenuOpen}
          onOpenChange={(details) => {
            if (details.open) {
              prevThemeOnMenuOpenRef.current = theme;
              menuSelectionMadeRef.current = false;
              setLightSearch("");
            } else {
              if (!menuSelectionMadeRef.current && prevThemeOnMenuOpenRef.current) {
                setTheme(prevThemeOnMenuOpenRef.current);
              }
              prevThemeOnMenuOpenRef.current = null;
            }
            setLightMenuOpen(details.open);
          }}
        >
          <div className="flex items-center gap-0">
            <Tooltip content="Light theme">
              <button
                onClick={() => {
                  setColorMode("light");
                  setTheme(lastLightTheme);
                }}
                className={`px-2 py-1.5 transition-colors flex items-center gap-1 rounded-l border ${
                  colorMode === "light"
                    ? "border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
              >
                <Sun size={16} />
              </button>
            </Tooltip>
            <Ark.Menu.Trigger asChild>
              <button
                className={`rounded-r border px-1.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
                  colorMode === "light"
                    ? "border-slate-300 bg-slate-100 shadow-sm dark:border-slate-600 dark:bg-slate-800"
                    : "border-transparent"
                }`}
              >
                <ChevronDown size={14} />
              </button>
            </Ark.Menu.Trigger>
          </div>
          <Ark.Menu.Positioner>
            <Ark.Menu.Content className="z-50 min-w-48 overflow-hidden rounded border border-slate-200 bg-[var(--app-panel)] shadow-lg dark:border-slate-700">
              <div className="border-b border-slate-100 p-1.5 dark:border-slate-800">
                <input
                  type="text"
                  value={lightSearch}
                  onChange={(e) => setLightSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search themes..."
                  autoFocus
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {LIGHT_THEMES.filter((t) =>
                  t.toLowerCase().includes(lightSearch.toLowerCase()),
                ).map((t) => (
                  <Ark.Menu.Item
                    key={t}
                    value={t}
                    onClick={() => handleLightThemeChange(t)}
                    onPointerEnter={() => setTheme(t)}
                    className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                      theme === t
                        ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {t
                      .split("-")
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(" ")}
                  </Ark.Menu.Item>
                ))}
              </div>
            </Ark.Menu.Content>
          </Ark.Menu.Positioner>
        </Ark.Menu.Root>

        {/* Dark theme split button */}
        <Ark.Menu.Root
          open={darkMenuOpen}
          onOpenChange={(details) => {
            if (details.open) {
              prevThemeOnMenuOpenRef.current = theme;
              menuSelectionMadeRef.current = false;
              setDarkSearch("");
            } else {
              if (!menuSelectionMadeRef.current && prevThemeOnMenuOpenRef.current) {
                setTheme(prevThemeOnMenuOpenRef.current);
              }
              prevThemeOnMenuOpenRef.current = null;
            }
            setDarkMenuOpen(details.open);
          }}
        >
          <div className="flex gap-0">
            <Tooltip content="Dark theme">
              <button
                onClick={() => {
                  setColorMode("dark");
                  setTheme(lastDarkTheme);
                }}
                className={`px-2 py-1.5 transition-colors flex items-center gap-1 rounded-l border ${
                  colorMode === "dark"
                    ? "border-slate-600 bg-slate-800 text-slate-100 shadow-sm"
                    : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
              >
                <Moon size={16} />
              </button>
            </Tooltip>
            <Ark.Menu.Trigger asChild>
              <button
                className={`rounded-r border px-1.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
                  colorMode === "dark"
                    ? "border-slate-600 bg-slate-800 text-slate-100 shadow-sm"
                    : "border-transparent"
                }`}
              >
                <ChevronDown size={14} />
              </button>
            </Ark.Menu.Trigger>
          </div>
          <Ark.Menu.Positioner>
            <Ark.Menu.Content className="z-50 min-w-48 overflow-hidden rounded border border-slate-200 bg-[var(--app-panel)] shadow-lg dark:border-slate-700">
              <div className="border-b border-slate-100 p-1.5 dark:border-slate-800">
                <input
                  type="text"
                  value={darkSearch}
                  onChange={(e) => setDarkSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search themes..."
                  autoFocus
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {DARK_THEMES.filter((t) => t.toLowerCase().includes(darkSearch.toLowerCase())).map(
                  (t) => (
                    <Ark.Menu.Item
                      key={t}
                      value={t}
                      onClick={() => handleDarkThemeChange(t)}
                      onPointerEnter={() => setTheme(t)}
                      className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                        theme === t
                          ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {t
                        .split("-")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ")}
                    </Ark.Menu.Item>
                  ),
                )}
              </div>
            </Ark.Menu.Content>
          </Ark.Menu.Positioner>
        </Ark.Menu.Root>
      </div>

      {/* Wrapping and Ignore whitespace toggles */}
      <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-3 dark:border-slate-700">
        <button
          onClick={() => {
            if (allFilesCollapsed) {
              setCollapsedDiffFiles(new Set());
              return;
            }

            setCollapsedDiffFiles(new Set(allRenderedPaths));
          }}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            allFilesCollapsed
              ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
          title={allFilesCollapsed ? "Expand all files" : "Collapse all files"}
          disabled={allRenderedPaths.length === 0}
        >
          {allFilesCollapsed ? "Expand all" : "Collapse all"}
        </button>
        <button
          onClick={() => handleToggleViewed(allRenderedPaths)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            allFilesViewed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
          title={allFilesViewed ? "Mark all files as not viewed" : "Mark all files as viewed"}
          disabled={allRenderedPaths.length === 0}
        >
          {allFilesViewed ? "Viewed all" : "Mark all viewed"}
        </button>
        <Tooltip content="Toggle line wrapping">
          <button
            onClick={() => setWrapping(!wrapping)}
            className={`p-1.5 rounded transition-colors ${
              wrapping
                ? "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <WrapText size={18} />
          </button>
        </Tooltip>
        <Tooltip content="Ignore whitespace">
          <button
            onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
            className={`p-1.5 rounded transition-colors ${
              ignoreWhitespace
                ? "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Eye size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Expand info */}
      {expandedFiles.size > 0 && (
        <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <span>{expandedFiles.size} file(s) fully expanded</span>
        </div>
      )}
    </div>
  );

  const MainContent =
    !renderFiles || renderFiles.length === 0 ? (
      <div className="flex h-full items-center justify-center px-6 text-center text-slate-600 dark:text-slate-400">
        No diff available for the selected refs.
      </div>
    ) : (
      <div className="diffs-container">
        {renderFiles.map((file, idx) => {
          const fileKey = `${file.prevName || file.name}-${idx}`;
          const isLoading = loadingFiles.has(`${file.name}-full`);
          const isExpanded = expandedFiles.has(`${file.name}-full`);
          const isSelected = selectedPath === file.name;
          const isDiffCollapsed = collapsedDiffFiles.has(file.name);
          const isViewed = visibleViewedPaths.has(file.name);
          const additions = file.additionLines?.length ?? 0;
          const deletions = file.deletionLines?.length ?? 0;

          return (
            <div
              key={fileKey}
              data-file-path={file.name}
              ref={(element) => setFileRef(file.name, element)}
              className={`relative scroll-mt-4 border-b border-slate-200 dark:border-slate-800 last:border-b-0 ${
                isSelected ? "bg-sky-50/30 dark:bg-sky-950/10" : ""
              }`}
            >
              {/* File header - always visible, acts as collapse toggle */}
              <div
                className={`sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 backdrop-blur-sm dark:border-slate-800 ${
                  isDiffCollapsed
                    ? "border-t-0 bg-white/95 dark:bg-slate-900/95"
                    : "bg-slate-50/95 dark:bg-slate-900/95"
                } ${isViewed ? "opacity-60" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleDiffFileCollapse(file.name)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={isDiffCollapsed ? "Expand diff" : "Collapse diff"}
                >
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-slate-500 transition-transform ${
                      isDiffCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                    {file.prevName && file.prevName !== file.name
                      ? `${file.prevName} → ${file.name}`
                      : file.name}
                  </span>
                  {additions > 0 || deletions > 0 ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold">
                      {additions > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">+{additions}</span>
                      )}
                      {deletions > 0 && (
                        <span className="text-rose-500 dark:text-rose-400">-{deletions}</span>
                      )}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  title={isViewed ? "Mark as not viewed" : "Mark as viewed"}
                  onClick={() => handleToggleViewed([file.name])}
                  className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    isViewed
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : "text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  <Eye size={12} />
                  <span>{isViewed ? "Viewed" : "Mark viewed"}</span>
                </button>
              </div>

              {!isDiffCollapsed && (
                <>
                  {!isExpanded && !isLoading && (
                    <button
                      onClick={() => handleExpandHunk(fileKey, 0, "both", true)}
                      className="absolute top-12 right-2 z-10 px-2 py-1 text-xs bg-blue-500 text-white rounded shadow hover:bg-blue-600"
                    >
                      Load full file
                    </button>
                  )}
                  {isLoading && (
                    <div className="absolute top-12 right-2 z-10 px-2 py-1 text-xs bg-gray-500 text-white rounded">
                      Loading...
                    </div>
                  )}
                  <FileDiffComponent
                    fileDiff={file}
                    options={{
                      theme: theme as ThemeName,
                      diffStyle: viewMode,
                      overflow: wrapping ? "wrap" : "scroll",
                      disableLineNumbers: false,
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    );

  const renderSidebar = () => (
    <FileTreeSidebar
      files={renderFiles}
      selectedPath={selectedPath}
      onSelectPath={handleSelectPath}
      position={sidebarPosition}
      onTogglePosition={() => setSidebarPosition(sidebarPosition === "left" ? "right" : "left")}
      collapsed={layoutSplitter.isPanelCollapsed("sidebar")}
      onToggleCollapsed={() => setSidebarCollapsed(!layoutSplitter.isPanelCollapsed("sidebar"))}
      matchCounts={fileMatchCounts}
      showMatchCounts={hasActiveSearch}
      viewedPaths={visibleViewedPaths}
      onToggleViewed={handleToggleViewed}
      autoMarkViewed={autoMarkViewed}
      onToggleAutoMarkViewed={() => setAutoMarkViewed((current) => !current)}
      footer={
        <CommitHistoryPanel
          baseBranchLabel={baseBranchLabel}
          headBranchLabel={headBranchLabel}
          isSameBranchComparison={isSameBranchComparison}
          baseCommits={baseCommits}
          headCommits={headCommits}
          selectedBaseCommit={baseCommit}
          selectedHeadCommit={headCommit}
          onBaseCommitChange={onBaseCommitChange}
          onHeadCommitChange={onHeadCommitChange}
          onLoadMoreBase={onLoadMoreBaseCommits}
          onLoadMoreHead={onLoadMoreHeadCommits}
          hasMoreBase={hasMoreBaseCommits}
          hasMoreHead={hasMoreHeadCommits}
        />
      }
    />
  );

  const renderContent = () => (
    <div ref={contentScrollRef} className="min-w-0 h-full overflow-auto">
      {MainContent}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {Controls}

      <Ark.Splitter.RootProvider
        value={layoutSplitter}
        className="flex min-h-0 flex-1 overflow-hidden rounded-b border border-t-0 border-slate-200 bg-[var(--app-panel)] dark:border-slate-800"
      >
        {sidebarPosition === "left" ? (
          <>
            <Ark.Splitter.Panel
              id="sidebar"
              className="min-h-0 overflow-hidden border-r border-slate-200 dark:border-slate-800"
            >
              {renderSidebar()}
            </Ark.Splitter.Panel>

            {!layoutSplitter.isPanelCollapsed("sidebar") ? (
              <Ark.Splitter.ResizeTrigger
                id="sidebar:content"
                aria-label="Resize sidebar"
                className="group flex w-1.5 shrink-0 items-center justify-center bg-slate-100/90 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className="h-8 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500 dark:bg-slate-700 dark:group-hover:bg-slate-500" />
              </Ark.Splitter.ResizeTrigger>
            ) : null}

            <Ark.Splitter.Panel id="content" className="min-h-0 overflow-hidden">
              {renderContent()}
            </Ark.Splitter.Panel>
          </>
        ) : (
          <>
            <Ark.Splitter.Panel id="content" className="min-h-0 overflow-hidden">
              {renderContent()}
            </Ark.Splitter.Panel>

            {!layoutSplitter.isPanelCollapsed("sidebar") ? (
              <Ark.Splitter.ResizeTrigger
                id="content:sidebar"
                aria-label="Resize sidebar"
                className="group flex w-1.5 shrink-0 items-center justify-center bg-slate-100/90 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className="h-8 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500 dark:bg-slate-700 dark:group-hover:bg-slate-500" />
              </Ark.Splitter.ResizeTrigger>
            ) : null}

            <Ark.Splitter.Panel
              id="sidebar"
              className="min-h-0 overflow-hidden border-l border-slate-200 dark:border-slate-800"
            >
              {renderSidebar()}
            </Ark.Splitter.Panel>
          </>
        )}
      </Ark.Splitter.RootProvider>
    </div>
  );
};
