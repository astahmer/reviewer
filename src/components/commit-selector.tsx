import { FC, useMemo } from "react";
import { Combobox, createListCollection } from "@ark-ui/react";
import { CommitInfo } from "~/lib/types";

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
  const selectedCommit = useMemo(() => {
    return commits.find((c) => c.hash === value || c.hash.startsWith(value));
  }, [commits, value]);

  const collection = useMemo(
    () => createListCollection({ items: commits, itemToString: (item) => item.hash }),
    [commits]
  );

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return d.toLocaleDateString();
  };

  return (
    <Combobox.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => {
        const hash = details.value[0] as string;
        onChange(hash || "");
      }}
    >
      <Combobox.Control className="relative">
        <Combobox.Input
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={isLoading ? "Loading..." : selectedCommit ? selectedCommit.hash.slice(0, 7) : placeholder}
          disabled={isLoading}
        />
        <Combobox.Trigger className="absolute right-2 top-1/2 -translate-y-1/2">
          <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Combobox.Trigger>
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Content className="max-h-80 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <Combobox.List className="max-h-60 overflow-y-auto p-1">
            <Combobox.Empty className="px-2 py-3 text-center text-xs text-gray-400">
              No commits found
            </Combobox.Empty>
            {collection.items.map((commit) => (
              <Combobox.Item
                key={commit.hash}
                item={commit}
                className="flex cursor-pointer items-start justify-between gap-2 rounded px-2 py-2 text-left hover:bg-gray-50 data-[highlighted]:bg-gray-50 data-[selected]:bg-blue-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600">{commit.hash.slice(0, 7)}</span>
                    <span className="text-xs text-gray-400">{formatDate(commit.date)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-gray-700">{commit.message}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{commit.author}</div>
                </div>
                <Combobox.ItemIndicator>
                  <svg className="h-4 w-4 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </Combobox.ItemIndicator>
              </Combobox.Item>
            ))}
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Positioner>
    </Combobox.Root>
  );
};
