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

  const filteredItems = collection.items.filter((branch) =>
    filters.contains(branch.name, inputValue),
  );

  const selectedValue = selectedBranch?.name || detectedDefault || "";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      positioning={{ sameWidth: true }}
    >
      <Popover.Trigger asChild>
        <button className="flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50">
          <span className="truncate text-gray-900">
            {selectedBranch ? selectedBranch.name : isLoading ? "Loading..." : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
        </button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
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
              <Combobox.Control className="relative border-b border-gray-200">
                <Combobox.Input
                  ref={inputRef}
                  autoFocus
                  className="w-full bg-white px-2 py-1.5 text-xs outline-none placeholder:text-gray-400 focus:ring-0"
                  placeholder={placeholder}
                />
              </Combobox.Control>
              <Combobox.List className="max-h-60 w-full overflow-y-auto p-1">
                <Combobox.Empty className="px-2 py-3 text-center text-xs text-gray-400">
                  No branches found
                </Combobox.Empty>
                {detectedDefault && value !== detectedDefault && (
                  <Combobox.Item
                    item={detectedDefault}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 data-[highlighted]:bg-blue-50"
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
                {filteredItems.map((branch: BranchInfo) => (
                  <Combobox.Item
                    key={branch.name}
                    item={branch}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-gray-50 data-[highlighted]:bg-gray-50 data-[selected]:bg-blue-50"
                  >
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-gray-700">{branch.name}</span>
                        {detectedDefault === branch.name && (
                          <span className="text-gray-400">(default)</span>
                        )}
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-400">
                          {formatDate(branch.latestCommit.date)}
                        </span>
                      </div>
                      <div className="truncate text-gray-600">{branch.latestCommit.message}</div>
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
              </Combobox.List>
            </Combobox.Root>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
