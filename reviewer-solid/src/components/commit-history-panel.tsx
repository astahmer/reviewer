import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { getCommitDisplayLabel, getLocalRefDescription, isLocalCommit } from "~/lib/local-refs";
import type { CommitInfo } from "~/lib/types";
import { formatDate } from "./format-date";

interface CommitHistoryPanelProps {
  baseBranchLabel: string;
  headBranchLabel: string;
  isSameBranchComparison: boolean;
  baseCommits: CommitInfo[];
  headCommits: CommitInfo[];
  selectedBaseCommit: string;
  selectedHeadCommit: string;
  onBaseCommitChange?: (hash: string) => void;
  onHeadCommitChange?: (hash: string) => void;
  onLoadMoreBase?: () => void;
  onLoadMoreHead?: () => void;
  hasMoreBase?: boolean;
  hasMoreHead?: boolean;
}

interface CommitLaneProps {
  title: string;
  branch: string;
  commits: CommitInfo[];
  selectedCommit: string;
  onSelectCommit?: (hash: string) => void;
  accentClassName: string;
  secondarySelectedCommit?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

interface RangeTimelineProps {
  branch: string;
  commits: CommitInfo[];
  selectedBaseCommit: string;
  selectedHeadCommit: string;
  onBaseCommitChange?: (hash: string) => void;
  onHeadCommitChange?: (hash: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const isSelectedCommit = (selectedCommit: string, hash: string) => {
  if (!selectedCommit) {
    return false;
  }

  return (
    selectedCommit === hash || hash.startsWith(selectedCommit) || selectedCommit.startsWith(hash)
  );
};

function CommitStats(props: { commit: CommitInfo }) {
  const additions = () => props.commit.additions || 0;
  const deletions = () => props.commit.deletions || 0;

  if (additions() === 0 && deletions() === 0) {
    return null;
  }

  return (
    <span class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
      <Show when={additions() > 0}>
        <span class="text-emerald-600">+{additions()}</span>
      </Show>
      <Show when={deletions() > 0}>
        <span class="text-rose-600">-{deletions()}</span>
      </Show>
    </span>
  );
}

function CommitLane(props: CommitLaneProps) {
  return (
    <section class="min-h-0 flex flex-col border-b border-slate-200/80 last:border-b-0 dark:border-slate-800">
      <div class="flex items-center justify-between px-3 py-2">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            {props.title}
          </p>
          <p class="mt-1 truncate font-mono text-xs text-slate-800 dark:text-slate-200">
            {props.branch || "No branch"}
          </p>
        </div>
        <span class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {props.commits.length}
        </span>
      </div>

      <div class="min-h-0 flex-1 overflow-auto px-3 pb-2">
        <div class="space-y-2 border-l border-slate-200 pl-3 dark:border-slate-800">
          <For each={props.commits}>
            {(commit) => {
              const selected = () => isSelectedCommit(props.selectedCommit, commit.hash);
              const secondarySelected = () =>
                props.secondarySelectedCommit
                  ? isSelectedCommit(props.secondarySelectedCommit, commit.hash)
                  : false;

              return (
                <button
                  type="button"
                  onClick={() => props.onSelectCommit?.(commit.hash)}
                  class={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1 text-left transition-colors ${
                    selected() || secondarySelected()
                      ? "bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/30 dark:ring-sky-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  } ${props.onSelectCommit ? "cursor-pointer" : "cursor-default"}`}
                  disabled={!props.onSelectCommit}
                >
                  <span
                    class={`mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-white ${
                      selected()
                        ? props.accentClassName
                        : secondarySelected()
                          ? "bg-violet-500"
                          : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-1.5 leading-none">
                      <span
                        class={`font-mono text-[11px] ${
                          selected()
                            ? "text-slate-900 dark:text-slate-100"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {getCommitDisplayLabel(commit)}
                      </span>
                      <span class="text-[10px] text-slate-500 dark:text-slate-400">
                        {isLocalCommit(commit) ? "local" : formatDate(commit.date)}
                      </span>
                      <span class="ml-auto shrink-0">
                        <CommitStats commit={commit} />
                      </span>
                    </span>
                    <span class="mt-0.5 block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                      {isLocalCommit(commit) ? getLocalRefDescription(commit.hash) : commit.message}
                    </span>
                  </span>
                </button>
              );
            }}
          </For>

          <Show when={props.hasMore && props.onLoadMore}>
            <button
              type="button"
              onClick={() => props.onLoadMore?.()}
              class="ml-[-14px] w-full rounded-md px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Load more commits…
            </button>
          </Show>
        </div>
      </div>
    </section>
  );
}

function RangeTimeline(props: RangeTimelineProps) {
  const [anchorCommit, setAnchorCommit] = createSignal<string | null>(null);
  const [focusedCommit, setFocusedCommit] = createSignal(
    props.selectedHeadCommit || props.selectedBaseCommit || props.commits[0]?.hash || "",
  );
  const itemRefs = new Map<string, HTMLButtonElement>();

  const selectedIndices = createMemo(() => {
    const baseIndex = props.commits.findIndex((commit) =>
      isSelectedCommit(props.selectedBaseCommit, commit.hash),
    );
    const headIndex = props.commits.findIndex((commit) =>
      isSelectedCommit(props.selectedHeadCommit, commit.hash),
    );

    if (baseIndex === -1 || headIndex === -1) {
      return null;
    }

    return {
      start: Math.min(baseIndex, headIndex),
      end: Math.max(baseIndex, headIndex),
    };
  });

  createEffect(() => {
    const nextFocusedCommit =
      props.commits.find((commit) => commit.hash === focusedCommit())?.hash ||
      props.commits.find((commit) => isSelectedCommit(props.selectedHeadCommit, commit.hash))
        ?.hash ||
      props.commits.find((commit) => isSelectedCommit(props.selectedBaseCommit, commit.hash))
        ?.hash ||
      props.commits[0]?.hash ||
      "";

    if (nextFocusedCommit !== focusedCommit()) {
      setFocusedCommit(nextFocusedCommit);
    }
  });

  const focusCommit = (hash: string | undefined) => {
    if (!hash) {
      return;
    }

    setFocusedCommit(hash);
    requestAnimationFrame(() => {
      itemRefs.get(hash)?.focus();
    });
  };

  const handleCommitClick = (hash: string) => {
    if (!props.onBaseCommitChange || !props.onHeadCommitChange) {
      return;
    }

    if (!anchorCommit() || anchorCommit() === hash) {
      setAnchorCommit(hash);
      return;
    }

    const anchorIndex = props.commits.findIndex((commit) => commit.hash === anchorCommit());
    const targetIndex = props.commits.findIndex((commit) => commit.hash === hash);

    if (anchorIndex === -1 || targetIndex === -1) {
      setAnchorCommit(null);
      return;
    }

    const headIndex = Math.min(anchorIndex, targetIndex);
    const baseIndex = Math.max(anchorIndex, targetIndex);
    const headCommit = props.commits[headIndex];
    const baseCommit = props.commits[baseIndex];

    if (headCommit && baseCommit) {
      props.onHeadCommitChange(headCommit.hash);
      props.onBaseCommitChange(baseCommit.hash);
    }

    setAnchorCommit(null);
  };

  const handleCommitKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCommit(props.commits[Math.min(index + 1, props.commits.length - 1)]?.hash);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCommit(props.commits[Math.max(index - 1, 0)]?.hash);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusCommit(props.commits[0]?.hash);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusCommit(props.commits[props.commits.length - 1]?.hash);
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleCommitClick(props.commits[index]?.hash || "");
    }
  };

  return (
    <section class="min-h-0 flex flex-1 flex-col overflow-hidden">
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <div class="flex min-w-0 items-center gap-2">
          <span class="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
            Range
          </span>
          <span class="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">
            {props.branch || "—"}
          </span>
          <span class="flex shrink-0 items-center gap-0.5" title="Anchor · Head · Base">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span class="h-1.5 w-1.5 rounded-full bg-sky-500" />
          </span>
        </div>
        <Show when={anchorCommit()}>
          <button
            type="button"
            onClick={() => setAnchorCommit(null)}
            class="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
          >
            Clear
          </button>
        </Show>
      </div>

      <div class="min-h-0 flex-1 overflow-auto px-3 pb-2">
        <div
          class="space-y-2 border-l border-slate-200 pl-3 dark:border-slate-800"
          role="listbox"
          aria-label="Commit range timeline"
        >
          <For each={props.commits}>
            {(commit, index) => {
              const selectedAsHead = () => isSelectedCommit(props.selectedHeadCommit, commit.hash);
              const selectedAsBase = () => isSelectedCommit(props.selectedBaseCommit, commit.hash);
              const isAnchor = () =>
                anchorCommit() != null && isSelectedCommit(anchorCommit() || "", commit.hash);
              const inRange = () => {
                const indices = selectedIndices();
                return indices != null && index() >= indices.start && index() <= indices.end;
              };

              return (
                <button
                  type="button"
                  ref={(element) => {
                    if (element) {
                      itemRefs.set(commit.hash, element);
                    } else {
                      itemRefs.delete(commit.hash);
                    }
                  }}
                  onClick={() => handleCommitClick(commit.hash)}
                  onFocus={() => {
                    setFocusedCommit(commit.hash);
                  }}
                  onKeyDown={(event) => handleCommitKeyDown(event, index())}
                  role="option"
                  aria-selected={selectedAsHead() || selectedAsBase() || inRange()}
                  tabIndex={focusedCommit() === commit.hash ? 0 : -1}
                  class={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1 text-left transition-colors ${
                    inRange()
                      ? "bg-sky-50/70 dark:bg-sky-950/25"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  } ${
                    isAnchor()
                      ? "ring-1 ring-inset ring-amber-300 dark:ring-amber-700"
                      : inRange()
                        ? "ring-1 ring-inset ring-sky-200 dark:ring-sky-800"
                        : ""
                  }`}
                >
                  <span
                    class={`mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-white ${
                      isAnchor()
                        ? "bg-amber-500"
                        : selectedAsHead()
                          ? "bg-emerald-500"
                          : selectedAsBase()
                            ? "bg-sky-500"
                            : inRange()
                              ? "bg-sky-300"
                              : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-1.5 leading-none">
                      <span class="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {getCommitDisplayLabel(commit)}
                      </span>
                      <span class="text-[10px] text-slate-500 dark:text-slate-400">
                        {isLocalCommit(commit) ? "local" : formatDate(commit.date)}
                      </span>
                      <Show when={selectedAsHead()}>
                        <span class="rounded bg-emerald-50 px-1 py-px text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          head
                        </span>
                      </Show>
                      <Show when={selectedAsBase()}>
                        <span class="rounded bg-sky-50 px-1 py-px text-[9px] font-semibold uppercase text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                          base
                        </span>
                      </Show>
                      <Show when={isAnchor()}>
                        <span class="rounded bg-amber-50 px-1 py-px text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          anchor
                        </span>
                      </Show>
                      <span class="ml-auto shrink-0">
                        <CommitStats commit={commit} />
                      </span>
                    </span>
                    <span class="mt-0.5 block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                      {isLocalCommit(commit) ? getLocalRefDescription(commit.hash) : commit.message}
                    </span>
                  </span>
                </button>
              );
            }}
          </For>

          <Show when={props.hasMore && props.onLoadMore}>
            <button
              type="button"
              onClick={() => props.onLoadMore?.()}
              class="ml-[-14px] w-full rounded-md px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Load more commits…
            </button>
          </Show>
        </div>
      </div>
    </section>
  );
}

export function CommitHistoryPanel(props: CommitHistoryPanelProps) {
  const rangeCommits = () => (props.headCommits.length > 0 ? props.headCommits : props.baseCommits);
  const hasMoreRange = () => (props.headCommits.length > 0 ? props.hasMoreHead : props.hasMoreBase);
  const onLoadMoreRange = () =>
    props.headCommits.length > 0 ? props.onLoadMoreHead : props.onLoadMoreBase;

  return (
    <div class="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-panel)]">
      <Show
        when={props.isSameBranchComparison}
        fallback={
          <>
            <CommitLane
              title="Head"
              branch={props.headBranchLabel}
              commits={props.headCommits}
              selectedCommit={props.selectedHeadCommit}
              onSelectCommit={props.onHeadCommitChange}
              accentClassName="bg-emerald-500"
              onLoadMore={props.onLoadMoreHead}
              hasMore={props.hasMoreHead}
            />
            <CommitLane
              title="Base"
              branch={props.baseBranchLabel}
              commits={props.baseCommits}
              selectedCommit={props.selectedBaseCommit}
              secondarySelectedCommit={props.selectedHeadCommit}
              onSelectCommit={props.onBaseCommitChange}
              accentClassName="bg-sky-500"
              onLoadMore={props.onLoadMoreBase}
              hasMore={props.hasMoreBase}
            />
          </>
        }
      >
        <RangeTimeline
          branch={props.headBranchLabel}
          commits={rangeCommits()}
          selectedBaseCommit={props.selectedBaseCommit}
          selectedHeadCommit={props.selectedHeadCommit}
          onBaseCommitChange={props.onBaseCommitChange}
          onHeadCommitChange={props.onHeadCommitChange}
          onLoadMore={onLoadMoreRange()}
          hasMore={hasMoreRange()}
        />
      </Show>
    </div>
  );
}
