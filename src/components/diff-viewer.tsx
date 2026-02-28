import { FC, useMemo, useState, useCallback } from "react";
import { FileDiff as FileDiffComponent } from "@pierre/diffs/react";
import { parseDiffFromFile } from "@pierre/diffs";
import type { FileDiffMetadata, FileContents } from "@pierre/diffs";
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
        {/* View mode toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">View:</span>
          <button
            onClick={() => setViewMode("unified")}
            className={`px-3 py-1 text-sm font-medium rounded ${
              viewMode === "unified"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title="Unified diff view (stacked)"
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1 text-sm font-medium rounded ${
              viewMode === "split"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title="Split diff view (side-by-side)"
          >
            Split
          </button>
        </div>

        {/* Theme selectors and color mode toggle */}
        <div className="flex items-center gap-3 flex-shrink-0 border-l border-gray-300 pl-4">
          {/* Light theme selector */}
          <div className="flex items-center">
            <select
              value={LIGHT_THEMES.includes(theme as any) ? theme : lastLightTheme || ""}
              onChange={(e) => handleLightThemeChange(e.target.value)}
              className="rounded-l border border-r-0 border-gray-300 px-3 py-1 text-xs bg-white font-medium text-gray-700"
            >
              <option value="" disabled>
                Light Theme
              </option>
              {LIGHT_THEMES.map((t) => (
                <option key={t} value={t}>
                  {t
                    .split("-")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
            <div className="border border-l-0 border-gray-300 px-2 py-1 bg-white rounded-r text-xs">
              ☀️
            </div>
          </div>

          {/* Dark theme selector */}
          <div className="flex items-center">
            <select
              value={DARK_THEMES.includes(theme as any) ? theme : lastDarkTheme || ""}
              onChange={(e) => handleDarkThemeChange(e.target.value)}
              className="rounded-l border border-r-0 border-gray-300 px-3 py-1 text-xs bg-white font-medium text-gray-700"
            >
              <option value="" disabled>
                Dark Theme
              </option>
              {DARK_THEMES.map((t) => (
                <option key={t} value={t}>
                  {t
                    .split("-")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
            <div className="border border-l-0 border-gray-300 px-2 py-1 bg-white rounded-r text-xs">
              🌙
            </div>
          </div>

          {/* Color mode toggle buttons */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1 border border-gray-300">
            <button
              onClick={() => {
                setColorMode("auto");
                setTheme(lastLightTheme);
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === "auto"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-300"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Auto theme (follows system)"
            >
              ⚙️ Auto
            </button>
            <button
              onClick={() => {
                setColorMode("light");
                setTheme(lastLightTheme);
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === "light"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-300"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Light theme"
            >
              ☀️ Light
            </button>
            <button
              onClick={() => {
                setColorMode("dark");
                setTheme(lastDarkTheme);
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === "dark"
                  ? "bg-gray-700 text-white shadow-sm border border-gray-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Dark theme"
            >
              🌙 Dark
            </button>
          </div>

          {/* Wrapping toggle */}
          <div className="flex items-center gap-2 flex-shrink-0 border-l border-gray-300 pl-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wrapping}
                onChange={(e) => setWrapping(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
                title="Toggle line wrapping"
              />
              <span className="text-xs font-medium text-gray-700">Wrapping</span>
            </label>
          </div>

          {/* Ignore whitespace toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ignoreWhitespace}
                onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
                title="Ignore whitespace-only changes"
              />
              <span className="text-xs font-medium text-gray-700">Ignore whitespace</span>
            </label>
          </div>

          {/* Expand info */}
          <div className="flex items-center gap-2 flex-shrink-0 border-l border-gray-300 pl-4 text-xs text-gray-500">
            {expandedFiles.size > 0 && <span>{expandedFiles.size} file(s) fully expanded</span>}
          </div>
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
