interface ErrorBannerProps {
  error: Error | null;
  message?: string;
}

export function ErrorBanner(props: ErrorBannerProps) {
  if (!props.error) {
    return null;
  }

  return (
    <div class="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
      {props.message || props.error.message || "An error occurred"}
    </div>
  );
}