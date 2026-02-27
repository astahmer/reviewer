import { FC, useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Diff, Line, FileDiff } from '~/lib/types'
import { VIRTUAL_LINE_HEIGHT } from '~/lib/constants'
import { DiffLineRenderer } from './diff-line-renderer'

interface UnifiedDiffViewerProps {
  diff: Diff
  highlightedIds?: Set<string>
  onLineSelect?: (line: Line) => void
  repoPath?: string
  wordWrap?: boolean
}

type RenderItem =
  | { type: 'header'; file: FileDiff }
  | { type: 'line'; line: Line; file: FileDiff }

const FILE_HEADER_HEIGHT = 40

export const UnifiedDiffViewer: FC<UnifiedDiffViewerProps> = ({ diff, highlightedIds = new Set(), onLineSelect, repoPath, wordWrap = true }) => {
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const getAbsolutePath = (relativePath: string): string => {
    if (!repoPath) return relativePath
    return `${repoPath}/${relativePath}`.replace(/\/+/g, '/')
  }

  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = []

    for (const file of diff.files) {
      items.push({ type: 'header', file })

      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          items.push({ type: 'line', line, file })
        }
      }
    }

    return items
  }, [diff.files])

  const virtualizer = useVirtualizer({
    count: renderItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      return renderItems[index]?.type === 'header' ? FILE_HEADER_HEIGHT : VIRTUAL_LINE_HEIGHT
    },
    overscan: 20,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
        <h3 className="font-semibold text-sm">
          {diff.from === diff.to ? `${diff.from}` : `${diff.from} → ${diff.to}`}
        </h3>
        <span className="ml-auto text-xs text-gray-500">
          {diff.files.length} file{diff.files.length !== 1 ? 's' : ''} • {diff.flatLines.length} lines
        </span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: `${totalSize}px`, width: '100%', position: 'relative' }}>
          {virtualItems.map((virtualItem) => {
            const item = renderItems[virtualItem.index]
            if (!item) return null

            if (item.type === 'header') {
              const file = item.file
              return (
                <div
                  key={`header-${file.index}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                    height: `${virtualItem.size}px`,
                  }}
                  className="px-4 py-2 bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 flex items-center gap-2 font-mono sticky top-0 z-10"
                >
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    file.status === 'add' ? 'bg-green-100 text-green-800' :
                    file.status === 'remove' ? 'bg-red-100 text-red-800' :
                    file.status === 'rename' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {file.status}
                  </span>
                  {file.oldPath === file.newPath ? (
                    <span className="font-mono">{file.newPath}</span>
                  ) : (
                    <>
                      <span className="font-mono text-gray-600">{file.oldPath}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-mono">{file.newPath}</span>
                    </>
                  )}
                </div>
              )
            }

            const line = item.line
            const file = item.file

            return (
              <div
                key={line.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualItem.start}px)`,
                  height: `${virtualItem.size}px`,
                }}
                className="flex"
              >
                <div className="w-12 bg-gray-50 border-r border-gray-200 text-right px-2 py-0.5 select-none flex-shrink-0">
                  <span className="text-xs text-gray-500">
                    {line.type === 'remove' && line.oldLineNumber >= 0 ? line.oldLineNumber :
                     line.type === 'add' && line.newLineNumber >= 0 ? line.newLineNumber :
                     (line.oldLineNumber >= 0 ? line.oldLineNumber : line.newLineNumber >= 0 ? line.newLineNumber : '')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <DiffLineRenderer
                    line={line}
                    filePath={getAbsolutePath(line.type === 'remove' ? file.oldPath : file.newPath)}
                    isHighlighted={highlightedIds.has(line.id)}
                    onClick={() => onLineSelect?.(line)}
                    onHover={setHoveredLine}
                    wordWrap={wordWrap}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {hoveredLine && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 shrink-0">
          Line {hoveredLine.oldLineNumber >= 0 ? hoveredLine.oldLineNumber : '-'} / {hoveredLine.newLineNumber >= 0 ? hoveredLine.newLineNumber : '-'}
        </div>
      )}
    </div>
  )
}
