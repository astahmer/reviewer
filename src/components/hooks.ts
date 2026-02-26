import { useState, useCallback, useEffect } from 'react'
import { SEARCH_DEBOUNCE_MS, DEFAULT_PREFERENCES, STORAGE_KEYS } from '~/lib/constants'
import { UserPreferences } from '~/lib/types'

/**
 * Hook to manage user preferences with localStorage persistence
 */
export function useUserPreferences(): [UserPreferences, (prefs: Partial<UserPreferences>) => void] {
  const [prefs, setPrefs] = useState<UserPreferences>(() => {
    // Load from localStorage
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.preferences) : null
    return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES
  })

  const updatePrefs = useCallback((update: Partial<UserPreferences>) => {
    setPrefs((current) => {
      const updated = { ...current, ...update }
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(updated))
      }
      return updated
    })
  }, [])

  return [prefs, updatePrefs]
}

/**
 * Hook for debounced search input
 */
export function useDebouncedSearch(
  initialValue: string = '',
): [string, string, (value: string) => void] {
  const [input, setInput] = useState(initialValue)
  const [debouncedValue, setDebouncedValue] = useState(initialValue)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(input)
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [input])

  return [input, debouncedValue, setInput]
}

/**
 * Hook to manage search history
 */
export function useSearchHistory(): [string[], (query: string) => void] {
  const [history, setHistory] = useState<string[]>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.searchHistory) : null
    return stored ? JSON.parse(stored) : []
  })

  const addToHistory = useCallback((query: string) => {
    setHistory((current) => {
      const updated = [query, ...current.filter((q) => q !== query)].slice(0, 10)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(updated))
      }
      return updated
    })
  }, [])

  return [history, addToHistory]
}
