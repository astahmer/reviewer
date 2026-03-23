import { Combobox, createListCollection, Popover, Portal, useFilter } from "@ark-ui/react";
import { ChevronDown } from "lucide-react";
import { FC, useRef, useState } from "react";
import {
  getCommitDisplayLabel,
  getDefaultCommit,
  getLocalRefDescription,
  isLocalCommit,
} from "~/lib/local-refs";
import { CommitInfo } from "~/lib/types";
import { formatDate } from "./format-date";

interface CommitSelectorProps {
  commits: CommitInfo[];
  value: string;
  onChange: (commitHash: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const CommitSelector: FC<CommitSelectorProps> = ({
  commits,
  value,
  onChange,
  isLoading,
  placeholder = "Select commit...",
}) => {
  const defaultCommit = getDefaultCommit(commits);

  const selectedCommit =
    commits.find((c) => c.hash === value || c.hash.startsWith(value)) ||
    (!value && defaultCommit ? defaultCommit : undefined);

  const filters = useFilter({ sensitivity: "base" });
  const collection = createListCollection({
    items: commits,
    itemToString: (item) => `${getCommitDisplayLabel(item)} ${item.message} ${item.author}`,
    itemToValue: (item) => item.hash,
  });

  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = collection.items.filter(
    (commit) =>
      filters.contains(commit.hash, inputValue) ||
      filters.contains(commit.label || "", inputValue) ||
      filters.contains(commit.message, inputValue) ||
      filters.contains(commit.author, inputValue),
  );

  // Group local snapshots separately so they stay visible above commit history.
  const groupedItems = filteredItems.reduce(
    (acc, commit) => {
      if (isLocalCommit(commit)) {
        if (!acc["Local changes"]) {
          acc["Local changes"] = [];
        }
        acc["Local changes"].push(commit);
        return acc;
      }

      const date = new Date(commit.date);
      const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(commit);
      return acc;
    },
    {} as Record<string, CommitInfo[]>,
  );

  const selectedValue = selectedCommit?.hash || defaultCommit?.hash || "";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (details.open) {
          setInputValue("");
        }
      }}
      // positioning={{ sameWidth: true }}
    >
      <Popover.Trigger asChild>
        <button className="flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-[var(--app-panel)] px-2 py-1.5 text-xs font-mono shadow-sm hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:data-[state=open]:bg-blue-950/40">
          <span className="truncate text-slate-900 dark:text-slate-100">
            {selectedCommit
              ? getCommitDisplayLabel(selectedCommit)
              : isLoading
                ? "Loading..."
                : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner style={{ zIndex: 50 }}>
          <Popover.Content className="overflow-hidden rounded-md border border-slate-200 bg-[var(--app-panel)] text-slate-800 shadow-lg dark:border-slate-700 dark:text-slate-100">
            <Combobox.Root
              openOnClick
              loopFocus
              inputBehavior="autohighlight"
              collection={collection}
              value={selectedValue ? [selectedValue] : []}
              onValueChange={(details) => {
                const hash = details.value[0] as string;
                onChange(hash || "");
                setOpen(false);
              }}
              onInputValueChange={(details) => setInputValue(details.inputValue)}
            >
              <Combobox.Control className="relative border-b border-slate-200 dark:border-slate-700">
                <Combobox.Input
                  ref={inputRef}
                  autoFocus
                  className="w-full bg-[var(--app-panel)] px-2 py-1.5 text-xs font-mono text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
                  placeholder={placeholder}
                />
              </Combobox.Control>
              <Combobox.List className="max-h-60 w-full overflow-y-auto p-1">
                <Combobox.Empty className="px-2 py-3 text-center text-xs text-slate-500 dark:text-slate-500">
                  No commits found
                </Combobox.Empty>
                {Object.entries(groupedItems).map(([month, commitList]) => (
                  <div key={month}>
                    <div className="sticky top-0 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                      {month}
                    </div>
                    <Combobox.Context>
                      {(api) =>
                        commitList.map((commit) => (
                          <Combobox.Item
                            key={commit.hash}
                            item={commit}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-slate-50 data-[highlighted]:bg-slate-50 data-[selected]:bg-blue-50 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800 dark:data-[selected]:bg-blue-950/40"
                            onClick={() => api.selectValue(commit.hash)}
                          >
                            <div className="min-w-0 flex-1 text-xs">
                              {isLocalCommit(commit) ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-amber-700 dark:text-amber-300">
                                      {getCommitDisplayLabel(commit)}
                                    </span>
                                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                      local
                                    </span>
                                  </div>
                                  <div className="truncate text-slate-600 dark:text-slate-300">
                                    {getLocalRefDescription(commit.hash)}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-blue-600 dark:text-blue-300">
                                      {commit.hash.slice(0, 7)}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-500">
                                      {formatDate(commit.date)}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-500">·</span>
                                    <span className="text-slate-500 dark:text-slate-500">
                                      {commit.author}
                                    </span>
                                  </div>
                                  <div className="truncate text-slate-700 dark:text-slate-300">
                                    {commit.message}
                                  </div>
                                </>
                              )}
                            </div>
                            <Combobox.ItemIndicator>
                              <svg
                                className="h-4 w-4 flex-shrink-0 text-blue-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </Combobox.ItemIndicator>
                          </Combobox.Item>
                        ))
                      }
                    </Combobox.Context>
                  </div>
                ))}
              </Combobox.List>
            </Combobox.Root>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
