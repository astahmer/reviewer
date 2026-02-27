# Plan: Git Diff Reviewer – Local-First High-Performance Architecture

**TL;DR**: Build a full-stack React application (TanStack Start) for reviewing local git diffs with infinite-scroll virtualization, real-time search, and an adapter-based architecture for future extensibility. Use Effect for type-safe error handling & service composition, TanStack Query for efficient caching, and shadcn/Tailwind for UI. MVP focuses on git + local diffs; support both unified and split views; implement storage + diff-parsing adapters to easily swap implementations later (jj, remote sources, semantic diffing tools).

---

## Architecture Overview

### Adapter/Port Pattern (Using Effect)

The app uses a **service-based architecture** to decouple business logic from implementation details. This allows you to:

- Swap git for jj without touching core review logic
- Switch storage backends (memory → IndexedDB → custom DB)
- Add semantic diffing tools (ast-grep, diffsitter) as alternative diff sources
- Test without external dependencies

**Core Services**:

1. **VCSAdapter** – Git diff fetching (port), multiple implementations (local git, remote GitHub, jj later)
2. **DiffParser** – Parse unified diff format into structured line objects
3. **StorageAdapter** – Persist search indexes, diffs, preferences (memory, IndexedDB, TanStack DB)
4. **SearchEngine** – Real-time filtering with `match-sorter` + opt-in indexed search

### Data Flow

```
User selects commit range (Dashboard)
  ↓
VCSAdapter.getDiff(from, to) [Effect-based, with retry/timeout]
  ↓
DiffParser.parseHunks(rawDiff) [chunked for large files]
  ↓
TanStack Query caches result by (repo, from, to, filters)
  ↓
Virtual scroller renders flattened line array [20px fixed height]
  ↓
Search filters in-memory, updates Query cache (invalidation on filter change)
```

---

## Tech Stack Rationale

| Layer              | Choice                       | Why                                                                                    |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------------- |
| **Framework**      | TanStack Start               | Full-stack, file-based routing, server functions eliminate fetch boilerplate           |
| **State**          | TanStack Query + TanStack DB | Query for server state; DB for local collections, live queries, and reactive mutations |
| **Effects**        | Effect-TS                    | Type-safe error handling, resource management, composable retries/timeouts             |
| **UI Components**  | shadcn/ui                    | Copy-paste control, Tailwind-native, works with custom themes                          |
| **Styling**        | Tailwind CSS                 | Utility-first, fast iteration, integrated with shadcn                                  |
| **Virtual Scroll** | @tanstack/react-virtual      | Headless, supports variable sizing (future: wrapped lines)                             |
| **Search**         | match-sorter                 | Intelligent fuzzy matching; `fuse.js` as optional upgrade path                         |
| **Linting**        | oxc                          | 10-100x faster than ESLint, same config format                                         |
| **Diff Parsing**   | jsdiff + fast-diff           | jsdiff for full features; fast-diff as lightweight fallback                            |

---

## Directory Structure

```
src/
├── adapters/
│   ├── vcs/                          # VCS abstraction
│   │   ├── vcs.interface.ts          # VCSAdapter service interface
│   │   ├── git-local.ts              # Git local implementation (exec git commands)
│   │   ├── git-http.ts               # [Future] GitHub API via HTTP
│   │   └── jj.ts                     # [Future] Jujutsu implementation
│   ├── storage/                      # Storage abstraction
│   │   ├── storage.interface.ts      # StorageAdapter service interface
│   │   ├── memory.ts                 # In-memory (dev/MVP)
│   │   ├── indexeddb.ts              # IndexedDB (production)
│   │   └── tanstack-db.ts            # [Future] TanStack DB if needed
│   └── diff-parser/
│       ├── diff-parser.ts            # Main parser (wraps jsdiff + caches)
│       └── types.ts                  # Line, Hunk, File types
│
├── effects/
│   ├── services/                     # Effect-based business logic
│   │   ├── diff-processor.ts         # Parse + cache diffs via Effect
│   │   ├── search-engine.ts          # Real-time filtering
│   │   └── vcs-service.ts            # VCS adapter wrapper with retry/timeout
│   └── context/                      # Effect Context.Tag definitions
│       ├── vcs-context.ts
│       ├── storage-context.ts
│       └── config-context.ts
│
├── routes/                           # TanStack Start file-based routing
│   ├── index.tsx                     # Dashboard (select commit range)
│   ├── index.start.ts                # Server functions for dashboard
│   ├── [repo].index.tsx              # Async loader fetches diff via Effect
│   ├── [repo].tsx                    # Main review page (diff viewer)
│   ├── [repo].start.ts               # Server functions for diff reviewer
│   ├── components/
│   │   ├── diff-viewer.tsx           # Virtual scroll + split/unified toggle
│   │   ├── search-bar.tsx            # Real-time search + filters
│   │   ├── commit-range-select.tsx   # Commit picker UI
│   │   ├── search-bar.tsx.hooks.ts   # Hooks for search-bar
│   │   └── diff-hunk.tsx             # Single hunk renderer
│   └── _layout.tsx
│
├── components/
│   ├── ui/                           # shadcn copy-pasted components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tabs.tsx                  # Split/unified toggle
│   │   └── ...
│   ├── diff-viewer/
│   │   ├── unified-view.tsx          # Unified diff display
│   │   ├── split-view.tsx            # Side-by-side diff display
│   │   ├── line-renderer.tsx         # Single line with syntax highlight
│   │   └── line-number-gutter.tsx
│   ├── search/
│   │   ├── search-results.tsx
│   │   └── highlight-match.tsx
│   └── common/
│       ├── loading-skeleton.tsx
│       └── error-boundary.tsx
│
├── db/                               # TanStack DB schemas & queries (if using local persistence)
│   ├── schema.ts                     # DB schema definitions
│   └── queries.ts                    # DB query helpers
│
├── lib/
│   ├── diff-utils.ts                 # Convert raw diff to line array for virtualization
│   ├── search-utils.ts               # match-sorter wrapper
│   ├── types.ts                      # Shared types (Diff, Hunk, Line, etc)
│   └── constants.ts                  # Line height (20px), colors, etc
│
├── server/
│   ├── loaders.ts                    # TanStack Start data loaders
│   │   ├── getDiffLoader              # Async loader for diff data
│   │   └── getCommitsLoader           # Async loader for commit list
│   └── actions.ts                    # [Future] Server actions if needed
│
├── styles/
│   └── global.css                    # Tailwind imports, custom utilities
│
└── app.tsx                           # Root provider (QueryClientProvider, etc)
```

---

## Implementation Phases

### Phase 1: Foundation & Setup (Days 1–2)

1. **Project init**: TanStack Start + Vite, install Tailwind, oxc
2. **Add shadcn components**: button, input, select, tabs, dropdown-menu
3. **Define core types** in `lib/types.ts`: `Diff`, `Hunk`, `Line`, `File`
4. **Create Effect adapters interface**:
   - `adapters/vcs/vcs.interface.ts`
   - `adapters/storage/storage.interface.ts`
5. **Implement memory adapters** (for MVP):
   - `adapters/vcs/git-local.ts` – exec `git diff commit1 commit2`
   - `adapters/storage/memory.ts` – Map-based store

**Verification**: Project builds, types compile, no runtime errors on basic imports.

---

### Phase 2: Diff Processing & Caching (Days 2–3)

1. **Implement diff parser**:
   - `adapters/diff-parser/diff-parser.ts` – Use jsdiff, output `Line[][]` (files → hunks → lines)
   - Parse `+` / `-` / ` ` prefixes into line types
2. **Create Effect services**:
   - `effects/services/diff-processor.ts` – Compose parser + storage adapter + error handling
   - `effects/context/storage-context.ts` – Provide StorageAdapter via Context.Tag
3. **Setup TanStack Query + DB**:
   - `app.tsx` – Wrap with QueryClientProvider + DB provider
   - `db/schema.ts` – Define DB collections (cached diffs, preferences)
   - `routes/[repo].start.ts` – Server functions call `diffProcessorEffect.run()`
   - `routes/[repo].index.tsx` – TanStack Start loader uses server functions

**Verification**: Can parse a sample git diff, cache it, retrieve from storage on second load.

---

### Phase 3: Virtual Scroll + Rendering (Days 3–4)

1. **Implement line flattening** `lib/diff-utils.ts`:
   - Flatten file→hunk→line hierarchy into single array for virtualization
   - Add metadata: `{ lineNumber, fileIndex, hunkIndex, type, content, fileOldPath, fileNewPath }`
2. **Create virtual scroller**:
   - `components/diff-viewer/unified-view.tsx` – Use `@tanstack/react-virtual` with fixed 20px height
   - `components/diff-viewer/line-renderer.tsx` – Render `+` (green), `-` (red), ` ` (neutral)
3. **Split view** `components/diff-viewer/split-view.tsx`:
   - Two virtual scrollers side-by-side (old on left, new on right)
   - Sync scroll positions
4. **Add toggle** `components/diff-viewer/unified-view.tsx`:
   - `hooks/use-diff-viewer.ts` – Persist split/unified choice to localStorage, restore on refresh

**Verification**: Render 10k-line diff smoothly, no jank on scroll, split/unified toggle persists.

---

### Phase 4: Search & Filtering (Days 4–5)

1. **Implement real-time search** `components/search/search-bar.tsx`:
   - Input field + search against: file names, file paths, line content
   - Use `match-sorter` for intelligent ranking
   - Debounce 200ms input → re-filter
   - Colocate hook in `components/search/search-bar.tsx.hooks.ts`
2. **Search service** `effects/services/search-engine.ts`:
   - Filter line array based on query
   - Invalidate Query cache → UI re-renders filtered lines
3. **Highlight matches** `components/search/highlight-match.tsx`:
   - Mark matching text in yellow/highlight
4. **Add filter options** `components/search/search-bar.tsx`:
   - `type:added` / `type:removed` / `type:neutral`
   - `file:pattern` for file name filtering
   - `folder:pattern` for folder filtering

**Verification**: Search for "useEffect" → filters to 5 matching lines, highlight works, debounce prevents excessive re-renders.

---

### Phase 5: Dashboard & Commit Selection (Days 5–6)

1. **Create dashboard** `routes/index.tsx`:
   - Display recent commits, branches (from git)
   - Range picker: "From commit X to commit Y"
   - Button to navigate to review page
   - Colocate hook in `routes/index.tsx.hooks.ts`
2. **Server functions** `routes/index.start.ts`:
   - TanStack Start server functions fetch commit list async
   - Use VCSAdapter with Effect
3. **Show commit details** in diff header:
   - Author, date, message for range
   - Option to collapse/expand individual commits in range

**Verification**: Select two commits, navigate to review page, diff loads.

---

### Phase 6: Preferences & Polish (Days 6–7)

1. **Persist user preferences** via TanStack DB:
   - Split/unified mode
   - Whitespace ignore setting
   - Search history (optional)
   - Store in DB via `db/queries.ts` helpers
2. **Whitespace toggle** `components/diff-viewer/unified-view.tsx`:
   - Re-parse diff with `ignoreWhitespace` flag when toggled
   - Persist choice to DB (reactive updates via TanStack DB)
3. **Error boundaries** `components/common/error-boundary.tsx`:
   - Catch parse errors, VCS errors, display user-friendly messages
4. **Performance profiling**:
   - Measure parse time for 100MB diff (should be <5s)
   - Measure search filter time for 50k lines (<100ms)

**Verification**: Load 1MB diff with 50k lines, search for pattern, scroll smoothly, preferences persist on refresh.

---

## Key Decisions

### Decision 1: Adapter Pattern for VCS

**Why**: Allows swapping git → jj → GitHub API in future without touching core logic.
**How**: Define `VCSAdapter` interface, provide multiple implementations, inject via Effect Context.

### Decision 2: Real-Time Search (Not Indexed MVP)

**Why**: Simpler to start; virtualized rendering makes 50k line filtering still fast (<100ms).
**Future**: If search becomes slow at scale, add indexed search layer with `match-sorter` caching or worker threads.

### Decision 3: Single Virtual Scroll Stream (Not File-by-File)

**Why**: Better UX—scroll through all hunks continuously, no pagination breaks.
**How**: Flatten file→hunk→line hierarchy into single array; Track file boundaries in metadata for display.

### Decision 4: Storage Adapter (Not localStorage Only)

**Why**: localStorage has 5MB limit; IndexedDB needed for large diffs.
**How**: Define StorageAdapter interface; impl memory (dev), IndexedDB (prod); swappable without logic changes.

### Decision 5: Unified + Split Views (Both in MVP)

**Why**: You personally use split; others may prefer unified. Toggle is cheap (just UI changes).
**How**: Implement both renderers; share virtual scroll state; toggle is user preference (stored).

### Decision 6: Whitespace Ignore (Can be Toggle)

**Why**: Common review use case; implementation is just re-parse with flag in jsdiff.
**Future**: Could add more sophisticated diff options (indent-aware, semantic).

---

## Critical Files & Symbols

| File                                               | Symbol                           | Purpose                                     |
| -------------------------------------------------- | -------------------------------- | ------------------------------------------- |
| `adapters/vcs/vcs.interface.ts`                    | `VCSAdapter`                     | Service interface for diff sources          |
| `adapters/storage/storage.interface.ts`            | `StorageAdapter`                 | Service interface for caching               |
| `adapters/diff-parser/diff-parser.ts`              | `parseDiff()`                    | Convert raw diff string to structured lines |
| `lib/types.ts`                                     | `Diff`, `Hunk`, `Line`           | Core types                                  |
| `lib/diff-utils.ts`                                | `flattenDiffForVirtualization()` | Prep diff for virtual scroll                |
| `effects/services/diff-processor.ts`               | `DiffProcessorService`           | Effect-based cache + parse orchestration    |
| `components/diff-viewer/unified-view.tsx`          | `UnifiedDiffViewer`              | Virtual scroll renderer + search            |
| `components/diff-viewer/split-view.tsx`            | `SplitDiffViewer`                | Side-by-side virtual scroll                 |
| `components/diff-viewer/unified-view.tsx.hooks.ts` | `useDiffViewer()`                | Unified/split mode state + persistence      |
| `routes/[repo].index.tsx`                          | TanStack loader                  | Async diff loading via Effect               |
| `routes/[repo].start.ts`                           | Server functions                 | TanStack Start server-side logic            |

---

## Verification & Testing

### MVP Acceptance Criteria

1. **Performance**: Load 1MB git diff in <5s, render 50k lines without jank
2. **Search**: Real-time filter <100ms for 50k lines; match-sorter ranking works
3. **Infinite Scroll**: Virtual scroll with fixed line height displays all hunks continuously
4. **Views**: Toggle split ↔ unified instantly; preference persists on refresh
5. **Whitespace**: Toggle ignore whitespace, diff re-parses correctly
6. **Error Handling**: Gracefully handle parse errors, VCS errors, storage failures
7. **Offline**: Cache persists; can view cached diffs without git command

### Testing Plan

- Unit tests: Diff parser, search filtering, line flattening
- Integration tests: Effect services with mock adapters
- Performance tests: Virtual scroll render time, search filter time
- Manual QA: Load your test repos, review real diffs, verify split/unified, search, preferences

---

## Future Extensions (Out of Scope for MVP)

1. **GitHub/Remote Diffs**: Add `git-http.ts` VCS adapter + OAuth flow
2. **Semantic Diffing**: Integrate ast-grep / diffsitter as alternative DiffParser impl
3. **Indexed Search**: Add worker-based indexing for 100k+ line diffs
4. **Desktop App**: Wrap with Electron/Tauri; use same adapters
5. **Jujutsu Support**: Implement `jj.ts` VCS adapter
6. **Collaborative Review**: Real-time sync of comments (WebSocket layer)
7. **Database Scale**: If TanStack DB becomes bottleneck, migrate to SQLite/Prisma

---

## Questions for You Before Implementation

**None remaining**—plan is ready for handoff. Key:

- Confirmed git-first MVP with extensible adapter architecture
- Both split/unified views with preference persistence
- Real-time search on virtualized stream
- Storage adapter for future flexibility (IndexedDB vs memory vs custom)
- Full Effect dependency injection for all services

Ready to implement?
