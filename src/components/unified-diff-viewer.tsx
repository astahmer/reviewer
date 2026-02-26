import { FC, useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Diff, Line } from '~/lib/types'
import { VIRTUAL_LINE_HEIGHT } from '~/lib/constants'
import { DiffLineRenderer } from './diff-line-renderer'

interface UnifiedDiffViewerProps {
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
}

/**
 * Unified diff viewer with virtual scrolling support
 * Shows add, remove, and context lines in a single view
 * Uses @tanstack/react-virtual for efficient rendering of large diffs
 */
export const UnifiedDiffViewer: FC<UnifiedDiffViewerProps> = ({ diff, highlightedIds = new Set(), onLineSelect }) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)

  const virtualizer = useVirtualizer({
    count: diff.flatLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_LINE_HEIGHT,
    overscan: 20,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Force virtualizer to re-measure after mount
  useEffect(() => {
    if (parentRef.current) {
      virtualizer.measure()
    }
  }, [virtualizer])

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with file info */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-sm">
          {diff.from === diff.to ? `${diff.from}` : `${diff.from} → ${diff.to}`}
        </h3>
        <span className="ml-auto text-xs text-gray-500">
          {diff.files.length} file{diff.files.length !== 1 ? 's' : ''} • {diff.flatLines.length} lines
        </span>
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const line = diff.flatLines[virtualItem.index]
            if (!line) return null

            const prevLine = virtualItem.index > 0 ? diff.flatLines[virtualItem.index - 1] : null
            const currentFile = diff.files[line.fileIndex]
            const prevFile = prevLine ? diff.files[prevLine.fileIndex] : null
            const isNewFile = !prevFile || prevFile.index !== currentFile.index

            return (
              <div key={virtualItem.key}>
                {/* File header - static, no sticky positioning to avoid flickering */}
                {isNewFile && (
                  <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        currentFile.status === 'add' ? 'bg-green-100 text-green-800' :
                        currentFile.status === 'remove' ? 'bg-red-100 text-red-800' :
                        currentFile.status === 'rename' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-200 text-gray-800'
                      }`}>
                        {currentFile.status}
                      </span>
                      {currentFile.oldPath === currentFile.newPath ? (
                        <span className="font-mono">{currentFile.newPath}</span>
                      ) : (
                        <>
                          <span className="font-mono text-gray-600">{currentFile.oldPath}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-mono">{currentFile.newPath}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Line with line numbers */}
                <div
                  data-index={virtualItem.index}
                  style={{
                    height: `${virtualItem.size}px`,
                  }}
                  className="flex"
                >
                  <div className="w-12 bg-gray-100 border-r border-gray-200 text-right px-2 py-0.5 select-none flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {line.type === 'remove' && line.oldLineNumber >= 0 ? line.oldLineNumber :
                       line.type === 'add' && line.newLineNumber >= 0 ? line.newLineNumber :
                       (line.oldLineNumber >= 0 ? line.oldLineNumber : line.newLineNumber >= 0 ? line.newLineNumber : '')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <DiffLineRenderer
                      line={line}
                      filePath={line.type === 'remove' ? currentFile.oldPath : currentFile.newPath}
                      isHighlighted={highlightedIds.has(line.id)}
                      onClick={() => onLineSelect?.(line)}
                      onHover={setHoveredLine}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer with hovered line info */}
      {hoveredLine && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
          Line {hoveredLine.oldLineNumber >= 0 ? hoveredLine.oldLineNumber : '-'} / {hoveredLine.newLineNumber >= 0 ? hoveredLine.newLineNumber : '-'}
        </div>
      )}
    </div>
  )
}
