/**
 * Constants for the diff reviewer app
 */

/** Fixed line height in pixels for virtual scrolling */
export const VIRTUAL_LINE_HEIGHT = 20

/** Debounce duration for search input (ms) */
export const SEARCH_DEBOUNCE_MS = 200

/** Max timeout for git diff command (ms) */
export const GIT_DIFF_TIMEOUT_MS = 30000

/** Max timeout for diff parsing (ms) */
export const PARSE_DIFF_TIMEOUT_MS = 10000

/** Line colors for diff display */
export const LINE_COLORS = {
  add: '#d4edda',
  remove: '#f8d7da',
  context: '#f8f9fa',
  addBorder: '#c3e6cb',
  removeBorder: '#f5c6cb',
  contextBorder: '#dee2e6',
}

/** Line text colors */
export const LINE_TEXT_COLORS = {
  add: '#155724',
  remove: '#721c24',
  context: '#495057',
}

/** Default user preferences */
export const DEFAULT_PREFERENCES = {
  viewMode: 'split' as const,
  ignoreWhitespace: false,
  searchHistory: [] as string[],
}

/** Storage keys */
export const STORAGE_KEYS = {
  preferences: 'reviewer:preferences',
  searchHistory: 'reviewer:searchHistory',
  recentDiffs: 'reviewer:recentDiffs',
}
