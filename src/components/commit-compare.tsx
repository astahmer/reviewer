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
            <span className="max-w-xs truncate text-xs text-gray-600" title={baseCommit.message}>
              {baseFirstLine?.slice(0, 50)}
              {(baseFirstLine || "").length > 50 ? "..." : ""}
            </span>
          </div>
          <svg
            className="h-4 w-4 text-gray-400"
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
            <span className="max-w-xs truncate text-xs text-gray-600" title={headCommit.message}>
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
                <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {baseBranch}
                </span>
                {distance !== null && distance > 0 && (
                  <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {distance} commit{distance !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          {baseBranch !== headBranch && (
            <div className="flex gap-1">
              {baseBranch && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
                  {baseBranch}
                </span>
              )}
              <span className="text-gray-400">→</span>
              {headBranch && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
                  {headBranch}
                </span>
              )}
            </div>
          )}
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded bg-white p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">BASE</span>
                <span className="font-mono text-xs text-blue-600">{baseLabel}</span>
              </div>
              <div className="text-xs text-gray-700">
                {baseRemaining ? (
                  <details>
                    <summary className="cursor-pointer truncate hover:text-gray-900">
                      {baseFirstLine}
                    </summary>
                    {baseRemaining && (
                      <div className="mt-1 whitespace-pre-wrap text-gray-500">{baseRemaining}</div>
                    )}
                  </details>
                ) : (
                  baseFirstLine
                )}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {baseCommit.author} · {formatDate(baseCommit.date)}
              </div>
            </div>

            <div className="rounded bg-white p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">HEAD</span>
                <span className="font-mono text-xs text-green-600">{headLabel}</span>
              </div>
              <div className="text-xs text-gray-700">
                {headRemaining ? (
                  <details>
                    <summary className="cursor-pointer truncate hover:text-gray-900">
                      {headFirstLine}
                    </summary>
                    {headRemaining && (
                      <div className="mt-1 whitespace-pre-wrap text-gray-500">{headRemaining}</div>
                    )}
                  </details>
                ) : (
                  headFirstLine
                )}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {headCommit.author} · {formatDate(headCommit.date)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
