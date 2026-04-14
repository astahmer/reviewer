import type { FileDiffMetadata } from "@pierre/diffs";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
} from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal, type JSX } from "solid-js";
import { useSidebarSectionCollapsedState, useSidebarSectionSizes } from "~/components/hooks";

interface FileTreeSidebarProps {
  files: FileDiffMetadata[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  position: "left" | "right";
  onTogglePosition: () => void;
  footer?: JSX.Element;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  matchCounts?: Map<string, number>;
  showMatchCounts?: boolean;
  viewedPaths: Set<string>;
  onToggleViewed: (paths: string[]) => void;
  autoMarkViewed: boolean;
  onToggleAutoMarkViewed: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  file?: FileDiffMetadata;
  children: TreeNode[];
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  matchCounts?: Map<string, number>;
  showMatchCounts?: boolean;
  viewedPaths: Set<string>;
  onToggleViewed: (paths: string[]) => void;
}

const SIDEBAR_SECTION_MIN_SIZE = 18;

const getFilePath = (file: FileDiffMetadata) => file.name;

const getAncestorPaths = (path: string) => {
  const parts = path.split("/");
  const ancestors: string[] = [];

  for (let index = 0; index < parts.length - 1; index += 1) {
    ancestors.push(parts.slice(0, index + 1).join("/"));
  }

  return ancestors;
};

const getDefaultExpandedPaths = (files: FileDiffMetadata[]) => {
  const expanded = new Set<string>();

  for (const file of files) {
    const [firstDirectory] = getAncestorPaths(getFilePath(file));
    if (firstDirectory) {
      expanded.add(firstDirectory);
    }
  }

  return expanded;
};

const compressDirectories = (node: TreeNode): TreeNode => {
  if (node.kind === "file") {
    return node;
  }

  const compressedChildren = node.children.map(compressDirectories);

  if (compressedChildren.length !== 1 || compressedChildren[0]?.kind !== "directory") {
    return { ...node, children: compressedChildren };
  }

  const onlyChild = compressedChildren[0];

  return compressDirectories({
    ...node,
    name: `${node.name}/${onlyChild.name}`,
    path: onlyChild.path,
    children: onlyChild.children,
  });
};

const buildTree = (files: FileDiffMetadata[]) => {
  const root: TreeNode[] = [];

  const getOrCreateDirectory = (nodes: TreeNode[], name: string, path: string) => {
    const existing = nodes.find((node) => node.kind === "directory" && node.name === name);
    if (existing) {
      return existing;
    }

    const directory: TreeNode = {
      name,
      path,
      kind: "directory",
      children: [],
    };
    nodes.push(directory);
    return directory;
  };

  for (const file of files) {
    const parts = getFilePath(file).split("/");
    let level = root;
    let currentPath = "";

    for (const [index, part] of parts.entries()) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (isFile) {
        level.push({
          name: part,
          path: currentPath,
          kind: "file",
          file,
          children: [],
        });
      } else {
        const directory = getOrCreateDirectory(level, part, currentPath);
        level = directory.children;
      }
    }
  }

  const normalize = (nodes: TreeNode[]): TreeNode[] => {
    return [...nodes]
      .map((node) => {
        if (node.kind === "file") {
          return node;
        }

        return compressDirectories({
          ...node,
          children: normalize(node.children),
        });
      })
      .sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === "directory" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });
  };

  return normalize(root);
};

const getStatusLabel = (file?: FileDiffMetadata) => {
  switch (file?.type) {
    case "new":
      return {
        label: "new",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "deleted":
      return {
        label: "del",
        className:
          "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
      };
    case "rename-pure":
    case "rename-changed":
      return {
        label: "ren",
        className:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
      };
    default:
      return {
        label: "mod",
        className:
          "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
      };
  }
};

const getFileMatchCount = (node: TreeNode, matchCounts?: Map<string, number>): number => {
  if (node.kind === "file") {
    return matchCounts?.get(node.path) || 0;
  }

  return node.children.reduce((total, child) => total + getFileMatchCount(child, matchCounts), 0);
};

const getLeafPaths = (node: TreeNode): string[] => {
  if (node.kind === "file") {
    return [node.path];
  }

  return node.children.flatMap(getLeafPaths);
};

function TreeItem(props: TreeItemProps) {
  if (props.node.kind === "file") {
    const status = getStatusLabel(props.node.file);
    const isSelected = () => props.selectedPath === props.node.path;
    const matchCount = () => props.matchCounts?.get(props.node.path) || 0;
    const isViewed = () => props.viewedPaths.has(props.node.path);
    const additions = () => props.node.file?.additionLines?.length ?? 0;
    const deletions = () => props.node.file?.deletionLines?.length ?? 0;

    return (
      <div
        class={`flex items-center gap-1 rounded-md transition-colors ${
          isViewed() ? "opacity-50" : ""
        } ${
          isSelected()
            ? "bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-800"
            : "hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
        style={{ "padding-left": `${props.depth * 14 + 6}px` }}
      >
        <button
          type="button"
          onClick={() => props.onSelectPath(props.node.path)}
          data-tree-path={props.node.path}
          class={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-sm ${
            isSelected() ? "text-sky-800 dark:text-sky-200" : "text-slate-800 dark:text-slate-200"
          }`}
        >
          <span class="w-3 shrink-0 text-center text-slate-400 dark:text-slate-600">•</span>
          <span class="min-w-0 flex-1 truncate font-medium">{props.node.name}</span>
          <Show when={props.showMatchCounts && matchCount() > 0}>
            <span class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
              {matchCount()}
            </span>
          </Show>
          <Show
            when={additions() > 0 || deletions() > 0}
            fallback={
              <span
                class={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${status.className}`}
              >
                {status.label}
              </span>
            }
          >
            <span class="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold">
              <Show when={additions() > 0}>
                <span class="text-emerald-600 dark:text-emerald-400">+{additions()}</span>
              </Show>
              <Show when={deletions() > 0}>
                <span class="text-rose-500 dark:text-rose-400">-{deletions()}</span>
              </Show>
            </span>
          </Show>
        </button>
        <button
          type="button"
          title={isViewed() ? "Mark as not viewed" : "Mark as viewed"}
          onClick={(event) => {
            event.stopPropagation();
            props.onToggleViewed([props.node.path]);
          }}
          aria-pressed={isViewed()}
          class={`mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            isViewed()
              ? "border-emerald-300 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950"
              : "border-slate-300 text-transparent hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
          }`}
        >
          <Check size={11} stroke-width={2.5} />
        </button>
      </div>
    );
  }

  const isExpanded = () => props.expandedPaths.has(props.node.path);
  const directoryMatchCount = () => getFileMatchCount(props.node, props.matchCounts);
  const leafPaths = () => getLeafPaths(props.node);
  const viewedCount = () => leafPaths().filter((path) => props.viewedPaths.has(path)).length;
  const allViewed = () => leafPaths().length > 0 && viewedCount() === leafPaths().length;

  return (
    <div>
      <div class="flex items-center gap-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60">
        <button
          type="button"
          onClick={() => props.onToggle(props.node.path)}
          class="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300"
          style={{ "padding-left": `${props.depth * 14 + 6}px` }}
        >
          <Show when={isExpanded()} fallback={<ChevronRight size={14} class="shrink-0" />}>
            <ChevronDown size={14} class="shrink-0" />
          </Show>
          <span class="min-w-0 flex-1 truncate">{props.node.name}</span>
          <Show when={props.showMatchCounts && directoryMatchCount() > 0}>
            <span class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
              {directoryMatchCount()}
            </span>
          </Show>
          <span class="text-[10px] text-slate-400 dark:text-slate-500">
            {viewedCount()}/{leafPaths().length}
          </span>
        </button>
        <button
          type="button"
          title={allViewed() ? "Mark folder as not viewed" : "Mark all in folder as viewed"}
          onClick={() => props.onToggleViewed(leafPaths())}
          aria-pressed={allViewed()}
          class={`mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            allViewed()
              ? "border-emerald-300 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950"
              : viewedCount() > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "border-slate-300 text-transparent hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
          }`}
        >
          <Check size={11} stroke-width={2.5} />
        </button>
      </div>

      <Show when={isExpanded()}>
        <div class="space-y-0.5">
          <For each={props.node.children}>
            {(child) => (
              <TreeItem
                node={child}
                depth={props.depth + 1}
                expandedPaths={props.expandedPaths}
                onToggle={props.onToggle}
                selectedPath={props.selectedPath}
                onSelectPath={props.onSelectPath}
                matchCounts={props.matchCounts}
                showMatchCounts={props.showMatchCounts}
                viewedPaths={props.viewedPaths}
                onToggleViewed={props.onToggleViewed}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function FileTreeSidebar(props: FileTreeSidebarProps) {
  const tree = createMemo(() => buildTree(props.files));
  const viewedFileCount = createMemo(() =>
    props.files.reduce((count, file) => count + (props.viewedPaths.has(file.name) ? 1 : 0), 0),
  );
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(
    getDefaultExpandedPaths(props.files),
  );
  const [sectionSizes, setSectionSizes] = useSidebarSectionSizes();
  const [sectionCollapsedState, setSectionCollapsedState] = useSidebarSectionCollapsedState();
  const totalMatchCount = createMemo(() =>
    Array.from(props.matchCounts?.values() || []).reduce((total, count) => total + count, 0),
  );
  const filesPanelCollapsed = createMemo(() => sectionCollapsedState().files);
  const historyPanelCollapsed = createMemo(() => sectionCollapsedState().history);
  const CollapseIcon = () =>
    props.position === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />;
  const ExpandIcon = () =>
    props.position === "left" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />;
  let treeScrollRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  const toggleExpandedPath = (path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  createEffect(() => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      for (const path of getDefaultExpandedPaths(props.files)) {
        next.add(path);
      }

      if (props.selectedPath) {
        for (const ancestor of getAncestorPaths(props.selectedPath)) {
          next.add(ancestor);
        }
      }

      return next;
    });
  });

  createEffect(() => {
    if (!props.selectedPath || !treeScrollRef) {
      return;
    }

    const escapedPath = window.CSS?.escape
      ? window.CSS.escape(props.selectedPath)
      : props.selectedPath;
    requestAnimationFrame(() => {
      treeScrollRef
        ?.querySelector(`[data-tree-path="${escapedPath}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  });

  const toggleFilesPanel = () => {
    setSectionCollapsedState({
      files: !filesPanelCollapsed(),
      history: historyPanelCollapsed(),
    });
  };

  const toggleHistoryPanel = () => {
    setSectionCollapsedState({
      files: filesPanelCollapsed(),
      history: !historyPanelCollapsed(),
    });
  };

  const startResize = (event: MouseEvent) => {
    event.preventDefault();

    if (!contentRef || filesPanelCollapsed() || historyPanelCollapsed()) {
      return;
    }

    const rect = contentRef.getBoundingClientRect();

    const handleMove = (moveEvent: MouseEvent) => {
      const nextFilesSize = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const clampedFilesSize = Math.min(
        100 - SIDEBAR_SECTION_MIN_SIZE,
        Math.max(SIDEBAR_SECTION_MIN_SIZE, nextFilesSize),
      );

      setSectionSizes({
        files: clampedFilesSize,
        history: 100 - clampedFilesSize,
      });
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  if (props.collapsed) {
    return (
      <aside
        class={`flex h-full min-h-0 w-full flex-col items-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ${
          props.position === "left"
            ? "border-r border-slate-200 dark:border-slate-800"
            : "border-l border-slate-200 dark:border-slate-800"
        }`}
      >
        <div class="flex w-full shrink-0 items-center justify-center gap-1 border-b border-slate-200 py-2 dark:border-slate-800">
          <button
            type="button"
            onClick={props.onToggleCollapsed}
            class="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ExpandIcon />
          </button>
          <button
            type="button"
            onClick={props.onTogglePosition}
            class="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={`Move sidebar to the ${props.position === "left" ? "right" : "left"}`}
            title={`Move sidebar to the ${props.position === "left" ? "right" : "left"}`}
          >
            <ArrowLeftRight size={14} />
          </button>
        </div>
        <div class="flex flex-1 flex-col items-center gap-2 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          <span class="[writing-mode:vertical-rl] rotate-180">Review</span>
          <span>{props.files.length}</span>
          <Show when={props.showMatchCounts && totalMatchCount() > 0}>
            <span class="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
              {totalMatchCount()}
            </span>
          </Show>
        </div>
      </aside>
    );
  }

  return (
    <aside class="flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
              Review
            </p>
            <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {props.files.length} file{props.files.length === 1 ? "" : "s"}
            </span>
            <Show when={props.files.length > 0}>
              <span
                class={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  viewedFileCount() === props.files.length
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {viewedFileCount()}/{props.files.length} viewed
              </span>
            </Show>
            <Show when={props.showMatchCounts && totalMatchCount() > 0}>
              <span class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                {totalMatchCount()} matches
              </span>
            </Show>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onToggleAutoMarkViewed}
            class={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              props.autoMarkViewed
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
            aria-pressed={props.autoMarkViewed}
            title={
              props.autoMarkViewed
                ? "Disable automatic viewed tracking"
                : "Enable automatic viewed tracking based on scroll position"
            }
          >
            auto
          </button>
          <button
            type="button"
            onClick={props.onTogglePosition}
            class="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={`Move sidebar to the ${props.position === "left" ? "right" : "left"}`}
            title={`Move sidebar to the ${props.position === "left" ? "right" : "left"}`}
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            type="button"
            onClick={props.onToggleCollapsed}
            class="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <CollapseIcon />
          </button>
        </div>
      </div>

      <div
        ref={(element) => (contentRef = element)}
        class="min-h-0 flex flex-1 flex-col overflow-hidden bg-[var(--app-panel-muted)]"
      >
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/60">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            Tree
          </p>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {filesPanelCollapsed() ? "collapsed" : "open"}
            </span>
            <button
              type="button"
              onClick={toggleFilesPanel}
              class="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={filesPanelCollapsed() ? "Expand file tree" : "Collapse file tree"}
              title={filesPanelCollapsed() ? "Expand file tree" : "Collapse file tree"}
            >
              <Show when={filesPanelCollapsed()} fallback={<ChevronDown size={14} />}>
                <ChevronRight size={14} />
              </Show>
            </button>
          </div>
        </div>

        <Show when={!filesPanelCollapsed()}>
          <div
            ref={(element) => (treeScrollRef = element)}
            class="min-h-0 overflow-auto p-2"
            style={{
              flex:
                props.footer && !historyPanelCollapsed()
                  ? `${sectionSizes().files} 1 0%`
                  : "1 1 0%",
            }}
          >
            <Show
              when={props.files.length > 0}
              fallback={
                <div class="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600 dark:text-slate-400">
                  No files match the current diff filters.
                </div>
              }
            >
              <div class="space-y-0.5">
                <For each={tree()}>
                  {(node) => (
                    <TreeItem
                      node={node}
                      depth={0}
                      expandedPaths={expandedPaths()}
                      onToggle={toggleExpandedPath}
                      selectedPath={props.selectedPath}
                      onSelectPath={props.onSelectPath}
                      matchCounts={props.matchCounts}
                      showMatchCounts={props.showMatchCounts}
                      viewedPaths={props.viewedPaths}
                      onToggleViewed={props.onToggleViewed}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={props.footer}>
          <>
            <Show when={!filesPanelCollapsed() && !historyPanelCollapsed()}>
              <button
                type="button"
                onMouseDown={(event) => startResize(event)}
                aria-label="Resize file tree and history"
                class="group flex h-1.5 shrink-0 items-center justify-center bg-slate-100 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <GripHorizontal size={10} class="text-slate-400 group-hover:text-slate-600" />
              </button>
            </Show>

            <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/60">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                Timeline
              </p>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {historyPanelCollapsed() ? "collapsed" : "open"}
                </span>
                <button
                  type="button"
                  onClick={toggleHistoryPanel}
                  class="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label={historyPanelCollapsed() ? "Expand history" : "Collapse history"}
                  title={historyPanelCollapsed() ? "Expand history" : "Collapse history"}
                >
                  <Show when={historyPanelCollapsed()} fallback={<ChevronDown size={14} />}>
                    <ChevronRight size={14} />
                  </Show>
                </button>
              </div>
            </div>

            <Show when={!historyPanelCollapsed()}>
              <div
                class="min-h-0 overflow-hidden"
                style={{
                  flex: !filesPanelCollapsed() ? `${sectionSizes().history} 1 0%` : "1 1 0%",
                }}
              >
                {props.footer}
              </div>
            </Show>
          </>
        </Show>
      </div>
    </aside>
  );
}
