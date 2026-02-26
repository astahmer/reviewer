import { FC, useRef, useState } from 'react'
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
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1 ? undefined : () => VIRTUAL_LINE_HEIGHT,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

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

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <DiffLineRenderer
                  line={line}
                  isHighlighted={highlightedIds.has(line.id)}
                  onClick={() => onLineSelect?.(line)}
                  onHover={setHoveredLine}
                />
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
