import { Combobox, createListCollection, Popover, Portal, useFilter } from "@ark-ui/react";
import { ChevronDown } from "lucide-react";
import { FC, useRef, useState } from "react";
import { findBranchByName, getBranchDisplayName, getBranchScopeLabel } from "~/lib/branches";
import {
  getCommitDisplayLabel,
  getDefaultCommit,
  getLocalRefDescription,
  isLocalCommit,
} from "~/lib/local-refs";
import { BranchInfo, CommitInfo } from "~/lib/types";
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

const Checkmark = () => (
  <svg
    className="h-4 w-4 flex-shrink-0 text-blue-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export const RevisionSelector: FC<RevisionSelectorProps> = ({
  label,
  branches,
  commits,
  branchValue,
  commitValue,
  onBranchChange,
  onCommitChange,
  defaultBranch,
  placeholder = "Select revision...",
  isBranchLoading = false,
  isCommitLoading = false,
}) => {
  const selectedBranch = findBranchByName(branches, branchValue || defaultBranch);
  const defaultCommit = getDefaultCommit(commits);
  const selectedCommit =
    commits.find((commit) => isSelectedCommit(commitValue, commit.hash)) ||
    (!commitValue && defaultCommit ? defaultCommit : undefined);
  const selectedBranchLabel = getBranchDisplayName(selectedBranch);

  const items: RevisionSelectorItem[] = [
    ...branches.map((branch) => ({
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
    ...commits.map((commit) => ({
      kind: "commit" as const,
      id: `commit:${commit.hash}`,
      searchText: [
        commit.hash,
        commit.label || "",
        commit.message,
        commit.author,
        selectedBranchLabel,
      ].join(" "),
      commit,
    })),
  ];

  const itemById = new Map(items.map((item) => [item.id, item]));
  const filters = useFilter({ sensitivity: "base" });
  const collection = createListCollection({
    items,
    itemToString: (item) => item.searchText,
    itemToValue: (item) => item.id,
  });

  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = collection.items.filter((item) =>
    filters.contains(item.searchText, inputValue),
  );
  const branchItems = filteredItems.filter(
    (item): item is BranchRevisionItem => item.kind === "branch",
  );
  const commitItems = filteredItems.filter(
    (item): item is CommitRevisionItem => item.kind === "commit",
  );
  const localCommitItems = commitItems.filter((item) => isLocalCommit(item.commit));
  const groupedCommitItems = commitItems
    .filter((item) => !isLocalCommit(item.commit))
    .reduce(
      (acc, item) => {
        const date = new Date(item.commit.date);
        const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
        if (!acc[monthKey]) {
          acc[monthKey] = [];
        }
        acc[monthKey].push(item);
        return acc;
      },
      {} as Record<string, CommitRevisionItem[]>,
    );

  const selectedValue = selectedCommit
    ? `commit:${selectedCommit.hash}`
    : selectedBranch
      ? `branch:${selectedBranch.name}`
      : "";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (details.open) {
          setInputValue("");
        }
      }}
      positioning={{ placement: "bottom-start", fitViewport: true }}
    >
      <Popover.Trigger asChild>
        <button
          aria-label={`${label} revision selector`}
          className="flex w-[17.5rem] items-center justify-between gap-2 rounded-xl border border-slate-300 bg-[var(--app-panel)] px-3 py-2 text-xs shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50 sm:w-[18.25rem] xl:w-[19rem] dark:border-slate-700 dark:hover:bg-slate-800 dark:data-[state=open]:bg-blue-950/40"
        >
          <span className="min-w-0 flex-1 truncate text-left text-slate-900 dark:text-slate-100">
            {selectedCommit
              ? getCommitDisplayLabel(selectedCommit)
              : selectedBranch
                ? getBranchDisplayName(selectedBranch)
                : isBranchLoading || isCommitLoading
                  ? "Loading..."
                  : placeholder}
          </span>
          {selectedCommit && selectedBranchLabel ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {selectedBranchLabel}
            </span>
          ) : null}
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner style={{ zIndex: 50 }}>
          <Popover.Content
            data-testid={`${label.toLowerCase()}-revision-menu`}
            className="w-[min(38rem,calc(100vw-2rem))] max-w-[38rem] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--app-panel)] text-slate-800 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.7)] dark:border-slate-700 dark:text-slate-100"
          >
            <Combobox.Root
              openOnClick
              loopFocus
              inputBehavior="autohighlight"
              collection={collection}
              value={selectedValue ? [selectedValue] : []}
              onValueChange={(details) => {
                const item = itemById.get(details.value[0] as string);
                if (!item) {
                  return;
                }

                if (item.kind === "branch") {
                  onBranchChange(item.branch.name);
                } else {
                  onCommitChange(item.commit.hash);
                }
                setOpen(false);
              }}
              onInputValueChange={(details) => setInputValue(details.inputValue)}
            >
              <Combobox.Control className="relative border-b border-slate-200 dark:border-slate-700">
                <Combobox.Input
                  ref={inputRef}
                  autoFocus
                  aria-label={`${label} revision search`}
                  className="w-full bg-[var(--app-panel)] px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
                  placeholder="Search branches and commits..."
                />
              </Combobox.Control>
              <Combobox.List className="max-h-[70vh] w-full overflow-y-auto p-1.5">
                <Combobox.Empty className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
                  No revisions found
                </Combobox.Empty>
                <Combobox.Context>
                  {(api) => (
                    <>
                      {branchItems.length > 0 ? (
                        <div>
                          <div className="sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                            Branches
                          </div>
                          {branchItems.map((item) => {
                            const isActive = item.branch.name === selectedBranch?.name;
                            return (
                              <Combobox.Item
                                key={item.id}
                                item={item}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 data-[highlighted]:bg-slate-50 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800"
                                onClick={() => api.selectValue(item.id)}
                              >
                                <div className="min-w-0 flex-1 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                                      {getBranchDisplayName(item.branch)}
                                    </span>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                      {getBranchScopeLabel(item.branch)}
                                    </span>
                                    {defaultBranch === item.branch.name ? (
                                      <span className="text-slate-500 dark:text-slate-500">
                                        default
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500">
                                    <span>{formatDate(item.branch.latestCommit.date)}</span>
                                    <span>·</span>
                                    <span>{item.branch.latestCommit.author}</span>
                                  </div>
                                  <div className="truncate text-slate-700 dark:text-slate-300">
                                    {item.branch.latestCommit.message || "No commits"}
                                  </div>
                                </div>
                                {isActive ? <Checkmark /> : null}
                              </Combobox.Item>
                            );
                          })}
                        </div>
                      ) : null}

                      {localCommitItems.length > 0 ? (
                        <div>
                          <div className="sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                            Local changes
                          </div>
                          {localCommitItems.map((item) => {
                            const isActive = selectedCommit
                              ? isSelectedCommit(selectedCommit.hash, item.commit.hash)
                              : false;
                            return (
                              <Combobox.Item
                                key={item.id}
                                item={item}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 data-[highlighted]:bg-slate-50 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800"
                                onClick={() => api.selectValue(item.id)}
                              >
                                <div className="min-w-0 flex-1 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-amber-700 dark:text-amber-300">
                                      {getCommitDisplayLabel(item.commit)}
                                    </span>
                                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                      local
                                    </span>
                                  </div>
                                  <div className="truncate text-slate-600 dark:text-slate-300">
                                    {getLocalRefDescription(item.commit.hash)}
                                  </div>
                                </div>
                                {isActive ? <Checkmark /> : null}
                              </Combobox.Item>
                            );
                          })}
                        </div>
                      ) : null}

                      {Object.entries(groupedCommitItems).map(([month, items]) => (
                        <div key={month}>
                          <div className="sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                            {month}
                          </div>
                          {items.map((item) => {
                            const isActive = selectedCommit
                              ? isSelectedCommit(selectedCommit.hash, item.commit.hash)
                              : false;
                            return (
                              <Combobox.Item
                                key={item.id}
                                item={item}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 data-[highlighted]:bg-slate-50 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800"
                                onClick={() => api.selectValue(item.id)}
                              >
                                <div className="min-w-0 flex-1 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-blue-600 dark:text-blue-300">
                                      {item.commit.hash.slice(0, 7)}
                                    </span>
                                    {selectedBranchLabel ? (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {selectedBranchLabel}
                                      </span>
                                    ) : null}
                                    <span className="text-slate-500 dark:text-slate-500">
                                      {formatDate(item.commit.date)}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-500">·</span>
                                    <span className="text-slate-500 dark:text-slate-500">
                                      {item.commit.author}
                                    </span>
                                  </div>
                                  <div className="truncate text-slate-700 dark:text-slate-300">
                                    {item.commit.message}
                                  </div>
                                </div>
                                {isActive ? <Checkmark /> : null}
                              </Combobox.Item>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  )}
                </Combobox.Context>
              </Combobox.List>
            </Combobox.Root>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
