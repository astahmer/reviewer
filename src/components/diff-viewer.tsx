import { FC, useMemo, useState } from "react";
import { FileDiff as FileDiffComponent } from "@pierre/diffs/react";
import type { FileDiffMetadata, HunkExpansionRegion } from "@pierre/diffs";
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
}

/**
 * Unified and Split diff viewer using @pierre/diffs
 */
export const DiffViewer: FC<DiffViewerProps> = ({ diff }) => {
  const [viewMode, setViewMode] = useViewMode();
  const [theme, setTheme] = useTheme();
  const [colorMode, setColorMode] = useColorMode();
  const [wrapping, setWrapping] = useWrapping();
  const [ignoreWhitespace, setIgnoreWhitespace] = useIgnoreWhitespace();

  // Track last selected light and dark themes with localStorage
  const [lastLightTheme, setLastLightTheme] = useLocalStorage<string>(
    STORAGE_KEYS.lastLightTheme,
    LIGHT_THEMES[0],
  );
  const [lastDarkTheme, setLastDarkTheme] = useLocalStorage<string>(
    STORAGE_KEYS.lastDarkTheme,
    DARK_THEMES[0],
  );

  // Track expanded hunks for each file: Map<fileIndex, Map<hunkIndex, HunkExpansionRegion>>
  const [expandedHunksByFile, setExpandedHunksByFile] = useState<
    Map<number, Map<number, HunkExpansionRegion>>
  >(new Map());

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

  // Handle hunk expansion
  const handleHunkExpand = (
    fileIndex: number,
    hunkIndex: number,
    direction: "up" | "down" | "both",
    expandFully?: boolean,
  ) => {
    setExpandedHunksByFile((prevMap) => {
      const newMap = new Map(prevMap);
      const fileHunks = newMap.get(fileIndex) ?? new Map();
      const currentExpansion = fileHunks.get(hunkIndex);
      const expansionLineCount = 100; // Default expansion per click

      let newExpansion: HunkExpansionRegion;

      if (expandFully) {
        // Expand fully - set very high numbers to show all lines
        newExpansion = { fromStart: 999999, fromEnd: 999999 };
      } else {
        // Expand incrementally by expansionLineCount lines
        const currentFromStart = currentExpansion?.fromStart ?? 0;
        const currentFromEnd = currentExpansion?.fromEnd ?? 0;

        if (direction === "up") {
          newExpansion = {
            fromStart: currentFromStart + expansionLineCount,
            fromEnd: currentFromEnd,
          };
        } else if (direction === "down") {
          newExpansion = {
            fromStart: currentFromStart,
            fromEnd: currentFromEnd + expansionLineCount,
          };
        } else {
          // direction === "both"
          newExpansion = {
            fromStart: currentFromStart + expansionLineCount,
            fromEnd: currentFromEnd + expansionLineCount,
          };
        }
      }

      fileHunks.set(hunkIndex, newExpansion);
      newMap.set(fileIndex, fileHunks);
      return newMap;
    });
  };

  // Files to render from @pierre/diffs
  const pierreFiles = useMemo(() => {
    return diff.pierreData || [];
  }, [diff.pierreData]);

  if (!pierreFiles || pierreFiles.length === 0) {
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
                // When switching to auto, prefer the light theme
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
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        <div className="diffs-container">
          {pierreFiles.map((file, idx) => (
            <FileDiffComponent
              key={`${file.prevName || file.name}-${idx}`}
              fileDiff={file}
              options={{
                theme: theme as any,
                diffStyle: viewMode,
                overflow: wrapping ? "wrap" : "scroll",
                disableLineNumbers: false,
                expandedHunks: expandedHunksByFile.get(idx),
                onHunkExpand: (hunkIndex, direction, expandFully) => {
                  handleHunkExpand(idx, hunkIndex, direction, expandFully);
                },
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
