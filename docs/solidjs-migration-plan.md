# SolidJS Migration Plan

## Recommendation

Keep the current TanStack Start architecture and migrate the UI framework layer from React to Solid.

That means:

- keep the VCS adapters, Effect services, server functions, diff parsing, and route structure
- replace the React runtime, router bindings, query bindings, and UI primitives with their Solid equivalents
- treat the diff renderer as the main blocker, because the app currently depends on `@pierre/diffs/react`

This is the lowest-risk path because the current app is already organized around framework-agnostic backend code and TanStack file routes.

## What Can Stay

These areas are already mostly framework-agnostic and should not be rewritten first:

- `src/adapters/**`
- `src/effects/**`
- `src/server/diff-reviewer.start.ts`
- `src/lib/branches.ts`
- `src/lib/local-refs.ts`
- `src/lib/types.ts`
- the JJ and Git adapter work
- Playwright-BDD end-to-end coverage
- most Vitest unit tests that target non-UI logic

The migration should focus on `src/router.tsx`, `src/routes/**`, `src/pages/**`, and `src/components/**`.

## Verified Replacement Matrix

Package availability was verified during this task with `pnpm view` and the TanStack reference repo under `.context/tanstack-router`.

| Current package or usage                                         | Recommended replacement                                | Notes                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react`                                                          | `solid-js`                                             | Core UI runtime replacement.                                                                                                                                |
| `react-dom`                                                      | `solid-js/web`                                         | Use Solid render and hydration APIs instead of React DOM.                                                                                                   |
| `@vitejs/plugin-react`                                           | `vite-plugin-solid`                                    | TanStack's Solid examples use this with `solid({ ssr: true })`.                                                                                             |
| `@tanstack/react-start`                                          | `@tanstack/solid-start`                                | Best fit because it preserves the current Start-based SSR, server functions, and API route model.                                                           |
| `@tanstack/react-router`                                         | `@tanstack/solid-router`                               | File-based routes, `createFileRoute`, `createRootRouteWithContext`, `Link`, and router context all exist in Solid.                                          |
| `@tanstack/react-router-ssr-query`                               | `@tanstack/solid-router-ssr-query`                     | Verified in TanStack repo and docs. This keeps the current router/query SSR integration model.                                                              |
| `@tanstack/react-query`                                          | `@tanstack/solid-query`                                | Direct equivalent for `QueryClient`, `useQuery`, `useInfiniteQuery`, and devtools.                                                                          |
| `@tanstack/react-pacer`                                          | `@tanstack/pacer` or a local debounce helper           | Current code only uses `debounce` in `src/query-client.ts`, not React hooks. Do not keep a UI-bound pacer package unless you start using Solid pacer hooks. |
| `@ark-ui/react`                                                  | `@ark-ui/solid`                                        | Recommended for parity with the current `Combobox`, `Popover`, `Portal`, `Tooltip`, `Menu`, and `Splitter` usage.                                           |
| `lucide-react`                                                   | `lucide-solid`                                         | Direct icon component replacement.                                                                                                                          |
| `@types/react` and `@types/react-dom`                            | remove                                                 | Replace React types with Solid JSX types and component props utilities.                                                                                     |
| `@pierre/diffs/react` import in `src/components/diff-viewer.tsx` | custom Solid renderer around `@pierre/diffs` core data | This is the biggest migration blocker. Keep the parser/core package if possible, replace only the React renderer layer.                                     |

## React-Specific Surface Area In This Repo

These files are the real migration hotspots:

- `src/router.tsx`
  - uses `QueryClientProvider`, `createRouter`, and `setupRouterSsrQueryIntegration`
- `src/routes/__root.tsx`
  - uses React effects, `React.ReactNode`, and a React class error boundary wrapper
- `src/pages/home-page.tsx`
  - concentrates routing, query orchestration, local state, and selector synchronization
- `src/components/diff-viewer.tsx`
  - largest interactive component and the most likely performance hotspot
- `src/components/file-tree-sidebar.tsx`
  - large tree view with Ark splitters and lots of stateful UI
- `src/components/repository-selector.tsx`
  - Ark combobox and popover behavior
- `src/components/revision-selector.tsx`
  - Ark combobox and popover behavior with large lists
- `src/components/hooks.ts`
  - React-localStorage synchronization hooks that need Solid signal/effect equivalents
- `src/components/error-boundary.tsx`
  - pure React class component pattern; this does not port 1:1
- `src/query-client.ts`
  - query client wiring and debounced invalidation logic

## Current Performance Reality

Migrating to Solid is reasonable, but the current performance profile is not only a React problem.

The likely hot paths are:

- `src/components/diff-viewer.tsx`
  - very large component, many local states, and broad rerender scope
- `src/components/file-tree-sidebar.tsx`
  - tree, timeline, viewed-state updates, and splitters all update inside one React subtree
- `src/pages/home-page.tsx`
  - multiple queries plus synchronization effects for base/head branch and commit state
- `@pierre/diffs/react`
  - React renderer for large diff content is likely a meaningful part of the cost
- raw DOM volume
  - Solid will reduce wasted rerenders, but it will not make tens of thousands of visible DOM nodes cheap by itself

So the honest expectation is:

- Solid should improve interaction cost, selector responsiveness, and rerender fan-out
- Solid will not fully solve heavy diff rendering if the DOM and diff-view surface stay the same size

If you do this migration, measure before and after:

- initial route load time
- base/head revision switch latency
- file tree selection latency
- scroll FPS in large diffs
- time-to-interactive after changing commit range

## Recommended Target Stack

Use this as the target stack:

- `solid-js`
- `vite-plugin-solid`
- `@tanstack/solid-start`
- `@tanstack/solid-router`
- `@tanstack/solid-router-ssr-query`
- `@tanstack/solid-query`
- `@ark-ui/solid`
- `lucide-solid`
- `@tanstack/pacer` only if you want to keep the current debounce helper as a dependency

For TanStack packages, keep them on one aligned release line rather than mixing unrelated latest versions.

## Migration Strategy

### Phase 0: Baseline And Prep

Before changing frameworks:

- capture perf baselines on large local diffs
- isolate `@pierre/diffs/react` usage behind a thinner local component boundary if possible
- keep backend tests green and add one or two UI-level performance scenarios to Playwright if you want a regression bar

No architecture work should happen in the backend during this phase.

### Phase 1: Shell Swap

Replace the framework shell first:

- swap Vite plugin from React to Solid
- move from `@tanstack/react-start/plugin/vite` to `@tanstack/solid-start/plugin/vite`
- switch route imports from `@tanstack/react-router` to `@tanstack/solid-router`
- move query integration from `@tanstack/react-router-ssr-query` to `@tanstack/solid-router-ssr-query`
- migrate `src/router.tsx` following the Solid TanStack examples in `.context/tanstack-router`
- port `src/routes/__root.tsx` to Solid root document patterns with `HeadContent`, `Scripts`, and `HydrationScript`

Expected outcome:

- the app still uses the same routes and server functions
- the UI entrypoint is now Solid-based

### Phase 2: Replace Shared UI Infrastructure

Convert the framework-wide helpers before touching the biggest screens:

- rewrite `src/components/hooks.ts` using `createSignal`, `createMemo`, `createEffect`, and `onCleanup`
- replace `React.ReactNode`, `FC`, and class components with Solid component signatures
- replace `src/components/error-boundary.tsx` with a Solid boundary strategy

Recommendation:

- use TanStack Router's default error handling for route-level failures
- use Solid's error boundary component for local UI boundaries

### Phase 3: Port Simple Components First

Port low-risk components before the heavy view layer:

- `src/components/error-banner.tsx`
- `src/components/commit-compare.tsx`
- `src/components/tooltip.tsx`
- `src/components/repository-selector.tsx`
- `src/components/revision-selector.tsx`

Reason:

- this validates `@ark-ui/solid` parity early
- it flushes out JSX and prop-system differences before you touch the large diff view

### Phase 4: Port Query And Router Consumers

Convert the page-level orchestration next:

- `src/pages/home-page.tsx`
- `src/routes/index.tsx`

Specific work here:

- replace `useQuery` and `useInfiniteQuery` imports with Solid Query equivalents
- convert memoized derivations to Solid `createMemo`
- replace React effects with Solid `createEffect`
- reduce broad state writes so the migration actually benefits from Solid's fine-grained reactivity

Do not mechanically translate every `useEffect` into `createEffect` without revisiting the dependency model.

### Phase 5: Port The Heavy UI Surfaces

Then move the large components:

- `src/components/file-tree-sidebar.tsx`
- `src/components/commit-history-panel.tsx`
- `src/components/diff-viewer.tsx`

This is where the Solid migration pays off, but only if you also split some coarse component boundaries.

Recommended rule:

- break `diff-viewer.tsx` into smaller reactive islands during the port instead of carrying over the same monolith unchanged

### Phase 6: Replace The Diff Renderer

This is the hard part.

Current state:

- parsing comes from `@pierre/diffs`
- rendering comes from `@pierre/diffs/react`
- the app already stores `pierreData`, which is a good seam for replacing the renderer

Recommended pick:

- keep `@pierre/diffs` parsing/core data
- replace `@pierre/diffs/react` with a local Solid renderer built around the parsed file and hunk metadata you already have

Fallback options if that proves too expensive:

- temporarily wrap the React renderer as an isolated island while the rest of the app migrates
- or switch to a different diff renderer that already supports Solid, if one meets your UX requirements

I would not block the entire migration on waiting for an upstream Solid renderer to appear.

### Phase 7: Remove React Completely

Once every route and component is ported:

- remove `react`, `react-dom`, `@types/react`, `@types/react-dom`, and `@vitejs/plugin-react`
- regenerate route tree files with Solid imports
- rerun Playwright-BDD and Vitest
- compare the new perf baselines against the React version

## File-By-File Notes

### `src/router.tsx`

Direct replacement path:

- `QueryClientProvider` from `@tanstack/solid-query`
- `createRouter` from `@tanstack/solid-router`
- `setupRouterSsrQueryIntegration` from `@tanstack/solid-router-ssr-query`

This file should be one of the first ports because the Solid equivalent is very close to the current structure.

### `src/routes/__root.tsx`

Main differences:

- `React.ReactNode` becomes Solid children typing
- `useEffect` becomes `createEffect`
- route/root error handling should move away from the class boundary
- if you want the Solid Start root pattern, include `HydrationScript` in the document shell

### `src/query-client.ts`

This file is easy to port.

Recommended change:

- replace `@tanstack/react-query` with `@tanstack/solid-query`
- replace `@tanstack/react-pacer` with `@tanstack/pacer` or a local debounce utility

### `src/components/error-boundary.tsx`

Do not port this class component literally.

Pick one of these instead:

- route-level default error components in TanStack Router
- Solid `<ErrorBoundary>` for local subtree recovery

### `src/components/repository-selector.tsx` and `src/components/revision-selector.tsx`

These should map well to `@ark-ui/solid`, but verify:

- combobox collection APIs
- popover positioning props
- portal behavior
- `asChild` semantics

### `src/components/file-tree-sidebar.tsx` and `src/components/diff-viewer.tsx`

These are the places where you should expect real migration effort.

They use:

- Ark `Splitter`
- menus and portals
- large prop surfaces
- mutable refs and scroll effects
- wide fan-out state updates

Port them after the shell, query, and selector layers are already stable.

## Risks

### High risk

- `@pierre/diffs/react` has no proven Solid renderer in this repo today
- `diff-viewer.tsx` is large enough that a naive port can preserve the current performance problems

### Medium risk

- Ark UI component parity for the exact `Splitter` and menu usage patterns
- SSR and hydration behavior around theme and localStorage state
- route shell and error-boundary behavior changes

### Low risk

- router import swaps
- query client swap
- icon replacement
- route tree regeneration

## Recommended Execution Order

If you want the migration to be pragmatic rather than heroic, do it in this order:

1. Benchmark the current app.
2. Swap the TanStack shell to Solid Start.
3. Port shared hooks and root document.
4. Port selectors and other low-risk UI primitives.
5. Port `HomePage` query orchestration.
6. Port sidebar and diff viewer.
7. Replace the React diff renderer.
8. Remove React and compare perf baselines.

## Suggested Go Or No-Go Rule

Proceed with the migration if both statements are true:

- the real pain is rerender fan-out and interaction lag in the current UI layer
- you are willing to own a custom Solid diff renderer or a temporary bridge for `@pierre/diffs/react`

If the real bottleneck is mostly raw DOM size and large diff rendering, then Solid is still useful, but you should plan a second optimization pass after migration for incremental rendering or virtualization.
