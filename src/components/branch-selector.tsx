import { FC, useMemo } from "react";
import { Select, createListCollection } from "@ark-ui/react";

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

  const selectedValue = branches.includes(value) ? value : "";

  return (
    <Select.Root
      collection={collection}
      value={selectedValue ? [selectedValue] : []}
      onValueChange={(details) => onChange(details.value[0] || "")}
    >
      <Select.Trigger className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
        <Select.ValueText placeholder={placeholder}>
          <span className={selectedValue ? "font-mono" : "text-gray-400"}>
            {selectedValue || placeholder}
          </span>
        </Select.ValueText>

        <Select.Indicator className="ml-1">
          <svg
            className="h-3 w-3 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Select.Indicator>
      </Select.Trigger>
      <Select.Positioner>
        <Select.Content className="max-h-64 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <Select.List className="max-h-48 overflow-y-auto p-1">
            {detectedDefault && (
              <Select.Item
                item={detectedDefault}
                className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 data-[highlighted]:bg-blue-50"
              >
                <Select.ItemText>Default: {detectedDefault}</Select.ItemText>
                <Select.ItemIndicator>Use</Select.ItemIndicator>
              </Select.Item>
            )}
            {branches.map((branch) => (
              <Select.Item
                key={branch}
                item={branch}
                className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gray-50 data-[highlighted]:bg-gray-50 data-[selected]:bg-blue-50 data-[selected]:text-blue-700"
              >
                <Select.ItemText>
                  <span className="font-mono truncate">{branch}</span>
                </Select.ItemText>
                {branch === detectedDefault && (
                  <Select.ItemIndicator className="text-xs text-blue-400">
                    default
                  </Select.ItemIndicator>
                )}
              </Select.Item>
            ))}
          </Select.List>
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
};
