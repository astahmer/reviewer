import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook for managing roving focus (only one element in a list is focusable at a time)
 * Keyboard navigation: arrow keys to move focus, enter to activate
 * Improves accessibility for lists without jeopardizing performance
 */
export function useRovingFocus<T extends HTMLElement>(items: (T | null)[], onSelect?: (index: number) => void) {
  const currentIndexRef = useRef(0)

  const moveFocus = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, items.length - 1))
      const element = items[nextIndex]

      if (element) {
        element.focus()
        currentIndexRef.current = nextIndex
        onSelect?.(nextIndex)
      }
    },
    [items, onSelect],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const currentIndex = currentIndexRef.current

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          moveFocus(currentIndex + 1)
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus(currentIndex - 1)
          break
        case 'Home':
          e.preventDefault()
          moveFocus(0)
          break
        case 'End':
          e.preventDefault()
          moveFocus(items.length - 1)
          break
        default:
          break
      }
    },
    [moveFocus, items.length],
  )

  useEffect(() => {
    const currentItem = items[currentIndexRef.current]
    if (currentItem) {
      currentItem.addEventListener('keydown', handleKeyDown)
      return () => currentItem.removeEventListener('keydown', handleKeyDown)
    }
  }, [items, handleKeyDown])

  return {
    moveFocus,
    currentIndex: currentIndexRef.current,
  }
}
