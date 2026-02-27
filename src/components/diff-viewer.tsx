import { FC, useMemo } from "react";
import { FileDiff as FileDiffComponent } from "@pierre/diffs/react";
import type { FileDiffMetadata } from "@pierre/diffs";
import { useViewMode, useTheme, useColorMode, useWrapping } from "~/components/hooks";
import { LIGHT_THEMES, DARK_THEMES } from "~/lib/constants";
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
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                setColorMode("light");
              }}
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
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                setColorMode("dark");
              }}
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
              onClick={() => setColorMode("auto")}
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
              onClick={() => setColorMode("light")}
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
              onClick={() => setColorMode("dark")}
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
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
