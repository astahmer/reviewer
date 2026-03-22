# Pierre Tree Migration Notes

This repo currently uses a temporary local sidebar implementation instead of the upstream `@pierre/trees` package.

## Why the migration is deferred

- `@pierre/diffs` is upgraded and working on `1.1.3`.
- The published `@pierre/trees` package is currently blocked for this repo because the npm release still contains unresolved `catalog:` dependency specifiers.
- `pnpm add @pierre/trees@0.0.1-beta.2` fails in this workspace for that reason.

## Current temporary implementation

- File tree UI lives in [src/components/file-tree-sidebar.tsx](../src/components/file-tree-sidebar.tsx).
- Diff/sidebar orchestration lives in [src/components/diff-viewer.tsx](../src/components/diff-viewer.tsx).
- Vertical commit history lives in [src/components/commit-history-panel.tsx](../src/components/commit-history-panel.tsx).
- Sidebar preferences are persisted through [src/components/hooks.ts](../src/components/hooks.ts) and the `UserPreferences` shape.

## Upstream sources to revisit

- Research repo: `.context/pierre`
- Tree package source: `.context/pierre/packages/trees`
- Tree React entrypoint: `.context/pierre/packages/trees/src/react/FileTree.tsx`
- Tree package docs: `.context/pierre/packages/trees/README.md`

## Expected replacement path

When `@pierre/trees` is republished correctly:

1. Install the package normally.
2. Replace the local file tree portion of [src/components/file-tree-sidebar.tsx](../src/components/file-tree-sidebar.tsx) with `@pierre/trees/react`.
3. Keep the surrounding reviewer-specific shell in [src/components/diff-viewer.tsx](../src/components/diff-viewer.tsx):
   - collapsible sidebar behavior
   - left/right sidebar placement preference
   - commit history footer section
4. Map reviewer state into the upstream tree component:
   - `files`: diff file paths
   - `initialExpandedItems`: current default expanded folder behavior
   - selection callback: scroll to the chosen diff block in the viewer
5. Re-check styling because upstream tree styles are shadow-DOM based and will not inherit the current Tailwind classes.

## Notes for the future swap

- The current sidebar already has the right UX contract: collapsible, positionable, file selection scroll, and auxiliary history content.
- The upstream tree package should replace only the tree rendering logic, not the whole sidebar shell.
- If the npm package stays broken, a fallback option is vendoring the tree source from `.context/pierre/packages/trees` into the app and treating it as an internal component.
