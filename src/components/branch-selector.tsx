import { Combobox, createListCollection, Portal, useFilter } from "@ark-ui/react";
import { FC, useState } from "react";
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
  const filteredItems = collection.items.filter((branch) =>
    filters.contains(branch.name, inputValue),
  );

  const selectedValue = selectedBranch?.name || detectedDefault || "";

  return (
    <Combobox.Root
      openOnClick
      loopFocus
      inputBehavior="autohighlight"
      collection={collection}
      value={selectedValue ? [selectedValue] : []}
      onValueChange={(details) => {
        const branchName = details.value[0] as string;
        onChange(branchName || "");
      }}
      onInputValueChange={(details) => setInputValue(details.inputValue)}
    >
      <Combobox.Control className="relative">
        <Combobox.Input
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={isLoading ? "Loading..." : placeholder}
          disabled={isLoading}
        />
        <Combobox.Trigger className="absolute right-2 top-1/2 -translate-y-1/2">
          <svg
            className="h-3 w-3 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Combobox.Trigger>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content className="max-h-80 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            <Combobox.List className="max-h-60 overflow-y-auto p-1">
              <Combobox.Empty className="px-2 py-3 text-center text-xs text-gray-400">
                No branches found
              </Combobox.Empty>
              {detectedDefault && value !== detectedDefault && (
                <Combobox.Item
                  item={detectedDefault}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 data-[highlighted]:bg-blue-50"
                >
                  <Combobox.ItemText>Default: {detectedDefault}</Combobox.ItemText>
                  <Combobox.ItemIndicator>Use</Combobox.ItemIndicator>
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
                      <span className="text-gray-400">{formatDate(branch.latestCommit.date)}</span>
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
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};
