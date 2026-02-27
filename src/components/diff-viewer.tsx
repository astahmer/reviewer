import { FC, useMemo } from "react";
import { FileDiff as FileDiffComponent } from "@pierre/diffs/react";
import type { FileDiffMetadata } from "@pierre/diffs";
import { useViewMode, useTheme, useColorMode } from "~/components/hooks";
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

  // Get available themes based on color mode
  const availableThemes = useMemo(() => {
    if (colorMode === "light") return LIGHT_THEMES;
    if (colorMode === "dark") return DARK_THEMES;
    // For auto, show all themes
    return [...LIGHT_THEMES, ...DARK_THEMES];
  }, [colorMode]);

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
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 flex items-center gap-6 overflow-x-auto">
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

        {/* Color mode and theme selector */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Theme:</span>

            {/* Theme selector dropdown */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
            >
              {availableThemes.map((t) => (
                <option key={t} value={t}>
                  {t
                    .split("-")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
          </div>

          {/* Color mode toggle buttons */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setColorMode("light")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === "light"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Light theme"
            >
              ☀️ Light
            </button>
            <button
              onClick={() => setColorMode("dark")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === "dark"
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Dark theme"
            >
              🌙 Dark
            </button>
            <button
              onClick={() => setColorMode("auto")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === "auto"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Auto theme (follows system)"
            >
              ⚙️ Auto
            </button>
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
                overflow: "wrap",
                disableLineNumbers: false,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
