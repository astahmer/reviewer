import { FC, type PropsWithChildren } from "react";

interface EmptyStateProps extends PropsWithChildren {
  message?: string;
}

export const EmptyState: FC<EmptyStateProps> = ({
  children,
  message = "Select a repository to get started.",
}) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded border border-slate-200 bg-[var(--app-panel)] p-6 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:text-slate-300">
      <div className="text-center">
        <p className="mb-2 font-medium text-slate-800 dark:text-slate-100">{message}</p>
        {children}
      </div>
    </div>
  );
};
