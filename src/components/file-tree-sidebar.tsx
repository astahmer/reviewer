import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import type { FileDiffMetadata } from "@pierre/diffs";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FileTreeSidebarProps {
  files: FileDiffMetadata[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  position: "left" | "right";
  footer?: ReactNode;
}

interface TreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  file?: FileDiffMetadata;
  children: TreeNode[];
}

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
      return { label: "new", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "deleted":
      return { label: "del", className: "bg-rose-50 text-rose-700 border-rose-200" };
    case "rename-pure":
    case "rename-changed":
      return { label: "ren", className: "bg-amber-50 text-amber-700 border-amber-200" };
    default:
      return { label: "mod", className: "bg-slate-100 text-slate-600 border-slate-200" };
  }
};

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
}

const TreeItem: FC<TreeItemProps> = ({
  node,
  depth,
  expandedPaths,
  onToggle,
  selectedPath,
  onSelectPath,
}) => {
  if (node.kind === "file") {
    const status = getStatusLabel(node.file);
    const isSelected = selectedPath === node.path;

    return (
      <button
        type="button"
        onClick={() => onSelectPath(node.path)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          isSelected
            ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
            : "text-slate-700 hover:bg-slate-100"
        }`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        <span className="w-3 text-center text-slate-300">•</span>
        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${status.className}`}
        >
          {status.label}
        </span>
      </button>
    );
  }

  const isExpanded = expandedPaths.has(node.path);

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
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
  footer,
}) => {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    getDefaultExpandedPaths(files),
  );

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

  return (
    <aside
      className={`flex h-full w-80 shrink-0 flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 ${
        position === "left" ? "border-r border-slate-200" : "border-l border-slate-200"
      }`}
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Files</p>
        <p className="mt-1 text-sm text-slate-600">
          {files.length} changed file{files.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {files.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
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
              />
            ))}
          </div>
        )}
      </div>

      {footer ? (
        <div className="max-h-[22rem] shrink-0 border-t border-slate-200">{footer}</div>
      ) : null}
    </aside>
  );
};
