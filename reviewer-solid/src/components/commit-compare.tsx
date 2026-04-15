import { createSignal, Show } from "solid-js";
import { getCommitDisplayLabel, isLocalCommit } from "~/lib/local-refs";
import type { CommitInfo } from "~/lib/types";

interface CommitCompareProps {
  baseCommit: CommitInfo | undefined;
  headCommit: CommitInfo | undefined;
  baseBranchLabel: string;
  headBranchLabel: string;
  isSameBranchComparison: boolean;
  distance: number | null;
}

const formatCommitDate = (date: Date | string) => {
  const resolvedDate = typeof date === "string" ? new Date(date) : date;
  return resolvedDate.toLocaleString();
};

export function CommitCompare(props: CommitCompareProps) {
  const [expanded, setExpanded] = createSignal(false);

  if (!props.baseCommit || !props.headCommit) {
    return null;
  }

  const [headFirstLine, headRemaining] = props.headCommit.message
    .split("\n", 2)
    .map((value) => value.trim());
  const [baseFirstLine, baseRemaining] = props.baseCommit.message
    .split("\n", 2)
    .map((value) => value.trim());
  const baseLabel = getCommitDisplayLabel(props.baseCommit);
  const headLabel = getCommitDisplayLabel(props.headCommit);

  return (
    <div class="rounded-md border border-slate-200 bg-[var(--app-panel)] shadow-sm dark:border-slate-800">
      <button
        type="button"
        onClick={() => setExpanded(!expanded())}
        class="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs text-blue-600">{baseLabel}</span>
            <span
              class="max-w-xs truncate text-xs text-slate-600 dark:text-slate-300"
              title={props.baseCommit.message}
            >
              {baseFirstLine?.slice(0, 50)}
              {(baseFirstLine || "").length > 50 ? "..." : ""}
            </span>
          </div>
          <svg
            class="h-4 w-4 text-slate-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs text-emerald-600">{headLabel}</span>
            <span
              class="max-w-xs truncate text-xs text-slate-600 dark:text-slate-300"
              title={props.headCommit.message}
            >
              {headFirstLine?.slice(0, 50)}
              {(headFirstLine || "").length > 50 ? "..." : ""}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Show
            when={
              props.baseBranchLabel &&
              props.headBranchLabel &&
              props.isSameBranchComparison &&
              !isLocalCommit(props.baseCommit) &&
              !isLocalCommit(props.headCommit)
            }
          >
            <>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {props.baseBranchLabel}
              </span>
              <Show when={props.distance !== null && (props.distance || 0) > 0}>
                <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {props.distance} commit{props.distance !== 1 ? "s" : ""}
                </span>
              </Show>
            </>
          </Show>
          <Show when={!props.isSameBranchComparison}>
            <div class="flex gap-1">
              <Show when={props.baseBranchLabel}>
                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {props.baseBranchLabel}
                </span>
              </Show>
              <span class="text-slate-400 dark:text-slate-500">→</span>
              <Show when={props.headBranchLabel}>
                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {props.headBranchLabel}
                </span>
              </Show>
            </div>
          </Show>
          <svg
            class={`h-4 w-4 text-slate-400 transition-transform dark:text-slate-500 ${expanded() ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <Show when={expanded()}>
        <div class="border-t border-slate-200 bg-[var(--app-panel-muted)] p-3 dark:border-slate-800">
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded bg-[var(--app-panel)] p-2">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">BASE</span>
                <span class="font-mono text-xs text-blue-600">{baseLabel}</span>
              </div>
              <div class="text-xs text-slate-700 dark:text-slate-200">
                <Show
                  when={baseRemaining}
                  fallback={baseFirstLine}
                >
                  <details>
                    <summary class="cursor-pointer truncate hover:text-slate-900 dark:hover:text-slate-100">
                      {baseFirstLine}
                    </summary>
                    <div class="mt-1 whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                      {baseRemaining}
                    </div>
                  </details>
                </Show>
              </div>
              <div class="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {props.baseCommit.author} · {formatCommitDate(props.baseCommit.date)}
              </div>
            </div>

            <div class="rounded bg-[var(--app-panel)] p-2">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">HEAD</span>
                <span class="font-mono text-xs text-emerald-600">{headLabel}</span>
              </div>
              <div class="text-xs text-slate-700 dark:text-slate-200">
                <Show
                  when={headRemaining}
                  fallback={headFirstLine}
                >
                  <details>
                    <summary class="cursor-pointer truncate hover:text-slate-900 dark:hover:text-slate-100">
                      {headFirstLine}
                    </summary>
                    <div class="mt-1 whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                      {headRemaining}
                    </div>
                  </details>
                </Show>
              </div>
              <div class="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {props.headCommit.author} · {formatCommitDate(props.headCommit.date)}
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}