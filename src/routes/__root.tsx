import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { ErrorBoundary } from "~/components/error-boundary";

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
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
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
