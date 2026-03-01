import { FC } from "react";

interface Repository {
  path: string;
  name: string;
}

interface EmptyStateProps {
  message?: string;
  repositories?: Repository[];
  onRepoSelect?: (repo: Repository) => void;
}

export const EmptyState: FC<EmptyStateProps> = ({
  message = "Select a repository to get started.",
  repositories,
  onRepoSelect,
}) => {
  return (
    <div className="h-full rounded border border-gray-200 bg-white flex flex-col items-center justify-center text-gray-600 text-sm gap-4">
      <div>{message}</div>
      {repositories && repositories.length > 0 && onRepoSelect && (
        <select
          onChange={(e) => {
            const repo = repositories.find((r) => r.path === e.target.value);
            if (repo) onRepoSelect(repo);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 hover:border-gray-400"
        >
          <option value="">Choose a repository...</option>
          {repositories.map((repo) => (
            <option key={repo.path} value={repo.path}>
              {repo.name} ({repo.path})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
