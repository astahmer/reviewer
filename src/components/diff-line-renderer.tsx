import { FC } from 'react'
import { Line } from '~/lib/types'

interface DiffLineRendererProps {
  /**
   * The line to render
   */
  line: Line
  /**
   * Whether this line is highlighted by search
   */
  isHighlighted?: boolean
  /**
   * Callback when line is clicked
   */
  onClick?: (line: Line) => void
  /**
   * Callback when line is hovered
   */
  onHover?: (line: Line | null) => void
  /**
   * File path for opening in VSCode
   */
  filePath?: string
}

/**
 * Renders a single diff line with syntax highlighting placeholder
 * Types: 'add' (green), 'remove' (red), 'context' (neutral)
 * Clicking opens the file in VSCode at the appropriate line
 */
export const DiffLineRenderer: FC<DiffLineRendererProps> = ({ line, isHighlighted, onClick, onHover, filePath }) => {
  const baseClasses =
    'font-mono text-sm px-3 py-0.5 whitespace-pre-wrap break-words hover:bg-opacity-50 transition-colors cursor-pointer'

  const typeClasses = {
    add: 'bg-diff-add bg-opacity-20 text-diff-add border-l-4 border-diff-add',
    remove: 'bg-diff-remove bg-opacity-20 text-diff-remove border-l-4 border-diff-remove',
    context: 'bg-diff-neutral bg-opacity-5 text-diff-neutral border-l-4 border-transparent hover:bg-opacity-10',
  }

  const prefix = {
    add: '+',
    remove: '-',
    context: ' ',
  }

  const handleClick = () => {
    if (filePath) {
      // Determine which line number to use
      const lineNumber = line.type === 'remove' ? line.oldLineNumber : line.newLineNumber
      if (lineNumber >= 0) {
        // Open in VSCode using vscode:// protocol
        // Format: vscode://file/<path>:<line>:<column>
        const vscodeUri = `vscode://file/${filePath}:${lineNumber}:0`
        window.location.href = vscodeUri
        return
      }
    }
    onClick?.(line)
  }

  return (
    <div
      className={`
        ${baseClasses}
        ${typeClasses[line.type]}
        ${isHighlighted ? 'ring-2 ring-yellow-400 ring-opacity-50 rounded' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={() => onHover?.(line)}
      onMouseLeave={() => onHover?.(null)}
      role="button"
      tabIndex={0}
      data-line-id={line.id}
      title={filePath ? `Click to open in VSCode: ${filePath}:${line.type === 'remove' ? line.oldLineNumber : line.newLineNumber}` : undefined}
    >
      <span className="select-none mr-1 text-gray-500">{prefix[line.type]}</span>
      <span className='text-black'>{line.content}</span>
    </div>
  )
}
