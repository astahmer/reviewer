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
  theme: "pierre-dark",
  colorMode: "auto" as const,
} as const;

// Light themes for @pierre/diffs
export const LIGHT_THEMES = [
  "pierre-light",
  "catppuccin-latte",
  "everforest-light",
  "github-light",
  "github-light-default",
  "github-light-high-contrast",
  "gruvbox-light-hard",
  "gruvbox-light-medium",
  "gruvbox-light-soft",
  "kanagawa-lotus",
  "light-plus",
  "material-theme-lighter",
  "min-light",
  "one-light",
  "rose-pine-dawn",
  "slack-ochin",
  "snazzy-light",
  "solarized-light",
  "vitesse-light",
] as const;

// Dark themes for @pierre/diffs
export const DARK_THEMES = [
  "pierre-dark",
  "andromeeda",
  "aurora-x",
  "ayu-dark",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "dark-plus",
  "dracula",
  "dracula-soft",
  "everforest-dark",
  "github-dark",
  "github-dark-default",
  "github-dark-dimmed",
  "github-dark-high-contrast",
  "gruvbox-dark-hard",
  "gruvbox-dark-medium",
  "gruvbox-dark-soft",
  "houston",
  "kanagawa-dragon",
  "kanagawa-wave",
  "laserwave",
  "material-theme",
  "material-theme-darker",
  "material-theme-ocean",
  "material-theme-palenight",
  "min-dark",
  "monokai",
  "night-owl",
  "nord",
  "one-dark-pro",
  "plastic",
  "poimandres",
  "red",
  "rose-pine",
  "rose-pine-moon",
  "slack-dark",
  "solarized-dark",
  "synthwave-84",
  "tokyo-night",
  "vesper",
  "vitesse-black",
  "vitesse-dark",
] as const;

export const AVAILABLE_THEMES = [...LIGHT_THEMES, ...DARK_THEMES] as const;

export type ThemeName = (typeof AVAILABLE_THEMES)[number];
export type ColorMode = "light" | "dark" | "auto";

export const DEFAULT_THEME: ThemeName = "pierre-dark";
