import { FC, useState } from 'react'
import { Diff, Line } from '~/lib/types'
import { UnifiedDiffViewer } from './unified-diff-viewer'
import { SplitDiffViewer } from './split-diff-viewer'

type ViewMode = 'unified' | 'split'

interface DiffViewerProps {
  /**
   * The diff to display
   */
  diff: Diff
  /**
   * Lines to highlight (via search)
   */
  highlightedIds?: Set<string>
  /**
   * Callback when line is selected
   */
  onLineSelect?: (line: Line) => void
  /**
   * Default view mode
   */
  defaultMode?: ViewMode
}

/**
 * Main diff viewer component with view mode switcher
 * Allows toggling between unified and split view
 */
export const DiffViewer: FC<DiffViewerProps> = ({ diff, highlightedIds, onLineSelect, defaultMode = 'unified' }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode)

  return (
    <div className="flex flex-col h-full gap-3">
      {/* View mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('unified')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            viewMode === 'unified'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Unified View
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            viewMode === 'split'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Split View
        </button>
      </div>

      {/* Viewer */}
      <div className="flex-1 min-h-0">
        {viewMode === 'unified' ? (
          <UnifiedDiffViewer
            diff={diff}
            highlightedIds={highlightedIds}
            onLineSelect={onLineSelect}
          />
        ) : (
          <SplitDiffViewer
            diff={diff}
            highlightedIds={highlightedIds}
            onLineSelect={onLineSelect}
          />
        )}
      </div>
    </div>
  )
}
