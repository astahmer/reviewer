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
}

/**
 * Renders a single diff line with syntax highlighting placeholder
 * Types: 'add' (green), 'remove' (red), 'context' (neutral)
 */
export const DiffLineRenderer: FC<DiffLineRendererProps> = ({ line, isHighlighted, onClick, onHover }) => {
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

  return (
    <div
      className={`
        ${baseClasses}
        ${typeClasses[line.type]}
        ${isHighlighted ? 'ring-2 ring-yellow-400 ring-opacity-50 rounded' : ''}
      `}
      onClick={() => onClick?.(line)}
      onMouseEnter={() => onHover?.(line)}
      onMouseLeave={() => onHover?.(null)}
      role="button"
      tabIndex={0}
      data-line-id={line.id}
    >
      <span className="select-none mr-1 text-gray-500">{prefix[line.type]}</span>
      <span className='text-black'>{line.content}</span>
    </div>
  )
}
