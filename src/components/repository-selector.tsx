import { FC, useState } from "react";
import { Combobox, createListCollection } from "@ark-ui/react/combobox";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { useFilter } from "@ark-ui/react/locale";
import { ChevronDown, LoaderCircle, Plus } from "lucide-react";

interface Repository {
  path: string;
  name: string;
}

interface RepositorySelectorProps {
  repositories: Repository[];
  selectedRepo: Repository | null;
  onRepoChange: (repo: Repository) => void;
  onAddCustomPath?: (path: string) => void;
  searchRoots?: string[];
  isLoading?: boolean;
  triggerClassName?: string;
  showPath?: boolean;
}

export const RepositorySelector: FC<RepositorySelectorProps> = ({
  repositories,
  selectedRepo,
  onRepoChange,
  onAddCustomPath,
  searchRoots = [],
  isLoading = false,
  triggerClassName = "",
  showPath = true,
}) => {
  const [repoInputValue, setRepoInputValue] = useState("");
  const [repoOpen, setRepoOpen] = useState(false);
  const [showCustomPathInput, setShowCustomPathInput] = useState(false);
  const [customPathInput, setCustomPathInput] = useState("");

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
  const emptyMessage = repoInputValue
    ? `No matches for "${repoInputValue}"`
    : isLoading
      ? "Scanning added folders..."
      : searchRoots.length > 0
        ? "No repositories found in the folders you've added"
        : "Add a folder first";

  const handleRepoValueChange = (details: Combobox.ValueChangeDetails) => {
    if (details.value.length > 0) {
      const repo = repositories.find((r: Repository) => r.path === details.value[0]);
      if (repo) {
        onRepoChange(repo);
        setRepoOpen(false);
      }
    }
  };

  const handleAddCustomPath = () => {
    const path = customPathInput.trim();
    if (path && onAddCustomPath) {
      onAddCustomPath(path);
      setCustomPathInput("");
      setShowCustomPathInput(false);
      setRepoOpen(false);
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
      positioning={{ placement: "bottom-start", fitViewport: true }}
    >
      <Popover.Trigger asChild>
        <button
          className={`flex w-[18rem] max-w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-[var(--app-panel)] px-3 ${showPath ? "py-2" : "py-1.5"} text-xs shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-slate-400 data-[state=open]:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:data-[state=open]:border-slate-600 dark:data-[state=open]:bg-slate-800/80 ${triggerClassName}`}
        >
          <span className="min-w-0 flex-1 text-left">
            <span
              className={`block truncate font-medium text-slate-900 dark:text-slate-100 ${showPath ? "" : "py-0.5"}`}
            >
              {selectedRepo?.name || "Select a repository"}
            </span>
            {showPath ? (
              <span className="block truncate pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {selectedRepo?.path || "Search added folders or add another one"}
              </span>
            ) : null}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
        </button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content className="w-[min(30rem,calc(100vw-2rem))] max-w-[30rem] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--app-panel)] text-slate-800 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.32)] dark:border-slate-700 dark:text-slate-100 dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]">
            {!showCustomPathInput ? (
              <>
                <Combobox.Root
                  openOnClick
                  loopFocus
                  inputBehavior="autohighlight"
                  collection={collection}
                  value={selectedRepo ? [selectedRepo.path] : []}
                  onValueChange={handleRepoValueChange}
                  onInputValueChange={(details) => setRepoInputValue(details.inputValue)}
                >
                  <Combobox.Control className="relative border-b border-slate-200 dark:border-slate-700">
                    <Combobox.Input
                      autoFocus
                      className="w-full bg-[var(--app-panel)] px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
                      placeholder="Search repositories..."
                    />
                  </Combobox.Control>
                  <Combobox.List className="max-h-[24rem] w-full overflow-y-auto p-1.5">
                    <Combobox.Empty className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
                      {emptyMessage}
                    </Combobox.Empty>
                    <Combobox.Context>
                      {(api) =>
                        filteredRepos.map((repo: Repository) => (
                          <Combobox.Item
                            key={repo.path}
                            item={repo}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 data-[highlighted]:bg-slate-50 data-[selected]:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800 dark:data-[selected]:bg-blue-950/40"
                            onClick={() => api.selectValue(repo.path)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{repo.name}</div>
                              <div className="truncate pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {repo.path}
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
                        ))
                      }
                    </Combobox.Context>
                  </Combobox.List>
                </Combobox.Root>
                <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Scanning {searchRoots.length || 1} folder{searchRoots.length === 1 ? "" : "s"}
                    </span>
                  ) : searchRoots.length > 0 ? (
                    <span>
                      Searching {searchRoots.length} folder
                      {searchRoots.length === 1 ? "" : "s"} only
                    </span>
                  ) : (
                    <span>Reviewer searches only the folders you add here.</span>
                  )}
                </div>
                <button
                  onClick={() => setShowCustomPathInput(true)}
                  className="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add folder</span>
                </button>
              </>
            ) : (
              <div className="space-y-3 p-3">
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Add a folder to include in repository search. Reviewer will only look inside this
                  root.
                </p>
                <input
                  autoFocus
                  type="text"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddCustomPath();
                    } else if (e.key === "Escape") {
                      setShowCustomPathInput(false);
                    }
                  }}
                  placeholder="/Users/you/projects"
                  className="w-full rounded-xl border border-slate-300 bg-[var(--app-panel)] px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:text-slate-100"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleAddCustomPath}
                    className="flex-1 rounded-xl bg-blue-500 px-3 py-2 text-xs font-medium text-white hover:bg-blue-600"
                  >
                    Add folder
                  </button>
                  <button
                    onClick={() => setShowCustomPathInput(false)}
                    className="flex-1 rounded-xl bg-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
