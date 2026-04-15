import { createEffect, createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import { DEFAULT_PREFERENCES, DEFAULT_THEME, STORAGE_KEYS } from "~/lib/constants";
import type { ColorMode } from "~/lib/constants";
import type { UserPreferences } from "~/lib/types";

type StorageUpdater<T> = T | ((currentValue: T) => T);

const LOCAL_STORAGE_SYNC_EVENT = "reviewer:local-storage-sync";

const readStoredValue = <T,>(key: string, defaultValue: T) => {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export function getSystemColorMode(): Exclude<ColorMode, "auto"> {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function createLocalStorageSignal<T>(
  key: string,
  defaultValue: T,
): [Accessor<T>, (value: StorageUpdater<T>) => void] {
  const [value, setValue] = createSignal<T>(readStoredValue(key, defaultValue));

  const updateValue = (nextValue: StorageUpdater<T>) => {
    const resolvedValue =
      typeof nextValue === "function"
        ? (nextValue as (currentValue: T) => T)(value())
        : nextValue;

    setValue(() => resolvedValue);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(key, JSON.stringify(resolvedValue));
        window.dispatchEvent(
          new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
            detail: { key, value: resolvedValue },
          }),
        );
      } catch {
        // ignore storage failures in restricted environments
      }
    }
  };

  onMount(() => {
    const syncFromStorage = () => {
      setValue(() => readStoredValue(key, defaultValue));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        syncFromStorage();
      }
    };

    const handleCustomSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ key: string; value: T }>;

      if (customEvent.detail?.key === key) {
        setValue(() => customEvent.detail.value);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync as EventListener);

    onCleanup(() => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync as EventListener);
    });
  });

  return [value, updateValue];
}

export const useLocalStorage = createLocalStorageSignal;

const createPreferencesSignal = () =>
  createLocalStorageSignal<UserPreferences>(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES);

export function useViewMode(): [Accessor<"unified" | "split">, (mode: "unified" | "split") => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setViewMode = (mode: "unified" | "split") => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      viewMode: mode,
    }));
  };

  return [() => preferences().viewMode, setViewMode];
}

export function useTheme(): [Accessor<string>, (theme: string) => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setTheme = (theme: string) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      theme,
    }));
  };

  return [() => preferences().theme || DEFAULT_THEME, setTheme];
}

export function useColorMode(): [Accessor<ColorMode>, (mode: ColorMode) => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setColorMode = (mode: ColorMode) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      colorMode: mode,
    }));
  };

  return [() => preferences().colorMode || "auto", setColorMode];
}

export function createGlobalColorMode(): [Accessor<ColorMode>, (mode: ColorMode) => void] {
  const [preferences, setPreferences] = createLocalStorageSignal<UserPreferences>(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  const updateGlobalColorMode = (nextMode: ColorMode) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      globalColorMode: nextMode,
    }));
  };

  return [() => preferences().globalColorMode || "auto", updateGlobalColorMode];
}

export function createResolvedGlobalColorMode(): Accessor<Exclude<ColorMode, "auto">> {
  const [globalColorMode] = createGlobalColorMode();
  const [resolvedMode, setResolvedMode] = createSignal<Exclude<ColorMode, "auto">>(
    globalColorMode() === "auto"
      ? getSystemColorMode()
      : (globalColorMode() as Exclude<ColorMode, "auto">),
  );

  createEffect(() => {
    if (globalColorMode() !== "auto") {
      setResolvedMode(globalColorMode() as Exclude<ColorMode, "auto">);
      return;
    }

    if (typeof window === "undefined") {
      setResolvedMode("light");
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMode = () => setResolvedMode(mediaQuery.matches ? "dark" : "light");

    updateMode();
    mediaQuery.addEventListener("change", updateMode);

    onCleanup(() => {
      mediaQuery.removeEventListener("change", updateMode);
    });
  });

  return resolvedMode;
}

export const useGlobalColorMode = createGlobalColorMode;
export const useResolvedGlobalColorMode = createResolvedGlobalColorMode;

export function useWrapping(): [Accessor<boolean>, (wrapping: boolean) => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setWrapping = (wrapping: boolean) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      wrapping,
    }));
  };

  return [() => preferences().wrapping !== false, setWrapping];
}

export function useSidebarPosition(): [Accessor<"left" | "right">, (position: "left" | "right") => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setSidebarPosition = (position: "left" | "right") => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      sidebarPosition: position,
    }));
  };

  return [() => preferences().sidebarPosition || "left", setSidebarPosition];
}

export function useSidebarCollapsed(): [Accessor<boolean>, (collapsed: boolean) => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setSidebarCollapsed = (collapsed: boolean) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      sidebarCollapsed: collapsed,
    }));
  };

  return [() => preferences().sidebarCollapsed === true, setSidebarCollapsed];
}

export function useSidebarSize(): [Accessor<number>, (size: number) => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setSidebarSize = (size: number) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      sidebarSize: size,
    }));
  };

  return [() => preferences().sidebarSize || DEFAULT_PREFERENCES.sidebarSize || 28, setSidebarSize];
}

export function useSidebarSectionSizes(): [
  Accessor<{ files: number; history: number }>,
  (sizes: { files: number; history: number }) => void,
] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setSidebarSectionSizes = (sizes: { files: number; history: number }) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      sidebarFilesSize: sizes.files,
      sidebarHistorySize: sizes.history,
    }));
  };

  return [
    () => ({
      files: preferences().sidebarFilesSize || DEFAULT_PREFERENCES.sidebarFilesSize || 60,
      history: preferences().sidebarHistorySize || DEFAULT_PREFERENCES.sidebarHistorySize || 40,
    }),
    setSidebarSectionSizes,
  ];
}

export function useSidebarSectionCollapsedState(): [
  Accessor<{ files: boolean; history: boolean }>,
  (state: { files: boolean; history: boolean }) => void,
] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setSidebarSectionCollapsedState = (state: { files: boolean; history: boolean }) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      sidebarFilesCollapsed: state.files,
      sidebarHistoryCollapsed: state.history,
    }));
  };

  return [
    () => ({
      files: preferences().sidebarFilesCollapsed === true,
      history: preferences().sidebarHistoryCollapsed === true,
    }),
    setSidebarSectionCollapsedState,
  ];
}

export function useIgnoreWhitespace(): [Accessor<boolean>, (ignoreWhitespace: boolean) => void] {
  const [preferences, setPreferences] = createPreferencesSignal();

  const setIgnoreWhitespace = (ignoreWhitespace: boolean) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      ignoreWhitespace,
    }));
  };

  return [() => preferences().ignoreWhitespace === true, setIgnoreWhitespace];
}