import { QueryClientProvider } from "@tanstack/solid-query";
import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/solid-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/solid-router-ssr-query";
import type { JSX } from "solid-js";
import { parse, stringify } from "zipson";
import { queryClient } from "./query-client";
import { decodeFromBinary, encodeToBinary } from "./router.encode";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultStructuralSharing: true,
    parseSearch: parseSearchWith((value) => parse(decodeFromBinary(value))),
    stringifySearch: stringifySearchWith((value) => encodeToBinary(stringify(value))),
    Wrap: (props: { children: JSX.Element }) => (
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: false,
  });

  return router;
};

declare module "@tanstack/solid-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
