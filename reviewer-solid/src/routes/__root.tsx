/// <reference types="vite/client" />

import type { QueryClient } from "@tanstack/solid-query";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/solid-router";
import { createEffect, type JSX } from "solid-js";
import { HydrationScript } from "solid-js/web";
import { createResolvedGlobalColorMode } from "~/components/hooks";
import appCss from "../styles/global.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
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
        title: "Reviewer Solid",
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

function RootDocument(props: { children: JSX.Element }) {
  const resolvedColorMode = createResolvedGlobalColorMode();

  createEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.appColorMode = resolvedColorMode();
    document.documentElement.classList.toggle("dark", resolvedColorMode() === "dark");
    document.body.dataset.appColorMode = resolvedColorMode();
  });

  return (
    <html
      lang="en"
      data-app-color-mode={resolvedColorMode()}
      class={resolvedColorMode() === "dark" ? "dark" : undefined}
    >
      <head>
        <HydrationScript />
      </head>
      <body data-app-color-mode={resolvedColorMode()}>
        <HeadContent />
        <div class="flex h-full min-h-screen flex-col">{props.children}</div>
        <Scripts />
      </body>
    </html>
  );
}
