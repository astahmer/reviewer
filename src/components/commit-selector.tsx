import { FC, useMemo, useState, useRef, useEffect } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCommits = useMemo(() => {
    if (!search) return commits;
    const lower = search.toLowerCase();
    return commits.filter(
      (c) =>
        c.hash.toLowerCase().includes(lower) ||
        c.message.toLowerCase().includes(lower) ||
        c.author.toLowerCase().includes(lower)
    );
  }, [commits, search]);

  const selectedCommit = useMemo(() => {
    return commits.find((c) => c.hash === value || c.hash.startsWith(value));
  }, [commits, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (hash: string) => {
    onChange(hash);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
    setSearch("");
  };

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? "font-mono text-gray-900" : "text-gray-400"}>
          {isLoading ? "Loading..." : selectedCommit ? selectedCommit.hash.slice(0, 7) : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-80 w-96 -translate-x-1/2 left-1/2 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-1">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commits by hash, message, or author..."
              className="w-full px-2 py-1 text-xs outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCommits.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-gray-400">No commits found</div>
            ) : (
              filteredCommits.slice(0, 50).map((commit) => (
                <button
                  key={commit.hash}
                  type="button"
                  onClick={() => handleSelect(commit.hash)}
                  className={`flex w-full items-start justify-between gap-2 px-2 py-2 text-left hover:bg-gray-50 ${
                    commit.hash === value ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-600">{commit.hash.slice(0, 7)}</span>
                      <span className="text-xs text-gray-400">{formatDate(commit.date)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-700">{commit.message}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{commit.author}</div>
                  </div>
                  {commit.hash === value && (
                    <svg className="h-4 w-4 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
          {filteredCommits.length > 50 && (
            <div className="border-t border-gray-100 bg-gray-50 px-2 py-1.5 text-center text-xs text-gray-400">
              Showing 50 of {filteredCommits.length} commits. Refine search to see more.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
