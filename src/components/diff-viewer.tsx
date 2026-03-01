import { FC, useMemo, useState, useCallback } from "react";
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
} from "~/components/hooks";
import { LIGHT_THEMES, DARK_THEMES, STORAGE_KEYS } from "~/lib/constants";
import { Diff } from "~/lib/types";
import { Tooltip } from "./tooltip";

interface DiffViewerProps {
  diff: Diff & { pierreData?: FileDiffMetadata[] };
  repoPath?: string;
}

interface ExpandedFileData {
  file: FileDiffMetadata;
  oldContent: string;
  newContent: string;
}

/**
 * Unified and Split diff viewer using @pierre/diffs
 */
export const DiffViewer: FC<DiffViewerProps> = ({ diff, repoPath }) => {
  const [viewMode, setViewMode] = useViewMode();
  const [theme, setTheme] = useTheme();
  const [colorMode, setColorMode] = useColorMode();
  const [wrapping, setWrapping] = useWrapping();
  const [ignoreWhitespace, setIgnoreWhitespace] = useIgnoreWhitespace();

  const [expandedFiles, setExpandedFiles] = useState<Map<string, ExpandedFileData>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [lightMenuOpen, setLightMenuOpen] = useState(false);
  const [darkMenuOpen, setDarkMenuOpen] = useState(false);

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

        if (oldContentRes.ok && newContentRes.ok && oldContent && newContent) {
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
    [diff.from, diff.to, repoPath],
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
    if (LIGHT_THEMES.includes(newTheme as any)) {
      setTheme(newTheme);
      setLastLightTheme(newTheme);
      setColorMode("light");
    }
  };

  // Update last dark theme when dark dropdown changes
  const handleDarkThemeChange = (newTheme: string) => {
    if (DARK_THEMES.includes(newTheme as any)) {
      setTheme(newTheme);
      setLastDarkTheme(newTheme);
      setColorMode("dark");
    }
  };

  // Get files to render - use expanded full diff if available, otherwise use partial
  const getRenderFiles = useCallback(() => {
    const baseFiles = diff.pierreData || [];
    if (expandedFiles.size === 0) {
      return baseFiles;
    }

    return baseFiles.map((file) => {
      const key = `${file.name}-full`;
      const expanded = expandedFiles.get(key);
      if (expanded) {
        return expanded.file;
      }
      return file;
    });
  }, [diff.pierreData, expandedFiles]);

  const renderFiles = useMemo(() => getRenderFiles(), [getRenderFiles]);

  if (!renderFiles || renderFiles.length === 0) {
    return <div className="p-4 text-center text-gray-500">No diff data available</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 flex items-center gap-4 overflow-x-auto">
        {/* View mode toggle group */}
        <div className="flex items-center gap-1 flex-shrink-0 bg-white border border-gray-300 rounded-lg p-1">
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
        <div className="flex items-center gap-1 flex-shrink-0 bg-white border border-gray-300 rounded-lg p-1">
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
        <div className="flex items-center gap-2 flex-shrink-0 border-l border-gray-300 pl-4">
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
        <div className="flex items-center gap-2 flex-shrink-0 border-l border-gray-300 pl-4 text-xs text-gray-500 ml-auto">
          {expandedFiles.size > 0 && <span>{expandedFiles.size} file(s) fully expanded</span>}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        <div className="diffs-container">
          {renderFiles.map((file, idx) => {
            const fileKey = `${file.prevName || file.name}-${idx}`;
            const isLoading = loadingFiles.has(`${file.name}-full`);
            const isExpanded = expandedFiles.has(`${file.name}-full`);

            return (
              <div key={fileKey} className="relative">
                {/* Expand button overlay */}
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
                    theme: theme as any,
                    diffStyle: viewMode,
                    overflow: wrapping ? "wrap" : "scroll",
                    disableLineNumbers: false,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
