import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useResolvedGlobalColorMode } from "~/components/hooks";
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
  const resolvedColorMode = useResolvedGlobalColorMode();

  useEffect(() => {
    document.documentElement.dataset.appColorMode = resolvedColorMode;
    document.documentElement.classList.toggle("dark", resolvedColorMode === "dark");
    document.body.dataset.appColorMode = resolvedColorMode;
  }, [resolvedColorMode]);

  return (
    <html
      lang="en"
      data-app-color-mode={resolvedColorMode}
      className={resolvedColorMode === "dark" ? "dark" : undefined}
    >
      <head>
        <HeadContent />
      </head>
      <body data-app-color-mode={resolvedColorMode}>
        <ErrorBoundary>
          <div className="flex h-full min-h-screen flex-col">{children}</div>
        </ErrorBoundary>
        <Scripts />
      </body>
    </html>
  );
}
