import { FC } from "react";

interface ErrorBannerProps {
  error: Error | null;
  message?: string;
}

export const ErrorBanner: FC<ErrorBannerProps> = ({ error, message }) => {
  if (!error) return null;

  return (
    <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
      {message || error.message || "An error occurred"}
    </div>
  );
};
