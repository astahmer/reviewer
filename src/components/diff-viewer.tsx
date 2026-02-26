import { FC, useState, useEffect, useMemo } from 'react'
import { Diff, Line } from '~/lib/types'
import { UnifiedDiffViewer } from './unified-diff-viewer'
import { SplitDiffViewer } from './split-diff-viewer'

type ViewMode = 'unified' | 'split'

const VIEW_MODE_KEY = 'diffViewMode'

interface DiffViewerProps {
  diff: Diff
  highlightedIds?: Set<string>
  onLineSelect?: (line: Line) => void
  defaultMode?: ViewMode
  repoPath?: string
}

export const DiffViewer: FC<DiffViewerProps> = ({ diff, highlightedIds, onLineSelect, defaultMode = 'unified', repoPath }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return (saved as ViewMode) || defaultMode
  })
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  const filteredDiff = useMemo(() => {
    if (!searchQuery) return diff

    const query = searchQuery.toLowerCase()
    return {
      ...diff,
      flatLines: diff.flatLines.filter((line) => {
        return line.content.toLowerCase().includes(query)
      }),
      files: diff.files.map((file) => ({
        ...file,
        hunks: file.hunks.map((hunk) => ({
          ...hunk,
          lines: hunk.lines.filter((line) => {
            return line.content.toLowerCase().includes(query)
          }),
        })).filter((hunk) => hunk.lines.length > 0),
      })).filter((file) => file.hunks.length > 0),
    }
  }, [diff, searchQuery])

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
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search in diff..."
          className="flex-1 min-w-[200px] rounded border border-gray-300 px-3 py-2 text-sm"
        />

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

      {searchQuery && (
        <div className="text-sm text-gray-600">
          Showing {filteredDiff.flatLines.length} of {diff.flatLines.length} lines
        </div>
      )}

      <div className="flex-1 min-h-0">
        {viewMode === 'unified' ? (
          <UnifiedDiffViewer
            diff={filteredDiff}
            highlightedIds={highlightedLineIds}
            onLineSelect={onLineSelect}
            repoPath={repoPath}
          />
        ) : (
          <SplitDiffViewer
            diff={filteredDiff}
            highlightedIds={highlightedLineIds}
            onLineSelect={onLineSelect}
            repoPath={repoPath}
          />
        )}
      </div>
    </div>
  )
}
