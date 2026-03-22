import { FC, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { FileDiff as FileDiffComponent } from "@pierre/diffs/react";
import { parseDiffFromFile } from "@pierre/diffs";
import type { FileDiffMetadata, FileContents } from "@pierre/diffs";
import * as Ark from "@ark-ui/react";
import { Sun, Moon, ChevronDown, WrapText, Eye, Monitor } from "lucide-react";
import {
  useViewMode,
  useTheme,
  useColorMode,
  useGlobalColorMode,
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
  diff: Diff & { pierreData?: FileDiffMetadata[] };
  repoPath?: string;
  baseBranch: string;
  headBranch: string;
  baseCommits: CommitInfo[];
  headCommits: CommitInfo[];
  baseCommit: string;
  headCommit: string;
  onBaseCommitChange?: (hash: string) => void;
  onHeadCommitChange?: (hash: string) => void;
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

const getResolvedSystemMode = () => {
  if (typeof window === "undefined") {
    return "light" as const;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * Unified and Split diff viewer using @pierre/diffs
 */
export const DiffViewer: FC<DiffViewerProps> = ({
  diff,
  repoPath,
  baseBranch,
  headBranch,
  baseCommits,
  headCommits,
  baseCommit,
  headCommit,
  onBaseCommitChange,
  onHeadCommitChange,
}) => {
  const navigate = useNavigate({ from: "/" });
  const searchParams = useSearch({ from: "/" });

  const [viewMode, setViewMode] = useViewMode();
  const [theme, setTheme] = useTheme();
  const [colorMode, setColorMode] = useColorMode();
  const [globalColorMode, setGlobalColorMode] = useGlobalColorMode();
  const [wrapping, setWrapping] = useWrapping();
  const [ignoreWhitespace, setIgnoreWhitespace] = useIgnoreWhitespace();
  const [sidebarPosition, setSidebarPosition] = useSidebarPosition();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [sidebarSize, setSidebarSize] = useSidebarSize();

  const [expandedFiles, setExpandedFiles] = useState<Map<string, ExpandedFileData>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [lightMenuOpen, setLightMenuOpen] = useState(false);
  const [darkMenuOpen, setDarkMenuOpen] = useState(false);
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

  useEffect(() => {
    setSearchInput(searchParams.searchQuery || "");
  }, [searchParams.searchQuery]);

  useEffect(() => {
    if (sidebarCollapsed) {
      layoutSplitter.collapsePanel("sidebar");
      return;
    }

    if (layoutSplitter.isPanelCollapsed("sidebar")) {
      layoutSplitter.expandPanel("sidebar", sidebarSize || SIDEBAR_DEFAULT_SIZE);
    }
    const nextSizes =
      sidebarPosition === "left"
        ? [sidebarSize, 100 - sidebarSize]
        : [100 - sidebarSize, sidebarSize];
    layoutSplitter.setSizes(nextSizes);
  }, [layoutSplitter, sidebarCollapsed, sidebarPosition, sidebarSize]);

  const handleExpandFile = useCallback(
    async (
      fileName: string,
      oldPath: string,
      newPath: string,
      expandType: "full" | "top" | "bottom",
    ) => {
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
    [diff.from, diff.to, expandedFiles, loadingFiles, repoPath],
  );

  const handleExpandHunk = useCallback(
    (
      fileKey: string,
      hunkIndex: number,
      direction: "up" | "down" | "both",
      expandFully?: boolean,
    ) => {
      const file = diff.pierreData?.find((f, idx) => `${f.prevName || f.name}-${idx}` === fileKey);
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
    [diff.pierreData, handleExpandFile],
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
      setTheme(newTheme);
      setLastLightTheme(newTheme);
      setColorMode("light");
    }
  };

  // Update last dark theme when dark dropdown changes
  const handleDarkThemeChange = (newTheme: string) => {
    if (DARK_THEMES.includes(newTheme as (typeof DARK_THEMES)[number])) {
      setTheme(newTheme);
      setLastDarkTheme(newTheme);
      setColorMode("dark");
    }
  };

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

    const resolvedMode = getResolvedSystemMode();
    setColorMode("auto");
    setTheme(resolvedMode === "dark" ? lastDarkTheme : lastLightTheme);
  };

  // Get files to render - use expanded full diff if available, otherwise use partial
  const getRenderFiles = useCallback(() => {
    const baseFiles = diff.pierreData || [];

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
  }, [diff.pierreData, expandedFiles, parsedSearchQuery]);

  const renderFiles = useMemo(() => getRenderFiles(), [getRenderFiles]);
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
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={() => setViewMode("unified")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
            viewMode === "unified"
              ? "bg-gray-100 text-gray-900 shadow-sm border border-gray-300"
              : "text-gray-600 hover:text-gray-900"
          }`}
          title="Unified diff view (stacked)"
        >
          Unified
        </button>
        <button
          onClick={() => setViewMode("split")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
            viewMode === "split"
              ? "bg-gray-100 text-gray-900 shadow-sm border border-gray-300"
              : "text-gray-600 hover:text-gray-900"
          }`}
          title="Split diff view (side-by-side)"
        >
          Split
        </button>
      </div>

      {/* Color mode and theme toggle-split group */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <Tooltip content="Global light mode">
          <button
            onClick={() => handleGlobalColorModeChange("light")}
            className={`rounded border px-2 py-1.5 transition-colors ${
              globalColorMode === "light"
                ? "border-slate-300 bg-slate-100 text-slate-900"
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Sun size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Global auto mode">
          <button
            onClick={() => handleGlobalColorModeChange("auto")}
            className={`rounded border px-2 py-1.5 transition-colors ${
              globalColorMode === "auto"
                ? "border-slate-300 bg-slate-100 text-slate-900"
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Monitor size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Global dark mode">
          <button
            onClick={() => handleGlobalColorModeChange("dark")}
            className={`rounded border px-2 py-1.5 transition-colors ${
              globalColorMode === "dark"
                ? "border-slate-300 bg-slate-100 text-slate-900"
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Moon size={14} />
          </button>
        </Tooltip>
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {/* Auto button */}
        <Tooltip content="Auto theme">
          <button
            onClick={() => {
              setColorMode("auto");
              setTheme(lastLightTheme);
            }}
            className={`px-2 py-1.5 transition-colors rounded border ${
              colorMode === "auto"
                ? "bg-gray-100 text-gray-900 shadow-sm border-gray-300"
                : "text-gray-600 hover:text-gray-900 border-transparent"
            }`}
          >
            ⚙️
          </button>
        </Tooltip>

        {/* Light theme split button */}
        <Ark.Menu.Root
          open={lightMenuOpen}
          onOpenChange={(details) => setLightMenuOpen(details.open)}
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
                    ? "bg-gray-100 text-gray-900 shadow-sm border-gray-300"
                    : "text-gray-600 hover:text-gray-900 border-transparent"
                }`}
              >
                <Sun size={16} />
              </button>
            </Tooltip>
            <Ark.Menu.Trigger asChild>
              <button
                className={`px-1.5 py-1.5 text-gray-600 hover:text-gray-900 transition-colors rounded-r border ${
                  colorMode === "light"
                    ? "bg-gray-100 shadow-sm border-gray-300"
                    : "border-transparent"
                }`}
              >
                <ChevronDown size={14} />
              </button>
            </Ark.Menu.Trigger>
          </div>
          <Ark.Menu.Positioner>
            <Ark.Menu.Content className="bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-40">
              {LIGHT_THEMES.map((t) => (
                <Ark.Menu.Item
                  key={t}
                  value={t}
                  onClick={() => handleLightThemeChange(t)}
                  className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    theme === t
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t
                    .split("-")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </Ark.Menu.Item>
              ))}
            </Ark.Menu.Content>
          </Ark.Menu.Positioner>
        </Ark.Menu.Root>

        {/* Dark theme split button */}
        <Ark.Menu.Root
          open={darkMenuOpen}
          onOpenChange={(details) => setDarkMenuOpen(details.open)}
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
                    ? "bg-blue-900 text-white shadow-sm border-blue-700"
                    : "text-gray-600 hover:text-gray-900 border-transparent"
                }`}
              >
                <Moon size={16} />
              </button>
            </Tooltip>
            <Ark.Menu.Trigger asChild>
              <button
                className={`px-1.5 py-1.5 text-gray-600 transition-colors rounded-r border ${
                  colorMode === "dark"
                    ? "bg-blue-900 text-white shadow-sm border-blue-700 hover:text-white"
                    : "border-transparent"
                }`}
              >
                <ChevronDown size={14} />
              </button>
            </Ark.Menu.Trigger>
          </div>
          <Ark.Menu.Positioner>
            <Ark.Menu.Content className="bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-40">
              {DARK_THEMES.map((t) => (
                <Ark.Menu.Item
                  key={t}
                  value={t}
                  onClick={() => handleDarkThemeChange(t)}
                  className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    theme === t
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t
                    .split("-")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </Ark.Menu.Item>
              ))}
            </Ark.Menu.Content>
          </Ark.Menu.Positioner>
        </Ark.Menu.Root>
      </div>

      {/* Wrapping and Ignore whitespace toggles */}
      <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-3 dark:border-slate-700">
        <Tooltip content="Toggle line wrapping">
          <button
            onClick={() => setWrapping(!wrapping)}
            className={`p-1.5 rounded transition-colors ${
              wrapping ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <WrapText size={18} />
          </button>
        </Tooltip>
        <Tooltip content="Ignore whitespace">
          <button
            onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
            className={`p-1.5 rounded transition-colors ${
              ignoreWhitespace ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"
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
      <div className="flex h-full items-center justify-center px-6 text-center text-gray-500">
        No diff data available
      </div>
    ) : (
      <div className="diffs-container">
        {renderFiles.map((file, idx) => {
          const fileKey = `${file.prevName || file.name}-${idx}`;
          const isLoading = loadingFiles.has(`${file.name}-full`);
          const isExpanded = expandedFiles.has(`${file.name}-full`);
          const isSelected = selectedPath === file.name;

          return (
            <div
              key={fileKey}
              ref={(element) => setFileRef(file.name, element)}
              className={`relative scroll-mt-4 ${isSelected ? "bg-sky-50/30" : ""}`}
            >
              {!isExpanded && !isLoading && (
                <button
                  onClick={() => handleExpandHunk(fileKey, 0, "both", true)}
                  className="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-blue-500 text-white rounded shadow hover:bg-blue-600"
                >
                  Load full file
                </button>
              )}
              {isLoading && (
                <div className="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-gray-500 text-white rounded">
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
      footer={
        <CommitHistoryPanel
          baseBranch={baseBranch}
          headBranch={headBranch}
          baseCommits={baseCommits}
          headCommits={headCommits}
          selectedBaseCommit={baseCommit}
          selectedHeadCommit={headCommit}
          onBaseCommitChange={onBaseCommitChange}
          onHeadCommitChange={onHeadCommitChange}
        />
      }
    />
  );

  const renderContent = () => <div className="min-w-0 h-full overflow-auto">{MainContent}</div>;

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
              className="min-h-0 overflow-hidden border-r border-slate-200"
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
              className="min-h-0 overflow-hidden border-l border-slate-200"
            >
              {renderSidebar()}
            </Ark.Splitter.Panel>
          </>
        )}
      </Ark.Splitter.RootProvider>
    </div>
  );
};
