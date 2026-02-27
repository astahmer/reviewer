/**
 * Application-wide constants
 */

// Timing constants
export const PARSE_DIFF_TIMEOUT_MS = 30000;
export const GIT_DIFF_TIMEOUT_MS = 30000;
export const SEARCH_DEBOUNCE_MS = 300;

// Storage keys
export const STORAGE_KEYS = {
  preferences: "app:preferences",
  searchHistory: "app:searchHistory",
  selectedRepo: "app:selectedRepo",
  customPaths: "app:customPaths",
} as const;

// Default preferences
export const DEFAULT_PREFERENCES = {
  viewMode: "unified" as const,
  ignoreWhitespace: false,
  searchHistory: [],
} as const;

// @pierre/diffs theme configuration
export const AVAILABLE_THEMES = [
  "pierre-dark",
  "pierre-light",
  "github-dark",
  "github-light",
  "dracula",
  "catppuccin-mocha",
  "gruvbox-dark-hard",
  "nord",
  "tokyo-night",
  "ayu-dark",
  "ayu-light",
  "vitesse-dark",
  "vitesse-light",
] as const;

export type ThemeName = (typeof AVAILABLE_THEMES)[number];

export const DEFAULT_THEME: ThemeName = "pierre-dark";
