import { FC } from "react";

interface EmptyStateProps {
  message?: string;
}

export const EmptyState: FC<EmptyStateProps> = ({ message = "Select a repository to get started." }) => {
  return (
    <div className="h-full rounded border border-gray-200 bg-white flex items-center justify-center text-gray-600 text-sm">
      {message}
    </div>
  );
};
