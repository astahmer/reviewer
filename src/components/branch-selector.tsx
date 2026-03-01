import { FC, useMemo } from "react";
import { Combobox, Portal, createListCollection } from "@ark-ui/react";

interface BranchSelectorProps {
  branches: string[];
  value: string;
  onChange: (branch: string) => void;
  defaultBranch?: string;
  placeholder?: string;
}

const DEFAULT_BRANCHES = ["main", "master", "develop", "dev", "release"];

export const BranchSelector: FC<BranchSelectorProps> = ({
  branches,
  value,
  onChange,
  defaultBranch,
  placeholder = "Select branch...",
}) => {
  const detectedDefault = useMemo(() => {
    if (defaultBranch && branches.includes(defaultBranch)) return defaultBranch;
    return branches.find((b) => DEFAULT_BRANCHES.includes(b.toLowerCase())) || branches[0];
  }, [branches, defaultBranch]);

  const collection = useMemo(() => createListCollection({ items: branches }), [branches]);

  return (
    <Combobox.Root
      openOnClick
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => {
        const branch = details.value[0] as string;
        onChange(branch || "");
      }}
    >
      <Combobox.Control className="relative">
        <Combobox.Input
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder={value ? "" : placeholder}
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
          <Combobox.Content className="max-h-64 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            <Combobox.List className="max-h-48 overflow-y-auto p-1">
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
              {collection.items.map((branch) => (
                <Combobox.Item
                  key={branch}
                  item={branch}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gray-50 data-[highlighted]:bg-gray-50 data-[selected]:bg-blue-50 data-[selected]:text-blue-700"
                >
                  <Combobox.ItemText>
                    <span className="font-mono truncate">{branch}</span>
                  </Combobox.ItemText>
                  {branch === detectedDefault && (
                    <Combobox.ItemIndicator className="text-xs text-blue-400">
                      default
                    </Combobox.ItemIndicator>
                  )}
                </Combobox.Item>
              ))}
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};
