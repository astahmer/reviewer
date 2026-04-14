import { ChevronDown } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { findBranchByName, getBranchDisplayName, getBranchScopeLabel } from "~/lib/branches";
import {
  getCommitDisplayLabel,
  getDefaultCommit,
  getLocalRefDescription,
  isLocalCommit,
} from "~/lib/local-refs";
import type { BranchInfo, CommitInfo } from "~/lib/types";
import { formatDate } from "./format-date";

interface RevisionSelectorProps {
  label: string;
  branches: BranchInfo[];
  commits: CommitInfo[];
  branchValue: string;
  commitValue: string;
  onBranchChange: (branch: string) => void;
  onCommitChange: (commitHash: string) => void;
  defaultBranch?: string;
  placeholder?: string;
  isBranchLoading?: boolean;
  isCommitLoading?: boolean;
}

interface BranchRevisionItem {
  kind: "branch";
  id: string;
  searchText: string;
  branch: BranchInfo;
}

interface CommitRevisionItem {
  kind: "commit";
  id: string;
  searchText: string;
  commit: CommitInfo;
}

type RevisionSelectorItem = BranchRevisionItem | CommitRevisionItem;

const isSelectedCommit = (selectedCommit: string, hash: string) => {
  if (!selectedCommit) {
    return false;
  }

  return (
    selectedCommit === hash || hash.startsWith(selectedCommit) || selectedCommit.startsWith(hash)
  );
};

function Checkmark() {
  return (
    <svg
      class="h-4 w-4 flex-shrink-0 text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function RevisionSelector(props: RevisionSelectorProps) {
  const selectedBranch = createMemo(() =>
    findBranchByName(props.branches, props.branchValue || props.defaultBranch),
  );
  const defaultCommit = createMemo(() => getDefaultCommit(props.commits));
  const selectedCommit = createMemo(() => {
    const matchedCommit = props.commits.find((commit) =>
      isSelectedCommit(props.commitValue, commit.hash),
    );
    return matchedCommit || (!props.commitValue && defaultCommit() ? defaultCommit() : undefined);
  });
  const selectedBranchLabel = createMemo(() => getBranchDisplayName(selectedBranch()));
  const items = createMemo<RevisionSelectorItem[]>(() => [
    ...props.branches.map((branch) => ({
      kind: "branch" as const,
      id: `branch:${branch.name}`,
      searchText: [
        branch.displayName,
        branch.baseName,
        branch.remoteName || "",
        branch.latestCommit.message,
        branch.latestCommit.author,
      ].join(" "),
      branch,
    })),
    ...props.commits.map((commit) => ({
      kind: "commit" as const,
      id: `commit:${commit.hash}`,
      searchText: [
        commit.hash,
        commit.label || "",
        commit.message,
        commit.author,
        selectedBranchLabel(),
      ].join(" "),
      commit,
    })),
  ]);

  const [inputValue, setInputValue] = createSignal("");
  const [open, setOpen] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const filteredItems = createMemo(() => {
    const query = inputValue().trim().toLowerCase();

    if (!query) {
      return items();
    }

    return items().filter((item) => item.searchText.toLowerCase().includes(query));
  });

  const branchItems = createMemo(() =>
    filteredItems().filter((item): item is BranchRevisionItem => item.kind === "branch"),
  );
  const commitItems = createMemo(() =>
    filteredItems().filter((item): item is CommitRevisionItem => item.kind === "commit"),
  );
  const localCommitItems = createMemo(() =>
    commitItems().filter((item) => isLocalCommit(item.commit)),
  );
  const groupedCommitItems = createMemo(() => {
    const grouped = commitItems()
      .filter((item) => !isLocalCommit(item.commit))
      .reduce((acc, item) => {
        const date = new Date(item.commit.date);
        const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
        const itemsForMonth = acc.get(monthKey) || [];
        itemsForMonth.push(item);
        acc.set(monthKey, itemsForMonth);
        return acc;
      }, new Map<string, CommitRevisionItem[]>());

    return Array.from(grouped.entries());
  });
  const firstFilteredItem = createMemo(() => filteredItems()[0]);

  const handleSelectItem = (item: RevisionSelectorItem) => {
    if (item.kind === "branch") {
      props.onBranchChange(item.branch.name);
    } else {
      props.onCommitChange(item.commit.hash);
    }

    setOpen(false);
  };

  onMount(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!open() || !rootRef) {
        return;
      }

      if (!rootRef.contains(event.target as Node)) {
        setOpen(false);
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
      inputRef?.focus();
    });
  });

  return (
    <div class="relative" ref={(element) => (rootRef = element)}>
      <button
        type="button"
        aria-label={`${props.label} revision selector`}
        onClick={() => {
          setOpen(!open());
          setInputValue("");
        }}
        class="flex w-[17.5rem] items-center justify-between gap-2 rounded-xl border border-slate-300 bg-[var(--app-panel)] px-3 py-2 text-xs shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-slate-400 data-[state=open]:bg-slate-50 sm:w-[18.25rem] xl:w-[19rem] dark:border-slate-700 dark:hover:bg-slate-800"
        data-state={open() ? "open" : "closed"}
      >
        <span class="min-w-0 flex-1 truncate text-left text-slate-900 dark:text-slate-100">
          {selectedCommit()
            ? getCommitDisplayLabel(selectedCommit()!)
            : selectedBranch()
              ? getBranchDisplayName(selectedBranch()!)
              : props.isBranchLoading || props.isCommitLoading
                ? "Loading..."
                : props.placeholder || "Select revision..."}
        </span>
        <Show when={selectedCommit() && selectedBranchLabel()}>
          <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {selectedBranchLabel()}
          </span>
        </Show>
        <ChevronDown class="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      <Show when={open()}>
        <div
          data-testid={`${props.label.toLowerCase()}-revision-menu`}
          class="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(38rem,calc(100vw-2rem))] max-w-[38rem] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--app-panel)] text-slate-800 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.32)] dark:border-slate-700 dark:text-slate-100 dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]"
        >
          <div class="border-b border-slate-200 dark:border-slate-700">
            <input
              ref={(element) => (inputRef = element)}
              type="text"
              autofocus
              aria-label={`${props.label} revision search`}
              value={inputValue()}
              onInput={(event) => setInputValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  return;
                }

                if (event.key === "Enter" && firstFilteredItem()) {
                  event.preventDefault();
                  handleSelectItem(firstFilteredItem()!);
                }
              }}
              class="w-full bg-[var(--app-panel)] px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
              placeholder="Search branches or commits"
            />
          </div>

          <div class="max-h-[70vh] w-full overflow-y-auto p-1.5">
            <Show
              when={filteredItems().length > 0}
              fallback={
                <div class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
                  No revisions found
                </div>
              }
            >
              <Show when={branchItems().length > 0}>
                <div>
                  <div class="sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                    Branches
                  </div>
                  <For each={branchItems()}>
                    {(item) => {
                      const isActive = () => item.branch.name === selectedBranch()?.name;

                      return (
                        <button
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <div class="min-w-0 flex-1 text-xs">
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono font-medium text-slate-700 dark:text-slate-200">
                                {getBranchDisplayName(item.branch)}
                              </span>
                              <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {getBranchScopeLabel(item.branch)}
                              </span>
                              <Show when={props.defaultBranch === item.branch.name}>
                                <span class="text-slate-500 dark:text-slate-500">default</span>
                              </Show>
                            </div>
                            <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500">
                              <span>{formatDate(item.branch.latestCommit.date)}</span>
                              <span>·</span>
                              <span>{item.branch.latestCommit.author}</span>
                            </div>
                            <div class="truncate text-slate-700 dark:text-slate-300">
                              {item.branch.latestCommit.message || "No commits"}
                            </div>
                          </div>
                          <Show when={isActive()}>
                            <Checkmark />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>

              <Show when={localCommitItems().length > 0}>
                <div>
                  <div class="sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                    Local changes
                  </div>
                  <For each={localCommitItems()}>
                    {(item) => {
                      const isActive = () =>
                        selectedCommit()
                          ? isSelectedCommit(selectedCommit()!.hash, item.commit.hash)
                          : false;

                      return (
                        <button
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <div class="min-w-0 flex-1 text-xs">
                            <div class="flex items-center gap-1.5">
                              <span class="font-medium text-amber-700 dark:text-amber-300">
                                {getCommitDisplayLabel(item.commit)}
                              </span>
                              <span class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                local
                              </span>
                            </div>
                            <div class="truncate text-slate-600 dark:text-slate-300">
                              {getLocalRefDescription(item.commit.hash)}
                            </div>
                          </div>
                          <Show when={isActive()}>
                            <Checkmark />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>

              <For each={groupedCommitItems()}>
                {([month, monthItems]) => (
                  <div>
                    <div class="sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                      {month}
                    </div>
                    <For each={monthItems}>
                      {(item) => {
                        const isActive = () =>
                          selectedCommit()
                            ? isSelectedCommit(selectedCommit()!.hash, item.commit.hash)
                            : false;

                        return (
                          <button
                            type="button"
                            onClick={() => handleSelectItem(item)}
                            class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <div class="min-w-0 flex-1 text-xs">
                              <div class="flex items-center gap-1.5">
                                <span class="font-mono text-blue-600 dark:text-blue-300">
                                  {item.commit.hash.slice(0, 7)}
                                </span>
                                <Show when={selectedBranchLabel()}>
                                  <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {selectedBranchLabel()}
                                  </span>
                                </Show>
                                <span class="text-slate-500 dark:text-slate-500">
                                  {formatDate(item.commit.date)}
                                </span>
                                <span class="text-slate-500 dark:text-slate-500">·</span>
                                <span class="text-slate-500 dark:text-slate-500">
                                  {item.commit.author}
                                </span>
                              </div>
                              <div class="truncate text-slate-700 dark:text-slate-300">
                                {item.commit.message}
                              </div>
                            </div>
                            <Show when={isActive()}>
                              <Checkmark />
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
