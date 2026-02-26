import { FC, useState, useMemo, useRef, useEffect } from 'react'
import { Diff, Line, FileDiff } from '~/lib/types'
import { DiffLineRenderer } from './diff-line-renderer'

interface SplitDiffViewerProps {
  diff: Diff
  highlightedIds?: Set<string>
  onLineSelect?: (line: Line) => void
  repoPath?: string
  wordWrap?: boolean
}

interface AlignedLine {
  left: Line | null
  right: Line | null
  fileIndex: number
  leftPairedContent?: string
  rightPairedContent?: string
}

export const SplitDiffViewer: FC<SplitDiffViewerProps> = ({ diff, highlightedIds = new Set(), onLineSelect, repoPath, wordWrap = true }) => {
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const rightPaneRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const leftPane = leftPaneRef.current
    const rightPane = rightPaneRef.current
    if (!leftPane || !rightPane) return

    let isSyncing = false

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncing) return
      isSyncing = true
      target.scrollTop = source.scrollTop
      setTimeout(() => { isSyncing = false }, 10)
    }

    const handleLeftScroll = () => syncScroll(leftPane, rightPane)
    const handleRightScroll = () => syncScroll(rightPane, leftPane)

    leftPane.addEventListener('scroll', handleLeftScroll, { passive: true })
    rightPane.addEventListener('scroll', handleRightScroll, { passive: true })

    return () => {
      leftPane.removeEventListener('scroll', handleLeftScroll)
      rightPane.removeEventListener('scroll', handleRightScroll)
    }
  }, [])

  const getAbsolutePath = (relativePath: string): string => {
    if (!repoPath) return relativePath
    return `${repoPath}/${relativePath}`.replace(/\/+/g, '/')
  }

  const renderFileHeader = (file: FileDiff, side: 'left' | 'right') => (
    <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 flex items-center gap-2 font-mono sticky top-0 z-10 shrink-0">
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        file.status === 'add' ? 'bg-green-100 text-green-800' :
        file.status === 'remove' ? 'bg-red-100 text-red-800' :
        file.status === 'rename' ? 'bg-blue-100 text-blue-800' :
        'bg-gray-200 text-gray-800'
      }`}>
        {file.status}
      </span>
      <span className="truncate">
        {side === 'left' ? (file.oldPath || file.newPath) : file.newPath}
      </span>
    </div>
  )

  const renderEmptyLine = () => (
    <div className="flex h-5">
      <div className="w-12 bg-gray-50 border-r border-gray-200 flex-shrink-0"></div>
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
      <div className="flex shrink-0">
        <div className="w-12 bg-gray-50 border-r border-gray-200 text-right px-1 py-0.5 select-none flex-shrink-0">
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
            wordWrap={wordWrap}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
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

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          ref={leftPaneRef}
          className={`flex-1 overflow-auto ${!wordWrap ? 'max-w-[50%]' : ''}`}
        >
          <div className={!wordWrap ? 'min-w-max' : ''}>
            {diff.files.map((file) => (
              <div key={`left-${file.index}`}>
                {renderFileHeader(file, 'left')}
                {alignedLines.filter(a => a.fileIndex === file.index).map((aligned, idx) => (
                  <div key={`left-line-${file.index}-${idx}`}>
                    {renderLine(aligned, 'left')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="w-px bg-gray-300 shrink-0"></div>

        <div
          ref={rightPaneRef}
          className={`flex-1 overflow-auto ${!wordWrap ? 'max-w-[50%]' : ''}`}
        >
          <div className={!wordWrap ? 'min-w-max' : ''}>
            {diff.files.map((file) => (
              <div key={`right-${file.index}`}>
                {renderFileHeader(file, 'right')}
                {alignedLines.filter(a => a.fileIndex === file.index).map((aligned, idx) => (
                  <div key={`right-line-${file.index}-${idx}`}>
                    {renderLine(aligned, 'right')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hoveredLine && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 shrink-0 absolute bottom-0 left-0">
          Old: Line {hoveredLine.oldLineNumber >= 0 ? hoveredLine.oldLineNumber : '-'} | New: Line {hoveredLine.newLineNumber >= 0 ? hoveredLine.newLineNumber : '-'}
        </div>
      )}
    </div>
  )
}
