import * as Ark from "@ark-ui/react";
import { FC, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { FileDiffMetadata } from "@pierre/diffs";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
} from "lucide-react";
import { useSidebarSectionCollapsedState, useSidebarSectionSizes } from "~/components/hooks";

interface FileTreeSidebarProps {
  files: FileDiffMetadata[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  position: "left" | "right";
  onTogglePosition: () => void;
  footer?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  matchCounts?: Map<string, number>;
  showMatchCounts?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  file?: FileDiffMetadata;
  children: TreeNode[];
}

const SIDEBAR_SECTION_MIN_SIZE = 18;
const SIDEBAR_SECTION_COLLAPSED_SIZE = 9;

const getFilePath = (file: FileDiffMetadata) => file.name;

const getAncestorPaths = (path: string) => {
  const parts = path.split("/");
  const ancestors: string[] = [];

  for (let index = 0; index < parts.length - 1; index++) {
    ancestors.push(parts.slice(0, index + 1).join("/"));
  }

  return ancestors;
};

const getDefaultExpandedPaths = (files: FileDiffMetadata[]) => {
  const expanded = new Set<string>();

  for (const file of files) {
    const path = getFilePath(file);
    const [firstDirectory] = getAncestorPaths(path);
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

  const normalize = (nodes: Iterable<TreeNode>): TreeNode[] => {
    return Array.from(nodes)
      .map((node) => {
        if (node.kind === "file") {
          return node;
        }

        const children = normalize(node.children);
        return compressDirectories({ ...node, children });
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

const getNodeMatchCount = (node: TreeNode, matchCounts?: Map<string, number>): number => {
  if (node.kind === "file") {
    return matchCounts?.get(node.path) || 0;
  }

  return node.children.reduce((total, child) => total + getNodeMatchCount(child, matchCounts), 0);
};

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  matchCounts?: Map<string, number>;
  showMatchCounts?: boolean;
}

const TreeItem: FC<TreeItemProps> = ({
  node,
  depth,
  expandedPaths,
  onToggle,
  selectedPath,
  onSelectPath,
  matchCounts,
  showMatchCounts,
}) => {
  if (node.kind === "file") {
    const status = getStatusLabel(node.file);
    const isSelected = selectedPath === node.path;
    const matchCount = matchCounts?.get(node.path) || 0;

    return (
      <button
        type="button"
        onClick={() => onSelectPath(node.path)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          isSelected
            ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800"
            : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        }`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        <span className="w-3 text-center text-slate-400 dark:text-slate-600">•</span>
        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        {showMatchCounts && matchCount > 0 ? (
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
            {matchCount}
          </span>
        ) : null}
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${status.className}`}
        >
          {status.label}
        </span>
      </button>
    );
  }

  const isExpanded = expandedPaths.has(node.path);
  const directoryMatchCount = getNodeMatchCount(node, matchCounts);

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {showMatchCounts && directoryMatchCount > 0 ? (
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
            {directoryMatchCount}
          </span>
        ) : null}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {node.children.length}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onSelectPath={onSelectPath}
              matchCounts={matchCounts}
              showMatchCounts={showMatchCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTreeSidebar: FC<FileTreeSidebarProps> = ({
  files,
  selectedPath,
  onSelectPath,
  position,
  onTogglePosition,
  footer,
  collapsed,
  onToggleCollapsed,
  matchCounts,
  showMatchCounts,
}) => {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    getDefaultExpandedPaths(files),
  );
  const CollapseIcon = position === "left" ? ChevronLeft : ChevronRight;
  const ExpandIcon = position === "left" ? ChevronRight : ChevronLeft;
  const [sectionSizes, setSectionSizes] = useSidebarSectionSizes();
  const [sectionCollapsedState, setSectionCollapsedState] = useSidebarSectionCollapsedState();
  const totalMatchCount = Array.from(matchCounts?.values() || []).reduce(
    (total, count) => total + count,
    0,
  );
  const sectionSplitter = Ark.useSplitter({
    id: "reviewer-sidebar-sections",
    orientation: "vertical",
    defaultSize: [sectionSizes.files, sectionSizes.history],
    panels: [
      {
        id: "files",
        minSize: SIDEBAR_SECTION_MIN_SIZE,
        collapsible: true,
        collapsedSize: SIDEBAR_SECTION_COLLAPSED_SIZE,
      },
      {
        id: "history",
        minSize: SIDEBAR_SECTION_MIN_SIZE,
        collapsible: true,
        collapsedSize: SIDEBAR_SECTION_COLLAPSED_SIZE,
      },
    ],
    onResizeEnd: (details) => {
      const [filesSize, historySize] = details.size;
      if (
        typeof filesSize === "number" &&
        typeof historySize === "number" &&
        filesSize > SIDEBAR_SECTION_COLLAPSED_SIZE &&
        historySize > SIDEBAR_SECTION_COLLAPSED_SIZE
      ) {
        setSectionSizes({ files: filesSize, history: historySize });
      }
    },
  });
  const sectionSplitterRef = useRef(sectionSplitter);

  useEffect(() => {
    sectionSplitterRef.current = sectionSplitter;
  }, [sectionSplitter]);

  useEffect(() => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      for (const path of getDefaultExpandedPaths(files)) {
        next.add(path);
      }
      if (selectedPath) {
        for (const ancestor of getAncestorPaths(selectedPath)) {
          next.add(ancestor);
        }
      }
      return next;
    });
  }, [files, selectedPath]);

  const filesPanelCollapsed = sectionSplitter.isPanelCollapsed("files");
  const historyPanelCollapsed = sectionSplitter.isPanelCollapsed("history");

  useEffect(() => {
    if (sectionCollapsedState.files) {
      sectionSplitterRef.current.collapsePanel("files");
    } else if (sectionSplitterRef.current.isPanelCollapsed("files")) {
      sectionSplitterRef.current.expandPanel("files", sectionSizes.files);
    }

    if (sectionCollapsedState.history) {
      sectionSplitterRef.current.collapsePanel("history");
    } else if (sectionSplitterRef.current.isPanelCollapsed("history")) {
      sectionSplitterRef.current.expandPanel("history", sectionSizes.history);
    }

    if (!sectionCollapsedState.files && !sectionCollapsedState.history) {
      sectionSplitterRef.current.setSizes([sectionSizes.files, sectionSizes.history]);
    }
  }, [
    sectionCollapsedState.files,
    sectionCollapsedState.history,
    sectionSizes.files,
    sectionSizes.history,
  ]);

  const toggleFilesPanel = () => {
    setSectionCollapsedState({
      ...sectionCollapsedState,
      files: !sectionCollapsedState.files,
    });
  };

  const toggleHistoryPanel = () => {
    setSectionCollapsedState({
      ...sectionCollapsedState,
      history: !sectionCollapsedState.history,
    });
  };

  if (collapsed) {
    return (
      <aside
        className={`flex h-full min-h-0 w-full flex-col items-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ${
          position === "left"
            ? "border-r border-slate-200 dark:border-slate-800"
            : "border-l border-slate-200 dark:border-slate-800"
        }`}
      >
        <div className="flex w-full shrink-0 items-center justify-center gap-1 border-b border-slate-200 py-2 dark:border-slate-800">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ExpandIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onTogglePosition}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={`Move sidebar to the ${position === "left" ? "right" : "left"}`}
            title={`Move sidebar to the ${position === "left" ? "right" : "left"}`}
          >
            <ArrowLeftRight size={14} />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          <span className="[writing-mode:vertical-rl] rotate-180">Review</span>
          <span>{files.length}</span>
          {showMatchCounts ? (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
              {totalMatchCount}
            </span>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-[#161b22] dark:via-[#161b22] dark:to-[#0d1117]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-[#161b22]/90">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
              Review
            </p>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {files.length} file{files.length === 1 ? "" : "s"}
            </span>
            {showMatchCounts && totalMatchCount > 0 ? (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                {totalMatchCount} matches
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePosition}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={`Move sidebar to the ${position === "left" ? "right" : "left"}`}
            title={`Move sidebar to the ${position === "left" ? "right" : "left"}`}
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <CollapseIcon size={16} />
          </button>
        </div>
      </div>

      <Ark.Splitter.RootProvider
        value={sectionSplitter}
        className="min-h-0 flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[var(--app-panel-muted)]"
      >
        <Ark.Splitter.Panel id="files" className="min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-3 py-1.5 dark:border-slate-800 dark:bg-[#161b22]/60">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                  Tree
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {filesPanelCollapsed ? "collapsed" : "open"}
                </span>
                <button
                  type="button"
                  onClick={toggleFilesPanel}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label={filesPanelCollapsed ? "Expand file tree" : "Collapse file tree"}
                  title={filesPanelCollapsed ? "Expand file tree" : "Collapse file tree"}
                >
                  {filesPanelCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {!filesPanelCollapsed ? (
              <div className="min-h-0 flex-1 overflow-auto p-2">
                {files.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600 dark:text-slate-400">
                    No files match the current diff filters.
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {tree.map((node) => (
                      <TreeItem
                        key={node.path}
                        node={node}
                        depth={0}
                        expandedPaths={expandedPaths}
                        onToggle={(path) => {
                          setExpandedPaths((previous) => {
                            const next = new Set(previous);
                            if (next.has(path)) {
                              next.delete(path);
                            } else {
                              next.add(path);
                            }
                            return next;
                          });
                        }}
                        selectedPath={selectedPath}
                        onSelectPath={onSelectPath}
                        matchCounts={matchCounts}
                        showMatchCounts={showMatchCounts}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </Ark.Splitter.Panel>

        {footer ? (
          <>
            {!filesPanelCollapsed && !historyPanelCollapsed ? (
              <Ark.Splitter.ResizeTrigger
                id="files:history"
                aria-label="Resize file tree and history"
                className="group flex h-1.5 shrink-0 items-center justify-center bg-slate-100 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <GripHorizontal size={10} className="text-slate-400 group-hover:text-slate-600" />
              </Ark.Splitter.ResizeTrigger>
            ) : null}

            <Ark.Splitter.Panel id="history" className="min-h-0 overflow-hidden">
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-3 py-1.5 dark:border-slate-800 dark:bg-[#161b22]/60">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                      Timeline
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {historyPanelCollapsed ? "collapsed" : "open"}
                    </span>
                    <button
                      type="button"
                      onClick={toggleHistoryPanel}
                      className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label={historyPanelCollapsed ? "Expand history" : "Collapse history"}
                      title={historyPanelCollapsed ? "Expand history" : "Collapse history"}
                    >
                      {historyPanelCollapsed ? (
                        <ChevronRight size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {!historyPanelCollapsed ? (
                  <div className="min-h-0 flex-1 overflow-hidden">{footer}</div>
                ) : null}
              </div>
            </Ark.Splitter.Panel>
          </>
        ) : null}
      </Ark.Splitter.RootProvider>
    </aside>
  );
};
