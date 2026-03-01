import { FC, type PropsWithChildren } from "react";

interface EmptyStateProps extends PropsWithChildren {
  message?: string;
}

export const EmptyState: FC<EmptyStateProps> = ({
  children,
  message = "Select a repository to get started.",
}) => {
  return (
    <div className="h-full rounded border border-gray-200 bg-white flex flex-col items-center justify-center text-gray-600 text-sm gap-4 p-6">
      <div className="text-center">
        <p className="font-medium mb-2">{message}</p>
        {children}
      </div>
    </div>
  );
};
