import { useState, useEffect } from "react";
import {
  SEARCH_DEBOUNCE_MS,
  DEFAULT_PREFERENCES,
  STORAGE_KEYS,
  DEFAULT_THEME,
} from "~/lib/constants";
import { UserPreferences, Line } from "~/lib/types";
import type { ColorMode } from "~/lib/constants";

/**
 * Generic hook for localStorage persistence
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const updateValue = (newValue: T) => {
    setValue(newValue);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // Silently fail if localStorage is unavailable
      }
    }
  };

  return [value, updateValue];
}

/**
 * Hook to manage user preferences with localStorage persistence
 */
export function useUserPreferences(): [UserPreferences, (prefs: Partial<UserPreferences>) => void] {
  const [storedPrefs, setStoredPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updatePrefs = (update: Partial<UserPreferences>) => {
    setStoredPrefs({ ...storedPrefs, ...update });
  };

  return [storedPrefs, updatePrefs];
}

/**
 * Hook for debounced search input
 */
export function useDebouncedSearch(
  initialValue: string = "",
): [string, string, (value: string) => void] {
  const [input, setInput] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(input);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input]);

  return [input, debouncedValue, setInput];
}

/**
 * Hook to manage search history
 */
export function useSearchHistory(): [string[], (query: string) => void] {
  const [history, setHistory] = useLocalStorage<string[]>(STORAGE_KEYS.searchHistory, []);

  const addToHistory = (query: string) => {
    setHistory([query, ...history.filter((q) => q !== query)].slice(0, 10));
  };

  return [history, addToHistory];
}

/**
 * Hook to manage selected line in the diff viewer
 */
export function useSelectedLine(): [Line | null, (line: Line | null) => void] {
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);

  return [selectedLine, setSelectedLine];
}

/**
 * Hook to manage view mode preference
 */
export function useViewMode(): ["unified" | "split", (mode: "unified" | "split") => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateViewMode = (mode: "unified" | "split") => {
    setPrefs({ ...prefs, viewMode: mode });
  };

  return [prefs.viewMode, updateViewMode];
}
/**
 * Hook to manage theme preference
 */
export function useTheme(): [string, (theme: string) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateTheme = (newTheme: string) => {
    setPrefs({ ...prefs, theme: newTheme });
  };

  return [prefs.theme || DEFAULT_THEME, updateTheme];
}
/**
 * Hook to manage color mode preference
 */
export function useColorMode(): [ColorMode, (mode: ColorMode) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateColorMode = (newMode: ColorMode) => {
    setPrefs({ ...prefs, colorMode: newMode });
  };

  return [prefs.colorMode || "auto", updateColorMode];
}

/**
 * Hook to manage wrapping preference
 */
export function useWrapping(): [boolean, (wrapping: boolean) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateWrapping = (newWrapping: boolean) => {
    setPrefs({ ...prefs, wrapping: newWrapping });
  };

  return [prefs.wrapping !== false, updateWrapping];
}

/**
 * Hook to manage ignore whitespace preference
 */
export function useIgnoreWhitespace(): [boolean, (ignore: boolean) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateIgnoreWhitespace = (newIgnore: boolean) => {
    setPrefs({ ...prefs, ignoreWhitespace: newIgnore });
  };

  return [prefs.ignoreWhitespace === true, updateIgnoreWhitespace];
}
