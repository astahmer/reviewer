import { FC, useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Diff, Line, FileDiff } from '~/lib/types'
import { VIRTUAL_LINE_HEIGHT } from '~/lib/constants'
import { DiffLineRenderer } from './diff-line-renderer'

interface SplitDiffViewerProps {
  diff: Diff
  highlightedIds?: Set<string>
  onLineSelect?: (line: Line) => void
  repoPath?: string
}

type RenderItem =
  | { type: 'header'; file: FileDiff; index: number }
  | { type: 'line'; aligned: AlignedLine; index: number }

interface AlignedLine {
  left: Line | null
  right: Line | null
  fileIndex: number
  leftPairedContent?: string
  rightPairedContent?: string
}

const FILE_HEADER_HEIGHT = 40

export const SplitDiffViewer: FC<SplitDiffViewerProps> = ({ diff, highlightedIds = new Set(), onLineSelect, repoPath }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)

  const alignedLines = useMemo((): AlignedLine[] => {
    const result: AlignedLine[] = []
    
    for (const file of diff.files) {
      const fileIndex = file.index
      
      const removeLines: Line[] = []
      const addLines: Line[] = []
      
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'context') {
            result.push({
              left: { ...line, fileIndex },
              right: { ...line, fileIndex },
              fileIndex,
            })
          } else if (line.type === 'remove') {
            removeLines.push({ ...line, fileIndex })
          } else if (line.type === 'add') {
            addLines.push({ ...line, fileIndex })
          }
        }
      }
      
      let removeIdx = 0
      let addIdx = 0
      
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'remove') {
            const pairedContent = addIdx < addLines.length ? addLines[addIdx]?.content : undefined
            result.push({
              left: { ...line, fileIndex },
              right: null,
              fileIndex,
              rightPairedContent: pairedContent,
            })
            removeIdx++
          } else if (line.type === 'add') {
            const pairedContent = removeIdx < removeLines.length ? removeLines[removeIdx]?.content : undefined
            result.push({
              left: null,
              right: { ...line, fileIndex },
              fileIndex,
              leftPairedContent: pairedContent,
            })
            addIdx++
          }
        }
      }
    }
    
    return result
  }, [diff.files])

  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = []
    const linesByFile = new Map<number, AlignedLine[]>()
    
    for (const aligned of alignedLines) {
      const arr = linesByFile.get(aligned.fileIndex) || []
      arr.push(aligned)
      linesByFile.set(aligned.fileIndex, arr)
    }
    
    for (const file of diff.files) {
      items.push({ type: 'header', file, index: items.length })
      
      const fileLines = linesByFile.get(file.index) || []
      for (const aligned of fileLines) {
        items.push({ type: 'line', aligned, index: items.length })
      }
    }
    
    return items
  }, [diff.files, alignedLines])

  const virtualizer = useVirtualizer({
    count: renderItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      return renderItems[index]?.type === 'header' ? FILE_HEADER_HEIGHT : VIRTUAL_LINE_HEIGHT
    },
    overscan: 20,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  useEffect(() => {
    if (containerRef.current) {
      virtualizer.measure()
    }
  }, [virtualizer])

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return

    let isScrolling = false

    const handleLeftScroll = () => {
      if (isScrolling) return
      isScrolling = true
      if (rightRef.current && leftRef.current) {
        rightRef.current.scrollLeft = leftRef.current.scrollLeft
      }
      requestAnimationFrame(() => {
        isScrolling = false
      })
    }

    const handleRightScroll = () => {
      if (isScrolling) return
      isScrolling = true
      if (leftRef.current && rightRef.current) {
        leftRef.current.scrollLeft = rightRef.current.scrollLeft
      }
      requestAnimationFrame(() => {
        isScrolling = false
      })
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

  const getAbsolutePath = (relativePath: string): string => {
    if (!repoPath) return relativePath
    return `${repoPath}/${relativePath}`.replace(/\/+/g, '/')
  }

  const renderFileHeader = (file: FileDiff, side: 'left' | 'right') => (
    <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 flex items-center gap-2 h-10">
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        file.status === 'add' ? 'bg-green-100 text-green-800' :
        file.status === 'remove' ? 'bg-red-100 text-red-800' :
        file.status === 'rename' ? 'bg-blue-100 text-blue-800' :
        'bg-gray-200 text-gray-800'
      }`}>
        {file.status}
      </span>
      <span className="font-mono text-gray-700 truncate">
        {side === 'left' ? (file.oldPath || file.newPath) : file.newPath}
      </span>
    </div>
  )

  const renderEmptyLine = () => (
    <div className="flex h-full bg-gray-50">
      <div className="w-12 bg-gray-100 border-r border-gray-200 flex-shrink-0"></div>
      <div className="flex-1"></div>
    </div>
  )

  const renderLine = (aligned: AlignedLine, side: 'left' | 'right') => {
    const line = side === 'left' ? aligned.left : aligned.right
    const file = diff.files[aligned.fileIndex]
    const filePath = side === 'left' ? file?.oldPath : file?.newPath
    
    if (!line) {
      return renderEmptyLine()
    }

    return (
      <div className="flex h-full">
        <div className="w-12 bg-gray-100 border-r border-gray-200 text-right px-1 py-0.5 select-none flex-shrink-0">
          <span className="text-xs text-gray-500">
            {side === 'left' 
              ? (line.oldLineNumber >= 0 ? line.oldLineNumber : '')
              : (line.newLineNumber >= 0 ? line.newLineNumber : '')
            }
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <DiffLineRenderer
            line={line}
            filePath={filePath ? getAbsolutePath(filePath) : undefined}
            isHighlighted={highlightedIds.has(line.id)}
            onClick={() => onLineSelect?.(line)}
            onHover={setHoveredLine}
            pairedContent={side === 'left' ? aligned.rightPairedContent : aligned.leftPairedContent}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
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

      <div
        ref={containerRef}
        className="flex flex-1 overflow-y-auto overflow-x-hidden gap-px bg-gray-200"
        style={{ contain: 'strict' }}
      >
        <div
          ref={leftRef}
          className="flex-1 overflow-x-auto bg-white"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = renderItems[virtualItem.index]
              if (!item) return null

              if (item.type === 'header') {
                return (
                  <div
                    key={`header-left-${item.file.index}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualItem.start}px)`,
                      height: `${virtualItem.size}px`,
                    }}
                  >
                    {renderFileHeader(item.file, 'left')}
                  </div>
                )
              }

              const aligned = item.aligned

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                    height: `${virtualItem.size}px`,
                  }}
                >
                  {renderLine(aligned, 'left')}
                </div>
              )
            })}
          </div>
        </div>

        <div
          ref={rightRef}
          className="flex-1 overflow-x-auto bg-white"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = renderItems[virtualItem.index]
              if (!item) return null

              if (item.type === 'header') {
                return (
                  <div
                    key={`header-right-${item.file.index}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualItem.start}px)`,
                      height: `${virtualItem.size}px`,
                    }}
                  >
                    {renderFileHeader(item.file, 'right')}
                  </div>
                )
              }

              const aligned = item.aligned

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                    height: `${virtualItem.size}px`,
                  }}
                >
                  {renderLine(aligned, 'right')}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {hoveredLine && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
          Old: Line {hoveredLine.oldLineNumber >= 0 ? hoveredLine.oldLineNumber : '-'} | New: Line {hoveredLine.newLineNumber >= 0 ? hoveredLine.newLineNumber : '-'}
        </div>
      )}
    </div>
  )
}
