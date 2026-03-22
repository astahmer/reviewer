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
}

interface CommitLaneProps {
  title: string;
  branch: string;
  commits: CommitInfo[];
  selectedCommit: string;
  onSelectCommit?: (hash: string) => void;
  accentClassName: string;
  secondarySelectedCommit?: string;
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
}) => {
  const visibleCommits = commits.slice(0, 8);

  return (
    <section className="min-h-0 flex flex-col border-b border-slate-200 last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-slate-700">{branch || "No branch"}</p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {commits.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
        <div className="space-y-2 border-l border-slate-200 pl-3">
          {visibleCommits.map((commit) => {
            const selected = isSelectedCommit(selectedCommit, commit.hash);
            const secondarySelected = secondarySelectedCommit
              ? isSelectedCommit(secondarySelectedCommit, commit.hash)
              : false;

            return (
              <button
                key={commit.hash}
                type="button"
                onClick={() => onSelectCommit?.(commit.hash)}
                className={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                  selected || secondarySelected
                    ? "bg-sky-50 ring-1 ring-inset ring-sky-200"
                    : "hover:bg-slate-100"
                } ${onSelectCommit ? "cursor-pointer" : "cursor-default"}`}
                disabled={!onSelectCommit}
              >
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${
                    selected
                      ? accentClassName
                      : secondarySelected
                        ? "bg-violet-500"
                        : "bg-slate-300"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[11px] ${selected ? "text-slate-900" : "text-slate-500"}`}
                    >
                      {getCommitDisplayLabel(commit)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {isLocalCommit(commit) ? "local" : formatDate(commit.date)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-slate-700">
                    {isLocalCommit(commit) ? getLocalRefDescription(commit.hash) : commit.message}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="block truncate text-[11px] text-slate-400">
                      {commit.author}
                    </span>
                    <CommitStats commit={commit} />
                  </span>
                </span>
              </button>
            );
          })}
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
}

const RangeTimeline: FC<RangeTimelineProps> = ({
  branch,
  commits,
  selectedBaseCommit,
  selectedHeadCommit,
  onBaseCommitChange,
  onHeadCommitChange,
}) => {
  const [anchorCommit, setAnchorCommit] = useState<string | null>(null);
  const [focusedCommit, setFocusedCommit] = useState<string>(
    selectedHeadCommit || selectedBaseCommit || commits[0]?.hash || "",
  );
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const visibleCommits = commits.slice(0, 12);

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
      <div className="flex items-start justify-between gap-3 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Range Timeline
          </p>
          <p className="mt-1 truncate font-mono text-xs text-slate-700">{branch || "No branch"}</p>
          <p className="mt-1 text-xs text-slate-500">
            First click sets an anchor. Second click selects the range: the newer commit becomes
            Head and the older commit becomes Base.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Anchor
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Head
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Base
            </span>
          </div>
        </div>
        {anchorCommit ? (
          <button
            type="button"
            onClick={() => setAnchorCommit(null)}
            className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
          >
            Clear anchor
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
        <div
          className="space-y-2 border-l border-slate-200 pl-3"
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
                className={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                  inRange ? "bg-sky-50/70" : "hover:bg-slate-100"
                } ${isAnchor ? "ring-1 ring-inset ring-amber-300" : inRange ? "ring-1 ring-inset ring-sky-200" : ""}`}
              >
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${
                    isAnchor
                      ? "bg-amber-500"
                      : selectedAsHead
                        ? "bg-emerald-500"
                        : selectedAsBase
                          ? "bg-sky-500"
                          : inRange
                            ? "bg-sky-300"
                            : "bg-slate-300"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">
                      {getCommitDisplayLabel(commit)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {isLocalCommit(commit) ? "local" : formatDate(commit.date)}
                    </span>
                    {selectedAsHead ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                        head
                      </span>
                    ) : null}
                    {selectedAsBase ? (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                        base
                      </span>
                    ) : null}
                    {isAnchor ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                        anchor
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-slate-700">
                    {isLocalCommit(commit) ? getLocalRefDescription(commit.hash) : commit.message}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="block truncate text-[11px] text-slate-400">
                      {commit.author}
                    </span>
                    <CommitStats commit={commit} />
                  </span>
                </span>
              </button>
            );
          })}
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
}) => {
  const isSameBranchComparison = !!baseBranch && baseBranch === headBranch;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white/70 backdrop-blur-sm">
      {isSameBranchComparison ? (
        <RangeTimeline
          branch={headBranch}
          commits={headCommits.length > 0 ? headCommits : baseCommits}
          selectedBaseCommit={selectedBaseCommit}
          selectedHeadCommit={selectedHeadCommit}
          onBaseCommitChange={onBaseCommitChange}
          onHeadCommitChange={onHeadCommitChange}
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
          />
          <CommitLane
            title="Base"
            branch={baseBranch}
            commits={baseCommits}
            selectedCommit={selectedBaseCommit}
            secondarySelectedCommit={selectedHeadCommit}
            onSelectCommit={onBaseCommitChange}
            accentClassName="bg-sky-500"
          />
        </>
      )}
    </div>
  );
};
