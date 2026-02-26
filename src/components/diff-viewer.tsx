import { FC, useState, useEffect, useMemo } from 'react'
import { Diff, Line } from '~/lib/types'
import { UnifiedDiffViewer } from './unified-diff-viewer'
import { SplitDiffViewer } from './split-diff-viewer'

type ViewMode = 'unified' | 'split'

const VIEW_MODE_KEY = 'diffViewMode'

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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return (saved as ViewMode) || defaultMode
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'add' | 'remove' | 'context'>('all')

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  const filteredDiff = useMemo(() => {
    if (!searchQuery && filterType === 'all') return diff

    const query = searchQuery.toLowerCase()
    return {
      ...diff,
      flatLines: diff.flatLines.filter((line) => {
        const matchesType = filterType === 'all' || line.type === filterType
        const matchesSearch = !query || line.content.toLowerCase().includes(query)
        return matchesType && matchesSearch
      }),
      files: diff.files.map((file) => ({
        ...file,
        hunks: file.hunks.map((hunk) => ({
          ...hunk,
          lines: hunk.lines.filter((line) => {
            const matchesType = filterType === 'all' || line.type === filterType
            const matchesSearch = !query || line.content.toLowerCase().includes(query)
            return matchesType && matchesSearch
          }),
        })).filter((hunk) => hunk.lines.length > 0),
      })).filter((file) => file.hunks.length > 0),
    }
  }, [diff, searchQuery, filterType])
  console.log(filteredDiff)

  const highlightedLineIds = useMemo(() => {
    if (!searchQuery) return highlightedIds || new Set<string>()
    const ids = new Set<string>()
    const query = searchQuery.toLowerCase()
    diff.flatLines.forEach((line) => {
      if (line.content.toLowerCase().includes(query)) {
        ids.add(line.id)
      }
    })
    return ids
  }, [diff.flatLines, searchQuery, highlightedIds])

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Controls row */}
      <div className="flex gap-2 flex-wrap">
        {/* Search input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search in diff..."
          className="flex-1 min-w-[200px] rounded border border-gray-300 px-3 py-2 text-sm"
        />

        {/* Filter by type */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All lines</option>
          <option value="add">Added only</option>
          <option value="remove">Removed only</option>
          <option value="context">Context only</option>
        </select>

        {/* View mode toggle */}
        <button
          onClick={() => setViewMode('unified')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            viewMode === 'unified'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Unified
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            viewMode === 'split'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Split
        </button>
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-sm text-gray-600">
          Showing {filteredDiff.flatLines.length} of {diff.flatLines.length} lines
        </div>
      )}

      {/* Viewer */}
      <div className="flex-1 min-h-0">
        {viewMode === 'unified' ? (
          <UnifiedDiffViewer
            diff={filteredDiff}
            highlightedIds={highlightedLineIds}
            onLineSelect={onLineSelect}
          />
        ) : (
          <SplitDiffViewer
            diff={filteredDiff}
            highlightedIds={highlightedLineIds}
            onLineSelect={onLineSelect}
          />
        )}
      </div>
    </div>
  )
}
