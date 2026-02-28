import { FC, useMemo, useState, useRef, useEffect } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const detectedDefault = useMemo(() => {
    if (defaultBranch && branches.includes(defaultBranch)) return defaultBranch;
    return branches.find((b) => DEFAULT_BRANCHES.includes(b.toLowerCase())) || branches[0];
  }, [branches, defaultBranch]);

  const filteredBranches = useMemo(() => {
    if (!search) return branches;
    const lower = search.toLowerCase();
    return branches.filter((b) => b.toLowerCase().includes(lower));
  }, [branches, search]);

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

  const handleSelect = (branch: string) => {
    onChange(branch);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className={value ? "font-mono text-gray-900" : "text-gray-400"}>
          {value || placeholder}
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
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-1">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branches..."
              className="w-full px-2 py-1 text-xs outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredBranches.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-gray-400">No branches found</div>
            ) : (
              <>
                {detectedDefault && !search && !filteredBranches.includes(value) && (
                  <button
                    type="button"
                    onClick={() => handleSelect(detectedDefault)}
                    className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50"
                  >
                    <span>Default: {detectedDefault}</span>
                    <span className="text-blue-400">Use</span>
                  </button>
                )}
                {filteredBranches.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => handleSelect(branch)}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-gray-50 ${
                      branch === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                    }`}
                  >
                    <span className="font-mono truncate">{branch}</span>
                    {branch === detectedDefault && !search && (
                      <span className="text-xs text-blue-400">default</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
