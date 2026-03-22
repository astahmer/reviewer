import { Combobox, createListCollection, Popover, Portal, useFilter } from "@ark-ui/react";
import { ChevronDown } from "lucide-react";
import { FC, useRef, useState } from "react";
import { BranchInfo } from "~/lib/types";
import { formatDate } from "./format-date";

interface BranchSelectorProps {
  branches: BranchInfo[];
  value: string;
  onChange: (branch: string) => void;
  defaultBranch?: string;
  placeholder?: string;
  isLoading?: boolean;
}

const DEFAULT_BRANCHES = ["main", "master", "develop", "dev", "release"];

export const BranchSelector: FC<BranchSelectorProps> = ({
  branches,
  value,
  onChange,
  defaultBranch,
  placeholder = "Select branch...",
  isLoading = false,
}) => {
  const detectedDefault =
    defaultBranch && branches.some((b) => b.name === defaultBranch)
      ? defaultBranch
      : branches.find((b) => DEFAULT_BRANCHES.includes(b.name.toLowerCase()))?.name ||
        branches[0]?.name;

  const selectedBranch = branches.find(
    (b) => b.name === value || (b.name === detectedDefault && !value),
  );

  const filters = useFilter({ sensitivity: "base" });
  const collection = createListCollection({
    items: branches,
    itemToString: (item) => item.name,
    itemToValue: (item) => item.name,
  });

  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = collection.items.filter(
    (branch) =>
      filters.contains(branch.name, inputValue) ||
      filters.contains(branch.latestCommit.message, inputValue) ||
      filters.contains(branch.latestCommit.author, inputValue),
  );

  // Group items by month
  const groupedItems = filteredItems.reduce(
    (acc, branch) => {
      const date = new Date(branch.latestCommit.date);
      const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(branch);
      return acc;
    },
    {} as Record<string, BranchInfo[]>,
  );

  const selectedValue = selectedBranch?.name || detectedDefault || "";

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
        <button className="flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-[var(--app-panel)] px-2 py-1.5 text-xs shadow-sm hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:data-[state=open]:bg-blue-950/40">
          <span className="truncate text-slate-900 dark:text-slate-100">
            {selectedBranch ? selectedBranch.name : isLoading ? "Loading..." : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content className="overflow-hidden rounded-md border border-slate-200 bg-[var(--app-panel)] text-slate-800 shadow-lg dark:border-slate-700 dark:text-slate-100">
            <Combobox.Root
              openOnClick
              loopFocus
              inputBehavior="autohighlight"
              collection={collection}
              value={selectedValue ? [selectedValue] : []}
              onValueChange={(details) => {
                const branchName = details.value[0] as string;
                onChange(branchName || "");
                setOpen(false);
              }}
              onInputValueChange={(details) => setInputValue(details.inputValue)}
            >
              <Combobox.Control className="relative border-b border-slate-200 dark:border-slate-700">
                <Combobox.Input
                  ref={inputRef}
                  autoFocus
                  className="w-full bg-[var(--app-panel)] px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
                  placeholder={placeholder}
                />
              </Combobox.Control>
              <Combobox.List className="max-h-60 w-full overflow-y-auto p-1">
                <Combobox.Empty className="px-2 py-3 text-center text-xs text-slate-500 dark:text-slate-500">
                  No branches found
                </Combobox.Empty>
                <Combobox.Context>
                  {(api) => (
                    <>
                      {detectedDefault && value !== detectedDefault && (
                        <Combobox.Item
                          item={detectedDefault}
                          className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 data-[highlighted]:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40 dark:data-[highlighted]:bg-blue-950/40"
                          onClick={() => api.selectValue(detectedDefault)}
                        >
                          <Combobox.ItemText>Default: {detectedDefault}</Combobox.ItemText>
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
                      )}
                      {Object.entries(groupedItems).map(([month, branches]) => (
                        <div key={month}>
                          <div className="sticky top-0 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                            {month}
                          </div>
                          {branches.map((branch: BranchInfo) => (
                            <Combobox.Item
                              key={branch.name}
                              item={branch}
                              className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-slate-50 data-[highlighted]:bg-slate-50 data-[selected]:bg-blue-50 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800 dark:data-[selected]:bg-blue-950/40"
                              onClick={() => api.selectValue(branch.name)}
                            >
                              <div className="min-w-0 flex-1 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                                    {branch.name}
                                  </span>
                                  {detectedDefault === branch.name && (
                                    <span className="text-slate-500 dark:text-slate-500">
                                      (default)
                                    </span>
                                  )}
                                  <span className="text-slate-500 dark:text-slate-500">·</span>
                                  <span className="text-slate-500 dark:text-slate-500">
                                    {formatDate(branch.latestCommit.date)}
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-500">·</span>
                                  <span className="text-slate-500 dark:text-slate-500">
                                    {branch.latestCommit.author}
                                  </span>
                                </div>
                                <div className="truncate text-slate-700 dark:text-slate-300">
                                  {branch.latestCommit.message}
                                </div>
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
                          ))}
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
