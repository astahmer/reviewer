import { FC } from "react";
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
}

const isSelectedCommit = (selectedCommit: string, hash: string) => {
  if (!selectedCommit) {
    return false;
  }

  return (
    selectedCommit === hash || hash.startsWith(selectedCommit) || selectedCommit.startsWith(hash)
  );
};

const CommitLane: FC<CommitLaneProps> = ({
  title,
  branch,
  commits,
  selectedCommit,
  onSelectCommit,
  accentClassName,
}) => {
  const visibleCommits = commits.slice(0, 8);

  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <div className="flex items-center justify-between px-4 py-2.5">
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

      <div className="max-h-44 overflow-auto px-3 pb-3">
        <div className="space-y-2 border-l border-slate-200 pl-3">
          {visibleCommits.map((commit) => {
            const selected = isSelectedCommit(selectedCommit, commit.hash);

            return (
              <button
                key={commit.hash}
                type="button"
                onClick={() => onSelectCommit?.(commit.hash)}
                className={`relative -ml-[18px] flex w-full gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                  selected ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-slate-100"
                } ${onSelectCommit ? "cursor-pointer" : "cursor-default"}`}
                disabled={!onSelectCommit}
              >
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${selected ? accentClassName : "bg-slate-300"}`}
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
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {commit.author}
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
  return (
    <div className="bg-white/70 backdrop-blur-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">History</p>
        <p className="mt-1 text-sm text-slate-600">Recent commits for the active comparison</p>
      </div>

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
        onSelectCommit={onBaseCommitChange}
        accentClassName="bg-sky-500"
      />
    </div>
  );
};
