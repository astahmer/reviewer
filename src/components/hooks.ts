import { useState, useEffect } from "react";
import {
  SEARCH_DEBOUNCE_MS,
  DEFAULT_PREFERENCES,
  STORAGE_KEYS,
  DEFAULT_THEME,
} from "~/lib/constants";
import { UserPreferences, Line } from "~/lib/types";
import type { ColorMode } from "~/lib/constants";

type StorageUpdater<T> = T | ((currentValue: T) => T);
const LOCAL_STORAGE_SYNC_EVENT = "reviewer:local-storage-sync";

export function getSystemColorMode(): Exclude<ColorMode, "auto"> {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Generic hook for localStorage persistence
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: StorageUpdater<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const updateValue = (nextValue: StorageUpdater<T>) => {
    setValue((previousValue) => {
      let currentValue = previousValue;

      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(key);
          currentValue = stored ? (JSON.parse(stored) as T) : previousValue;
        } catch {
          currentValue = previousValue;
        }
      }

      const resolvedValue =
        typeof nextValue === "function" ? (nextValue as (value: T) => T)(currentValue) : nextValue;

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(key, JSON.stringify(resolvedValue));
          window.dispatchEvent(
            new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
              detail: { key, value: resolvedValue },
            }),
          );
        } catch {
          // Silently fail if localStorage is unavailable
        }
      }

      return resolvedValue;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromStorage = () => {
      try {
        const stored = localStorage.getItem(key);
        setValue(stored ? (JSON.parse(stored) as T) : defaultValue);
      } catch {
        setValue(defaultValue);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        syncFromStorage();
      }
    };

    const handleCustomSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ key: string; value: T }>;
      if (customEvent.detail?.key === key) {
        setValue(customEvent.detail.value);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync as EventListener);
    };
  }, [defaultValue, key]);

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
    setStoredPrefs((currentPrefs) => ({ ...currentPrefs, ...update }));
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
    setPrefs((currentPrefs) => ({ ...currentPrefs, viewMode: mode }));
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
    setPrefs((currentPrefs) => ({ ...currentPrefs, theme: newTheme }));
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
    setPrefs((currentPrefs) => ({ ...currentPrefs, colorMode: newMode }));
  };

  return [prefs.colorMode || "auto", updateColorMode];
}

/**
 * Hook to manage global application color mode preference
 */
export function useGlobalColorMode(): [ColorMode, (mode: ColorMode) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateGlobalColorMode = (newMode: ColorMode) => {
    setPrefs((currentPrefs) => ({ ...currentPrefs, globalColorMode: newMode }));
  };

  return [prefs.globalColorMode || "auto", updateGlobalColorMode];
}

/**
 * Hook to resolve global color mode, including live system preference changes for auto mode.
 */
export function useResolvedGlobalColorMode(): Exclude<ColorMode, "auto"> {
  const [globalColorMode] = useGlobalColorMode();
  const [resolvedMode, setResolvedMode] = useState<Exclude<ColorMode, "auto">>(() =>
    globalColorMode === "auto" ? getSystemColorMode() : globalColorMode,
  );

  useEffect(() => {
    if (globalColorMode !== "auto") {
      setResolvedMode(globalColorMode);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMode = () => setResolvedMode(mediaQuery.matches ? "dark" : "light");

    updateMode();
    mediaQuery.addEventListener("change", updateMode);

    return () => {
      mediaQuery.removeEventListener("change", updateMode);
    };
  }, [globalColorMode]);

  return resolvedMode;
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
    setPrefs((currentPrefs) => ({ ...currentPrefs, wrapping: newWrapping }));
  };

  return [prefs.wrapping !== false, updateWrapping];
}

/**
 * Hook to manage file tree sidebar position preference
 */
export function useSidebarPosition(): ["left" | "right", (position: "left" | "right") => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateSidebarPosition = (position: "left" | "right") => {
    setPrefs((currentPrefs) => ({ ...currentPrefs, sidebarPosition: position }));
  };

  return [prefs.sidebarPosition || "left", updateSidebarPosition];
}

/**
 * Hook to manage file tree sidebar collapsed state
 */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateSidebarCollapsed = (collapsed: boolean) => {
    setPrefs((currentPrefs) => ({ ...currentPrefs, sidebarCollapsed: collapsed }));
  };

  return [prefs.sidebarCollapsed === true, updateSidebarCollapsed];
}

/**
 * Hook to manage persisted horizontal sidebar size
 */
export function useSidebarSize(): [number, (size: number) => void] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateSidebarSize = (size: number) => {
    setPrefs((currentPrefs) => ({ ...currentPrefs, sidebarSize: size }));
  };

  return [prefs.sidebarSize || DEFAULT_PREFERENCES.sidebarSize || 28, updateSidebarSize];
}

/**
 * Hook to manage persisted nested sidebar section sizes
 */
export function useSidebarSectionSizes(): [
  { files: number; history: number },
  (sizes: { files: number; history: number }) => void,
] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateSizes = (sizes: { files: number; history: number }) => {
    setPrefs((currentPrefs) => ({
      ...currentPrefs,
      sidebarFilesSize: sizes.files,
      sidebarHistorySize: sizes.history,
    }));
  };

  return [
    {
      files: prefs.sidebarFilesSize || DEFAULT_PREFERENCES.sidebarFilesSize || 60,
      history: prefs.sidebarHistorySize || DEFAULT_PREFERENCES.sidebarHistorySize || 40,
    },
    updateSizes,
  ];
}

/**
 * Hook to manage collapsed state for nested sidebar sections
 */
export function useSidebarSectionCollapsedState(): [
  { files: boolean; history: boolean },
  (state: { files: boolean; history: boolean }) => void,
] {
  const [prefs, setPrefs] = useLocalStorage<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateCollapsedState = (state: { files: boolean; history: boolean }) => {
    setPrefs((currentPrefs) => ({
      ...currentPrefs,
      sidebarFilesCollapsed: state.files,
      sidebarHistoryCollapsed: state.history,
    }));
  };

  return [
    {
      files: prefs.sidebarFilesCollapsed === true,
      history: prefs.sidebarHistoryCollapsed === true,
    },
    updateCollapsedState,
  ];
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
    setPrefs((currentPrefs) => ({ ...currentPrefs, ignoreWhitespace: newIgnore }));
  };

  return [prefs.ignoreWhitespace === true, updateIgnoreWhitespace];
}
