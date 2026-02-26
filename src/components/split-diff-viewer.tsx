import { FC, useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Diff, Line } from '~/lib/types'
import { VIRTUAL_LINE_HEIGHT } from '~/lib/constants'
import { DiffLineRenderer } from './diff-line-renderer'

interface SplitDiffViewerProps {
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
 * Split diff viewer with synchronized scrolling
 * Shows old (left) and new (right) versions side by side
 * Lines are synchronized horizontally; vertical scroll is also synchronized
 */
export const SplitDiffViewer: FC<SplitDiffViewerProps> = ({ diff, highlightedIds = new Set(), onLineSelect }) => {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)

  // Create line maps for old/new versions
  const oldLines = diff.flatLines.filter((line) => line.oldLineNumber >= 0)
  const newLines = diff.flatLines.filter((line) => line.newLineNumber >= 0)
  const maxLines = Math.max(oldLines.length, newLines.length)

  // Virtualize based on the longer side
  const virtualizer = useVirtualizer({
    count: maxLines,
    getScrollElement: () => leftRef.current,
    estimateSize: () => VIRTUAL_LINE_HEIGHT,
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1 ? undefined : () => VIRTUAL_LINE_HEIGHT,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Synchronize scroll between left and right
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return

    const handleScroll = (e: Event) => {
      const source = e.target as HTMLElement
      const target = source === leftRef.current ? rightRef.current : leftRef.current
      if (target) {
        target.scrollTop = source.scrollTop
        target.scrollLeft = source.scrollLeft
      }
    }

    const left = leftRef.current
    const right = rightRef.current

    left.addEventListener('scroll', handleScroll)
    right.addEventListener('scroll', handleScroll)

    return () => {
      left.removeEventListener('scroll', handleScroll)
      right.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with file info */}
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">Before</h3>
          <p className="text-xs text-gray-500">{diff.from}</p>
        </div>
        <div className="w-px h-6 bg-gray-300"></div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">After</h3>
          <p className="text-xs text-gray-500">{diff.to}</p>
        </div>
      </div>

      {/* Split view container */}
      <div className="flex flex-1 overflow-hidden gap-px bg-gray-200">
        {/* Old version (left) */}
        <div
          ref={leftRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-white"
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
              const line = oldLines[virtualItem.index]

              return (
                <div
                  key={`old-${virtualItem.key}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {line ? (
                    <DiffLineRenderer
                      line={line}
                      isHighlighted={highlightedIds.has(line.id)}
                      onClick={() => onLineSelect?.(line)}
                      onHover={setHoveredLine}
                    />
                  ) : (
                    <div className="h-full bg-gray-50 border-l-4 border-transparent"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* New version (right) */}
        <div
          ref={rightRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-white"
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
              const line = newLines[virtualItem.index]

              return (
                <div
                  key={`new-${virtualItem.key}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {line ? (
                    <DiffLineRenderer
                      line={line}
                      isHighlighted={highlightedIds.has(line.id)}
                      onClick={() => onLineSelect?.(line)}
                      onHover={setHoveredLine}
                    />
                  ) : (
                    <div className="h-full bg-gray-50 border-l-4 border-transparent"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer with hovered line info */}
      {hoveredLine && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
          Old: Line {hoveredLine.oldLineNumber >= 0 ? hoveredLine.oldLineNumber : '-'} | New: Line {hoveredLine.newLineNumber >= 0 ? hoveredLine.newLineNumber : '-'}
        </div>
      )}
    </div>
  )
}
