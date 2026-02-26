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
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)

  // Create line maps for old/new versions with file tracking
  const oldLines = diff.flatLines.filter((line) => line.oldLineNumber >= 0)
  const newLines = diff.flatLines.filter((line) => line.newLineNumber >= 0)
  const maxLines = Math.max(oldLines.length, newLines.length)

  // Virtualize based on the longer side
  const virtualizer = useVirtualizer({
    count: maxLines,
    getScrollElement: () => containerRef.current,
    estimateSize: () => VIRTUAL_LINE_HEIGHT,
    overscan: 20,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Force virtualizer to re-measure after mount
  useEffect(() => {
    if (containerRef.current) {
      virtualizer.measure()
    }
  }, [virtualizer])

  // Synchronize scroll between left and right (both directions)
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return

    const handleLeftScroll = () => {
      if (rightRef.current) {
        rightRef.current.scrollLeft = leftRef.current?.scrollLeft || 0
      }
    }

    const handleRightScroll = () => {
      if (leftRef.current) {
        leftRef.current.scrollLeft = rightRef.current?.scrollLeft || 0
      }
    }

    const left = leftRef.current
    const right = rightRef.current

    left.addEventListener('scroll', handleLeftScroll)
    right.addEventListener('scroll', handleRightScroll)

    return () => {
      left.removeEventListener('scroll', handleLeftScroll)
      right.removeEventListener('scroll', handleRightScroll)
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with commit info */}
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

      {/* Split view container with synchronized vertical scrolling */}
      <div
        ref={containerRef}
        className="flex flex-1 overflow-y-auto overflow-x-hidden gap-px bg-gray-200"
        style={{
          contain: 'strict',
        }}
      >
        {/* Old version (left) */}
        <div
          ref={leftRef}
          className="flex-1 overflow-x-auto bg-white"
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
              const oldLine = oldLines[virtualItem.index]
              const newLine = newLines[virtualItem.index]

              // Determine which file to display header for
              const oldFile = oldLine ? diff.files[oldLine.fileIndex] : null
              const newFile = newLine ? diff.files[newLine.fileIndex] : null
              const currentFile = oldFile || newFile

              // Check if this is a new file (file changed from previous line)
              const prevOldLine = virtualItem.index > 0 ? oldLines[virtualItem.index - 1] : null
              const prevNewLine = virtualItem.index > 0 ? newLines[virtualItem.index - 1] : null
              const prevOldFile = prevOldLine ? diff.files[prevOldLine.fileIndex] : null
              const prevNewFile = prevNewLine ? diff.files[prevNewLine.fileIndex] : null

              const isNewFile = !prevOldFile || !prevNewFile ||
                                (oldFile && oldFile.index !== prevOldFile.index) ||
                                (newFile && newFile.index !== prevNewFile.index)

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {isNewFile && currentFile && (
                    <div className="relative px-4 py-2 bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 sticky top-0 z-10 flex items-center gap-2">
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
                  )}
                  <div
                    style={{
                      height: `${virtualItem.size}px`,
                    }}
                  >
                    {oldLine ? (
                      <div className="flex h-full">
                        <div className="w-12 bg-gray-100 border-r border-gray-200 text-right px-2 py-0.5 select-none">
                          <span className="text-xs text-gray-500">{oldLine.oldLineNumber >= 0 ? oldLine.oldLineNumber : ''}</span>
                        </div>
                        <div className="flex-1">
                          <DiffLineRenderer
                            line={oldLine}
                            isHighlighted={highlightedIds.has(oldLine.id)}
                            onClick={() => onLineSelect?.(oldLine)}
                            onHover={setHoveredLine}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full">
                        <div className="w-12 bg-gray-100 border-r border-gray-200"></div>
                        <div className="flex-1 bg-gray-50"></div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* New version (right) */}
        <div
          ref={rightRef}
          className="flex-1 overflow-x-auto bg-white"
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
              const oldLine = oldLines[virtualItem.index]
              const newLine = newLines[virtualItem.index]

              // Determine which file to display header for
              const oldFile = oldLine ? diff.files[oldLine.fileIndex] : null
              const newFile = newLine ? diff.files[newLine.fileIndex] : null
              const currentFile = oldFile || newFile

              // Check if this is a new file (file changed from previous line)
              const prevOldLine = virtualItem.index > 0 ? oldLines[virtualItem.index - 1] : null
              const prevNewLine = virtualItem.index > 0 ? newLines[virtualItem.index - 1] : null
              const prevOldFile = prevOldLine ? diff.files[prevOldLine.fileIndex] : null
              const prevNewFile = prevNewLine ? diff.files[prevNewLine.fileIndex] : null

              const isNewFile = !prevOldFile || !prevNewFile ||
                                (oldFile && oldFile.index !== prevOldFile.index) ||
                                (newFile && newFile.index !== prevNewFile.index)

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {isNewFile && currentFile && (
                    <div className="relative px-4 py-2 bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 sticky top-0 z-10 flex items-center gap-2">
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
                  )}
                  <div
                    style={{
                      height: `${virtualItem.size}px`,
                    }}
                  >
                    {newLine ? (
                      <div className="flex h-full">
                        <div className="w-12 bg-gray-100 border-r border-gray-200 text-right px-2 py-0.5 select-none">
                          <span className="text-xs text-gray-500">{newLine.newLineNumber >= 0 ? newLine.newLineNumber : ''}</span>
                        </div>
                        <div className="flex-1">
                          <DiffLineRenderer
                            line={newLine}
                            isHighlighted={highlightedIds.has(newLine.id)}
                            onClick={() => onLineSelect?.(newLine)}
                            onHover={setHoveredLine}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full">
                        <div className="w-12 bg-gray-100 border-r border-gray-200"></div>
                        <div className="flex-1 bg-gray-50"></div>
                      </div>
                    )}
                  </div>
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
