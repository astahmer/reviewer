import { ChevronDown, FolderPlus, LoaderCircle } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";

interface Repository {
  path: string;
  name: string;
}

interface RepositorySelectorProps {
  repositories: Repository[];
  selectedRepo: Repository | null;
  onRepoChange: (repo: Repository) => void;
  onAddCustomPath?: (path: string) => void;
  searchRoots?: string[];
  isLoading?: boolean;
  triggerClass?: string;
  showPath?: boolean;
}

export function RepositorySelector(props: RepositorySelectorProps) {
  const [repoInputValue, setRepoInputValue] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const [showCustomPathInput, setShowCustomPathInput] = createSignal(false);
  const [customPathInput, setCustomPathInput] = createSignal("");
  let rootRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;

  const filteredRepos = createMemo(() => {
    const query = repoInputValue().trim().toLowerCase();

    if (!query) {
      return props.repositories;
    }

    return props.repositories.filter((repo) => {
      const name = repo.name.toLowerCase();
      const path = repo.path.toLowerCase();
      return name.includes(query) || path.includes(query);
    });
  });

  const emptyMessage = createMemo(() => {
    if (repoInputValue()) {
      return `No matches for "${repoInputValue()}"`;
    }

    if (props.isLoading) {
      return "Scanning added folders...";
    }

    if ((props.searchRoots?.length ?? 0) > 0) {
      return "No repositories found in the folders you've added";
    }

    return "Add a folder first";
  });

  const handleAddCustomPath = () => {
    const nextPath = customPathInput().trim();

    if (!nextPath || !props.onAddCustomPath) {
      return;
    }

    props.onAddCustomPath(nextPath);
    setCustomPathInput("");
    setShowCustomPathInput(false);
    setOpen(false);
  };

  onMount(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!open() || !rootRef) {
        return;
      }

      if (!rootRef.contains(event.target as Node)) {
        setOpen(false);
        setShowCustomPathInput(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    onCleanup(() => {
      document.removeEventListener("mousedown", handlePointerDown);
    });
  });

  createEffect(() => {
    if (!open()) {
      return;
    }

    queueMicrotask(() => {
      searchInputRef?.focus();
    });
  });

  return (
    <div
      class={`relative ${props.triggerClass ?? ""}`}
      ref={(element) => {
        rootRef = element;
      }}
    >
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open();
          setOpen(nextOpen);
          setShowCustomPathInput(
            nextOpen && (props.searchRoots?.length ?? 0) === 0 && props.repositories.length === 0,
          );
          setRepoInputValue("");
        }}
        class={`flex w-[18rem] max-w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-[var(--app-panel)] px-3 ${props.showPath === false ? "py-1.5" : "py-2"} text-xs shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 ${open() ? "border-slate-400 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80" : ""} dark:border-slate-700 dark:hover:bg-slate-800`}
      >
        <span class="min-w-0 flex-1 text-left">
          <span
            class={`block truncate font-medium text-slate-900 dark:text-slate-100 ${props.showPath === false ? "py-0.5" : ""}`}
          >
            {props.selectedRepo?.name || "Select a repository"}
          </span>
          <Show when={props.showPath !== false}>
            <span class="block truncate pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {props.selectedRepo?.path || "Search added folders or add another one"}
            </span>
          </Show>
        </span>
        <ChevronDown class="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      <Show when={open()}>
        <div class="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(30rem,calc(100vw-2rem))] max-w-[30rem] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--app-panel)] text-slate-800 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.32)] dark:border-slate-700 dark:text-slate-100 dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]">
          <Show
            when={!showCustomPathInput()}
            fallback={
              <div class="space-y-3 p-3">
                <p class="text-xs text-slate-700 dark:text-slate-300">
                  Add a folder to include in repository search. Reviewer will only look inside this
                  root.
                </p>
                <input
                  ref={(element) => {
                    searchInputRef = element;
                  }}
                  type="text"
                  value={customPathInput()}
                  onInput={(event) => setCustomPathInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddCustomPath();
                    }

                    if (event.key === "Escape") {
                      setShowCustomPathInput(false);
                    }
                  }}
                  placeholder="/Users/you/projects"
                  class="w-full rounded-xl border border-slate-300 bg-[var(--app-panel)] px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:text-slate-100"
                />
                <div class="flex gap-1">
                  <button
                    type="button"
                    onClick={handleAddCustomPath}
                    class="flex-1 rounded-xl bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    Add folder
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomPathInput(false)}
                    class="flex-1 rounded-xl bg-slate-200 px-3 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            }
          >
            <div>
              <div class="border-b border-slate-200 dark:border-slate-700">
                <input
                  ref={(element) => {
                    searchInputRef = element;
                  }}
                  type="text"
                  value={repoInputValue()}
                  onInput={(event) => setRepoInputValue(event.currentTarget.value)}
                  placeholder="Search repositories"
                  class="w-full bg-[var(--app-panel)] px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>

              <div class="max-h-[24rem] overflow-y-auto p-1.5">
                <Show
                  when={filteredRepos().length > 0}
                  fallback={
                    <div class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
                      {emptyMessage()}
                    </div>
                  }
                >
                  <For each={filteredRepos()}>
                    {(repo) => (
                      <button
                        type="button"
                        onClick={() => {
                          props.onRepoChange(repo);
                          setOpen(false);
                        }}
                        class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <div class="min-w-0 flex-1">
                          <div class="truncate font-medium">{repo.name}</div>
                          <div class="truncate pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {repo.path}
                          </div>
                        </div>
                        <Show when={props.selectedRepo?.path === repo.path}>
                          <span class="text-[10px] font-medium uppercase tracking-[0.12em] text-blue-600 dark:text-blue-300">
                            current
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </Show>
              </div>

              <div class="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <Show
                  when={props.isLoading}
                  fallback={
                    <Show
                      when={(props.searchRoots?.length ?? 0) > 0}
                      fallback={<span>Reviewer searches only the folders you add here.</span>}
                    >
                      <span>
                        Searching {props.searchRoots?.length ?? 0} folder
                        {(props.searchRoots?.length ?? 0) === 1 ? "" : "s"} only
                      </span>
                    </Show>
                  }
                >
                  <span class="inline-flex items-center gap-2">
                    <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
                    Scanning {(props.searchRoots?.length ?? 0) || 1} folder
                    {(props.searchRoots?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                </Show>
              </div>

              <button
                type="button"
                onClick={() => setShowCustomPathInput(true)}
                class="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FolderPlus class="h-3.5 w-3.5" />
                <span>Add folder</span>
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
