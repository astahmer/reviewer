import { FC, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { getCommitDisplayLabel, getLocalRefDescription, isLocalCommit } from "~/lib/local-refs";
import { CommitInfo } from "~/lib/types";
import { formatDate } from "./format-date";

interface CommitHistoryPanelProps {
  baseBranch: string;
  headBranch: string;
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

const isSelectedCommit = (selectedCommit: string, hash: string) => {
  if (!selectedCommit) {
    return false;
  }

  return (
    selectedCommit === hash || hash.startsWith(selectedCommit) || selectedCommit.startsWith(hash)
  );
};

const CommitStats: FC<{ commit: CommitInfo }> = ({ commit }) => {
  const additions = commit.additions || 0;
  const deletions = commit.deletions || 0;

  if (additions === 0 && deletions === 0) {
    return null;
  }

  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
      {additions > 0 ? <span className="text-emerald-600">+{additions}</span> : null}
      {deletions > 0 ? <span className="text-rose-600">-{deletions}</span> : null}
    </span>
  );
};

const CommitLane: FC<CommitLaneProps> = ({
  title,
  branch,
  commits,
  selectedCommit,
  onSelectCommit,
  accentClassName,
  secondarySelectedCommit,
  onLoadMore,
  hasMore,
}) => {
  return (
    <section className="min-h-0 flex flex-col border-b border-slate-200/80 last:border-b-0 dark:border-slate-800">
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-slate-800 dark:text-slate-200">
            {branch || "No branch"}
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {commits.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
        <div className="space-y-2 border-l border-slate-200 pl-3 dark:border-slate-800">
          {commits.map((commit) => {
            const selected = isSelectedCommit(selectedCommit, commit.hash);
            const secondarySelected = secondarySelectedCommit
              ? isSelectedCommit(secondarySelectedCommit, commit.hash)
              : false;

            return (
              <button
                key={commit.hash}
                type="button"
                onClick={() => onSelectCommit?.(commit.hash)}
                className={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1 text-left transition-colors ${
                  selected || secondarySelected
                    ? "bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/30 dark:ring-sky-800"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                } ${onSelectCommit ? "cursor-pointer" : "cursor-default"}`}
                disabled={!onSelectCommit}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-white ${
                    selected
                      ? accentClassName
                      : secondarySelected
                        ? "bg-violet-500"
                        : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 leading-none">
                    <span
                      className={`font-mono text-[11px] ${selected ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}
                    >
                      {getCommitDisplayLabel(commit)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isLocalCommit(commit) ? "local" : formatDate(commit.date)}
                    </span>
                    <span className="ml-auto shrink-0">
                      <CommitStats commit={commit} />
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                    {isLocalCommit(commit) ? getLocalRefDescription(commit.hash) : commit.message}
                  </span>
                </span>
              </button>
            );
          })}
          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="ml-[-14px] w-full rounded-md px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Load more commits…
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

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

const RangeTimeline: FC<RangeTimelineProps> = ({
  branch,
  commits,
  selectedBaseCommit,
  selectedHeadCommit,
  onBaseCommitChange,
  onHeadCommitChange,
  onLoadMore,
  hasMore,
}) => {
  const [anchorCommit, setAnchorCommit] = useState<string | null>(null);
  const [focusedCommit, setFocusedCommit] = useState<string>(
    selectedHeadCommit || selectedBaseCommit || commits[0]?.hash || "",
  );
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const visibleCommits = commits;

  useEffect(() => {
    const nextFocusedCommit =
      visibleCommits.find((commit) => commit.hash === focusedCommit)?.hash ||
      visibleCommits.find((commit) => isSelectedCommit(selectedHeadCommit, commit.hash))?.hash ||
      visibleCommits.find((commit) => isSelectedCommit(selectedBaseCommit, commit.hash))?.hash ||
      visibleCommits[0]?.hash ||
      "";

    if (nextFocusedCommit !== focusedCommit) {
      setFocusedCommit(nextFocusedCommit);
    }
  }, [focusedCommit, selectedBaseCommit, selectedHeadCommit, visibleCommits]);

  const selectedIndices = useMemo(() => {
    const baseIndex = commits.findIndex((commit) =>
      isSelectedCommit(selectedBaseCommit, commit.hash),
    );
    const headIndex = commits.findIndex((commit) =>
      isSelectedCommit(selectedHeadCommit, commit.hash),
    );

    if (baseIndex === -1 || headIndex === -1) {
      return null;
    }

    return {
      start: Math.min(baseIndex, headIndex),
      end: Math.max(baseIndex, headIndex),
    };
  }, [commits, selectedBaseCommit, selectedHeadCommit]);

  const handleCommitClick = (hash: string) => {
    if (!onBaseCommitChange || !onHeadCommitChange) {
      return;
    }

    if (!anchorCommit || anchorCommit === hash) {
      setAnchorCommit(hash);
      return;
    }

    const anchorIdx = commits.findIndex((commit) => commit.hash === anchorCommit);
    const targetIdx = commits.findIndex((commit) => commit.hash === hash);

    if (anchorIdx === -1 || targetIdx === -1) {
      setAnchorCommit(null);
      return;
    }

    const headIdx = Math.min(anchorIdx, targetIdx);
    const baseIdx = Math.max(anchorIdx, targetIdx);
    const head = commits[headIdx];
    const base = commits[baseIdx];

    if (head && base) {
      onHeadCommitChange(head.hash);
      onBaseCommitChange(base.hash);
    }

    setAnchorCommit(null);
  };

  const focusCommit = (hash: string | undefined) => {
    if (!hash) {
      return;
    }

    setFocusedCommit(hash);
    requestAnimationFrame(() => {
      itemRefs.current.get(hash)?.focus();
    });
  };

  const handleCommitKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCommit(visibleCommits[Math.min(index + 1, visibleCommits.length - 1)]?.hash);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCommit(visibleCommits[Math.max(index - 1, 0)]?.hash);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusCommit(visibleCommits[0]?.hash);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusCommit(visibleCommits[visibleCommits.length - 1]?.hash);
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleCommitClick(visibleCommits[index]?.hash || "");
    }
  };

  return (
    <section className="min-h-0 flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
            Range
          </span>
          <span className="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">
            {branch || "—"}
          </span>
          <span className="flex shrink-0 items-center gap-0.5" title="Anchor · Head · Base">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          </span>
        </div>
        {anchorCommit ? (
          <button
            type="button"
            onClick={() => setAnchorCommit(null)}
            className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
        <div
          className="space-y-2 border-l border-slate-200 pl-3 dark:border-slate-800"
          role="listbox"
          aria-label="Commit range timeline"
        >
          {visibleCommits.map((commit, index) => {
            const selectedAsHead = isSelectedCommit(selectedHeadCommit, commit.hash);
            const selectedAsBase = isSelectedCommit(selectedBaseCommit, commit.hash);
            const isAnchor = anchorCommit != null && isSelectedCommit(anchorCommit, commit.hash);
            const inRange =
              selectedIndices != null &&
              index >= selectedIndices.start &&
              index <= selectedIndices.end;

            return (
              <button
                key={commit.hash}
                type="button"
                ref={(element) => {
                  if (element) {
                    itemRefs.current.set(commit.hash, element);
                  } else {
                    itemRefs.current.delete(commit.hash);
                  }
                }}
                onClick={() => handleCommitClick(commit.hash)}
                onFocus={() => setFocusedCommit(commit.hash)}
                onKeyDown={(event) => handleCommitKeyDown(event, index)}
                role="option"
                aria-selected={selectedAsHead || selectedAsBase || inRange}
                tabIndex={focusedCommit === commit.hash ? 0 : -1}
                className={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1 text-left transition-colors ${
                  inRange
                    ? "bg-sky-50/70 dark:bg-sky-950/25"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                } ${isAnchor ? "ring-1 ring-inset ring-amber-300 dark:ring-amber-700" : inRange ? "ring-1 ring-inset ring-sky-200 dark:ring-sky-800" : ""}`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-white ${
                    isAnchor
                      ? "bg-amber-500"
                      : selectedAsHead
                        ? "bg-emerald-500"
                        : selectedAsBase
                          ? "bg-sky-500"
                          : inRange
                            ? "bg-sky-300"
                            : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 leading-none">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {getCommitDisplayLabel(commit)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isLocalCommit(commit) ? "local" : formatDate(commit.date)}
                    </span>
                    {selectedAsHead ? (
                      <span className="rounded bg-emerald-50 px-1 py-px text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        head
                      </span>
                    ) : null}
                    {selectedAsBase ? (
                      <span className="rounded bg-sky-50 px-1 py-px text-[9px] font-semibold uppercase text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        base
                      </span>
                    ) : null}
                    {isAnchor ? (
                      <span className="rounded bg-amber-50 px-1 py-px text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        anchor
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0">
                      <CommitStats commit={commit} />
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                    {isLocalCommit(commit) ? getLocalRefDescription(commit.hash) : commit.message}
                  </span>
                </span>
              </button>
            );
          })}
          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="ml-[-14px] w-full rounded-md px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Load more commits…
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export const CommitHistoryPanel: FC<CommitHistoryPanelProps> = ({
  baseBranch,
  headBranch,
  baseCommits,
  headCommits,
  selectedBaseCommit,
  selectedHeadCommit,
  onBaseCommitChange,
  onHeadCommitChange,
  onLoadMoreBase,
  onLoadMoreHead,
  hasMoreBase,
  hasMoreHead,
}) => {
  const isSameBranchComparison = !!baseBranch && baseBranch === headBranch;
  const rangeCommits = headCommits.length > 0 ? headCommits : baseCommits;
  const hasMoreRange = headCommits.length > 0 ? hasMoreHead : hasMoreBase;
  const onLoadMoreRange = headCommits.length > 0 ? onLoadMoreHead : onLoadMoreBase;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-panel)]">
      {isSameBranchComparison ? (
        <RangeTimeline
          branch={headBranch}
          commits={rangeCommits}
          selectedBaseCommit={selectedBaseCommit}
          selectedHeadCommit={selectedHeadCommit}
          onBaseCommitChange={onBaseCommitChange}
          onHeadCommitChange={onHeadCommitChange}
          onLoadMore={onLoadMoreRange}
          hasMore={hasMoreRange}
        />
      ) : (
        <>
          <CommitLane
            title="Head"
            branch={headBranch}
            commits={headCommits}
            selectedCommit={selectedHeadCommit}
            onSelectCommit={onHeadCommitChange}
            accentClassName="bg-emerald-500"
            onLoadMore={onLoadMoreHead}
            hasMore={hasMoreHead}
          />
          <CommitLane
            title="Base"
            branch={baseBranch}
            commits={baseCommits}
            selectedCommit={selectedBaseCommit}
            secondarySelectedCommit={selectedHeadCommit}
            onSelectCommit={onBaseCommitChange}
            accentClassName="bg-sky-500"
            onLoadMore={onLoadMoreBase}
            hasMore={hasMoreBase}
          />
        </>
      )}
    </div>
  );
};
