import { useState, useCallback, useEffect } from "react";
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

  const updateValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
        } catch {
          // Silently fail if localStorage is unavailable
        }
      }
    },
    [key],
  );

  return [value, updateValue];
}

/**
 * Hook to manage user preferences with localStorage persistence
 */
export function useUserPreferences(): [UserPreferences, (prefs: Partial<UserPreferences>) => void] {
  const [prefs, setPrefs] = useState<UserPreferences>(() => {
    // Load from localStorage
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.preferences) : null;
    return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
  });

  const updatePrefs = useCallback((update: Partial<UserPreferences>) => {
    setPrefs((current) => {
      const updated = { ...current, ...update };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  return [prefs, updatePrefs];
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
  const [history, setHistory] = useState<string[]>(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.searchHistory) : null;
    return stored ? JSON.parse(stored) : [];
  });

  const addToHistory = useCallback((query: string) => {
    setHistory((current) => {
      const updated = [query, ...current.filter((q) => q !== query)].slice(0, 10);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

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
  const [viewMode, setViewMode] = useState<"unified" | "split">(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.preferences) : null;
    const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    return prefs.viewMode || "unified";
  });

  const updateViewMode = useCallback((mode: "unified" | "split") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ ...prefs, viewMode: mode }));
    }
  }, []);

  return [viewMode, updateViewMode];
}
/**
 * Hook to manage theme preference
 */
export function useTheme(): [string, (theme: string) => void] {
  const [theme, setTheme] = useState<string>(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.preferences) : null;
    const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    return prefs.theme || DEFAULT_THEME;
  });

  const updateTheme = useCallback((newTheme: string) => {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ ...prefs, theme: newTheme }));
    }
  }, []);

  return [theme, updateTheme];
}
/**
 * Hook to manage color mode preference
 */
export function useColorMode(): [ColorMode, (mode: ColorMode) => void] {
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.preferences) : null;
    const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    return prefs.colorMode || "auto";
  });

  const updateColorMode = useCallback((newMode: ColorMode) => {
    setColorMode(newMode);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
      localStorage.setItem(
        STORAGE_KEYS.preferences,
        JSON.stringify({ ...prefs, colorMode: newMode }),
      );
    }
  }, []);

  return [colorMode, updateColorMode];
}

/**
 * Hook to manage wrapping preference
 */
export function useWrapping(): [boolean, (wrapping: boolean) => void] {
  const [wrapping, setWrapping] = useState<boolean>(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.preferences) : null;
    const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    return prefs.wrapping !== false; // Default to true
  });

  const updateWrapping = useCallback((newWrapping: boolean) => {
    setWrapping(newWrapping);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
      localStorage.setItem(
        STORAGE_KEYS.preferences,
        JSON.stringify({ ...prefs, wrapping: newWrapping }),
      );
    }
  }, []);

  return [wrapping, updateWrapping];
}

/**
 * Hook to manage ignore whitespace preference
 */
export function useIgnoreWhitespace(): [boolean, (ignore: boolean) => void] {
  const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.preferences) : null;
    const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    return prefs.ignoreWhitespace === true;
  });

  const updateIgnoreWhitespace = useCallback((newIgnore: boolean) => {
    setIgnoreWhitespace(newIgnore);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      const prefs = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
      localStorage.setItem(
        STORAGE_KEYS.preferences,
        JSON.stringify({ ...prefs, ignoreWhitespace: newIgnore }),
      );
    }
  }, []);

  return [ignoreWhitespace, updateIgnoreWhitespace];
}
