import { FC, useMemo } from 'react'
import { Line } from '~/lib/types'

interface DiffLineRendererProps {
  line: Line
  isHighlighted?: boolean
  onClick?: (line: Line) => void
  onHover?: (line: Line | null) => void
  filePath?: string
  pairedContent?: string
}

function computeCharDiff(oldText: string, newText: string): { char: string; type: 'same' | 'add' | 'remove' }[] {
  const oldChars = oldText.split('')
  const newChars = newText.split('')
  
  const result: { char: string; type: 'same' | 'add' | 'remove' }[] = []
  
  let oldIdx = 0
  let newIdx = 0
  
  while (oldIdx < oldChars.length || newIdx < newChars.length) {
    if (oldIdx >= oldChars.length) {
      result.push({ char: newChars[newIdx], type: 'add' })
      newIdx++
    } else if (newIdx >= newChars.length) {
      result.push({ char: oldChars[oldIdx], type: 'remove' })
      oldIdx++
    } else if (oldChars[oldIdx] === newChars[newIdx]) {
      result.push({ char: oldChars[oldIdx], type: 'same' })
      oldIdx++
      newIdx++
    } else {
      let foundMatch = false
      for (let lookAhead = 1; lookAhead <= 3 && !foundMatch; lookAhead++) {
        if (oldIdx + lookAhead < oldChars.length && 
            newChars[newIdx] === oldChars[oldIdx + lookAhead]) {
          for (let i = 0; i < lookAhead; i++) {
            result.push({ char: oldChars[oldIdx + i], type: 'remove' })
          }
          oldIdx += lookAhead
          foundMatch = true
        }
        if (newIdx + lookAhead < newChars.length && 
            oldChars[oldIdx] === newChars[newIdx + lookAhead]) {
          for (let i = 0; i < lookAhead; i++) {
            result.push({ char: newChars[newIdx + i], type: 'add' })
          }
          newIdx += lookAhead
          foundMatch = true
        }
      }
      if (!foundMatch) {
        result.push({ char: oldChars[oldIdx], type: 'remove' })
        result.push({ char: newChars[newIdx], type: 'add' })
        oldIdx++
        newIdx++
      }
    }
  }
  
  return result
}

export const DiffLineRenderer: FC<DiffLineRendererProps> = ({ 
  line, 
  isHighlighted, 
  onClick, 
  onHover, 
  filePath,
  pairedContent 
}) => {
  const prefix = {
    add: '+',
    remove: '-',
    context: ' ',
  }

  const typeStyles = {
    add: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-500',
      highlightBg: 'bg-green-200',
      charBg: 'bg-green-300',
    },
    remove: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-500',
      highlightBg: 'bg-red-200',
      charBg: 'bg-red-300',
    },
    context: {
      bg: 'bg-white',
      text: 'text-gray-700',
      border: 'border-transparent',
      highlightBg: 'bg-gray-200',
      charBg: '',
    },
  }

  const style = typeStyles[line.type]

  const charDiff = useMemo(() => {
    if (!pairedContent || line.type === 'context') return null
    return computeCharDiff(pairedContent, line.content)
  }, [pairedContent, line.content, line.type])

  const handleClick = () => {
    if (filePath) {
      const lineNumber = line.type === 'remove' ? line.oldLineNumber : line.newLineNumber
      if (lineNumber >= 0) {
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
        font-mono text-sm px-3 py-0.5 whitespace-pre-wrap break-words 
        hover:bg-opacity-50 transition-colors cursor-pointer
        flex
        ${style.bg} ${style.text} border-l-4 ${style.border}
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
      <span className="select-none mr-2 text-gray-400 w-4 flex-shrink-0">{prefix[line.type]}</span>
      <span className="flex-1">
        {charDiff ? (
          charDiff.map((item, idx) => (
            <span
              key={idx}
              className={`
                ${item.type === 'add' ? `${style.charBg} font-bold text-green-900` : ''}
                ${item.type === 'remove' ? `${style.charBg} font-bold text-red-900` : ''}
              `}
            >
              {item.char}
            </span>
          ))
        ) : (
          <span>{line.content}</span>
        )}
      </span>
    </div>
  )
}
