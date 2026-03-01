import { FC, useState } from "react";
import { Combobox, createListCollection } from "@ark-ui/react/combobox";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { useFilter } from "@ark-ui/react/locale";
import { ChevronDown } from "lucide-react";

interface Repository {
  path: string;
  name: string;
}

interface RepositorySelectorProps {
  repositories: Repository[];
  selectedRepo: Repository | null;
  onRepoChange: (repo: Repository) => void;
}

export const RepositorySelector: FC<RepositorySelectorProps> = ({
  repositories,
  selectedRepo,
  onRepoChange,
}) => {
  const [repoInputValue, setRepoInputValue] = useState("");
  const [repoOpen, setRepoOpen] = useState(false);

  const filters = useFilter({ sensitivity: "base" });
  const collection = createListCollection({
    items: repositories,
    itemToString: (item: Repository) => item.name,
    itemToValue: (item: Repository) => item.path,
  });

  const filteredRepos = collection.items.filter(
    (repo: Repository) =>
      filters.contains(repo.name, repoInputValue) || filters.contains(repo.path, repoInputValue),
  );

  const handleRepoValueChange = (details: Combobox.ValueChangeDetails) => {
    if (details.value.length > 0) {
      const repo = repositories.find((r: Repository) => r.path === details.value[0]);
      if (repo) {
        onRepoChange(repo);
        setRepoOpen(false);
      }
    }
  };

  return (
    <Popover.Root
      open={repoOpen}
      onOpenChange={(details) => {
        setRepoOpen(details.open);
        if (details.open) {
          setRepoInputValue("");
        }
      }}
      positioning={{ sameWidth: true }}
    >
      <Popover.Trigger asChild>
        <button className="flex w-56 items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50">
          <span className="truncate text-gray-900">
            {selectedRepo?.name || "Select repository..."}
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
              value={selectedRepo ? [selectedRepo.path] : []}
              onValueChange={handleRepoValueChange}
              onInputValueChange={(details) => setRepoInputValue(details.inputValue)}
            >
              <Combobox.Control className="relative border-b border-gray-200">
                <Combobox.Input
                  autoFocus
                  className="w-full bg-white px-2 py-1.5 text-xs outline-none placeholder:text-gray-400 focus:ring-0"
                  placeholder="Search repositories..."
                />
              </Combobox.Control>
              <Combobox.List className="max-h-64 w-full overflow-y-auto p-1">
                <Combobox.Empty className="px-2 py-3 text-center text-xs text-gray-400">
                  No repositories found
                </Combobox.Empty>
                {filteredRepos.map((repo: Repository) => (
                  <Combobox.Item
                    key={repo.path}
                    item={repo}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-50 data-[highlighted]:bg-gray-50 data-[selected]:bg-blue-50"
                  >
                    <span className="truncate">{repo.name}</span>
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
