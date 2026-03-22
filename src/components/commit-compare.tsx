import { FC, useState } from "react";
import { getCommitDisplayLabel, isLocalCommit } from "~/lib/local-refs";
import { CommitInfo } from "~/lib/types";

interface CommitCompareProps {
  baseCommit: CommitInfo | undefined;
  headCommit: CommitInfo | undefined;
  baseBranch: string;
  headBranch: string;
  distance: number | null;
}

export const CommitCompare: FC<CommitCompareProps> = ({
  baseCommit,
  headCommit,
  baseBranch,
  headBranch,
  distance,
}) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString();
  };

  if (!baseCommit || !headCommit) return null;

  const [headFirstLine, headRemaining] = headCommit.message.split("\n", 2).map((v) => v.trim());
  const [baseFirstLine, baseRemaining] = baseCommit.message.split("\n", 2).map((v) => v.trim());
  const baseLabel = getCommitDisplayLabel(baseCommit);
  const headLabel = getCommitDisplayLabel(headCommit);

  return (
    <div className="rounded-md border border-slate-200 bg-[var(--app-panel)] shadow-sm dark:border-slate-800">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-blue-600">{baseLabel}</span>
            <span
              className="max-w-xs truncate text-xs text-slate-600 dark:text-slate-300"
              title={baseCommit.message}
            >
              {baseFirstLine?.slice(0, 50)}
              {(baseFirstLine || "").length > 50 ? "..." : ""}
            </span>
          </div>
          <svg
            className="h-4 w-4 text-slate-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-green-600">{headLabel}</span>
            <span
              className="max-w-xs truncate text-xs text-slate-600 dark:text-slate-300"
              title={headCommit.message}
            >
              {headFirstLine?.slice(0, 50)}
              {(headFirstLine || "").length > 50 ? "..." : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {baseBranch &&
            headBranch &&
            baseBranch === headBranch &&
            !isLocalCommit(baseCommit) &&
            !isLocalCommit(headCommit) && (
              <>
                <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  {baseBranch}
                </span>
                {distance !== null && distance > 0 && (
                  <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                    {distance} commit{distance !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          {baseBranch !== headBranch && (
            <div className="flex gap-1">
              {baseBranch && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {baseBranch}
                </span>
              )}
              <span className="text-slate-400 dark:text-slate-500">→</span>
              {headBranch && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {headBranch}
                </span>
              )}
            </div>
          )}
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform dark:text-slate-500 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 bg-[var(--app-panel-muted)] p-3 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded bg-[var(--app-panel)] p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  BASE
                </span>
                <span className="font-mono text-xs text-blue-600">{baseLabel}</span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-200">
                {baseRemaining ? (
                  <details>
                    <summary className="cursor-pointer truncate hover:text-slate-900 dark:hover:text-slate-100">
                      {baseFirstLine}
                    </summary>
                    {baseRemaining && (
                      <div className="mt-1 whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                        {baseRemaining}
                      </div>
                    )}
                  </details>
                ) : (
                  baseFirstLine
                )}
              </div>
              <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {baseCommit.author} · {formatDate(baseCommit.date)}
              </div>
            </div>

            <div className="rounded bg-[var(--app-panel)] p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  HEAD
                </span>
                <span className="font-mono text-xs text-green-600">{headLabel}</span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-200">
                {headRemaining ? (
                  <details>
                    <summary className="cursor-pointer truncate hover:text-slate-900 dark:hover:text-slate-100">
                      {headFirstLine}
                    </summary>
                    {headRemaining && (
                      <div className="mt-1 whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                        {headRemaining}
                      </div>
                    )}
                  </details>
                ) : (
                  headFirstLine
                )}
              </div>
              <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {headCommit.author} · {formatDate(headCommit.date)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
