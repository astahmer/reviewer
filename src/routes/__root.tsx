import { useEffect, useMemo } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useGlobalColorMode } from "~/components/hooks";
import { ErrorBoundary } from "~/components/error-boundary";
import appCss from "../styles/global.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Reviewer",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const [globalColorMode] = useGlobalColorMode();
  const resolvedColorMode = useMemo(() => {
    if (typeof window === "undefined") {
      return globalColorMode === "auto" ? "light" : globalColorMode;
    }

    if (globalColorMode !== "auto") {
      return globalColorMode;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, [globalColorMode]);

  useEffect(() => {
    document.documentElement.dataset.appColorMode = resolvedColorMode;
    document.body.dataset.appColorMode = resolvedColorMode;
    document.body.classList.toggle("dark", resolvedColorMode === "dark");
  }, [resolvedColorMode]);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <ErrorBoundary>
          <div className="flex h-full min-h-screen flex-col">{children}</div>
        </ErrorBoundary>
        <Scripts />
      </body>
    </html>
  );
}
