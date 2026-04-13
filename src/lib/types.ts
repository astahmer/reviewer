/**
 * Core types for diff reviewing
 */

export type LineType = "add" | "remove" | "context";

export interface Line {
  /** 0-based index in the flattened array */
  id: string;
  /** Content of the line (without the prefix +/- / space) */
  content: string;
  /** Type of line: added, removed, or context */
  type: LineType;
  /** Line number in old file (1-based, or -1 if not applicable) */
  oldLineNumber: number;
  /** Line number in new file (1-based, or -1 if not applicable) */
  newLineNumber: number;
  /** Index of the file this line belongs to */
  fileIndex: number;
  /** Index of the hunk this line belongs to */
  hunkIndex: number;
}

export interface Hunk {
  /** Header line like '@@ -1,5 +1,6 @@' */
  header: string;
  /** Lines in this hunk */
  lines: Line[];
  /** Index in the file's hunks array */
  index: number;
}

export interface FileDiff {
  /** Relative path from repo root */
  oldPath: string;
  /** Relative path from repo root */
  newPath: string;
  /** Type of change: added, removed, modified, renamed */
  status: "add" | "remove" | "modify" | "rename";
  /** Hunks in this file */
  hunks: Hunk[];
  /** Index in the diff's files array */
  index: number;
}

export interface Diff {
  /** Unique ID for this diff (hash of commit range or user-provided) */
  id: string;
  /** Source commit (hash or branch name) */
  from: string;
  /** Target commit (hash or branch name) */
  to: string;
  /** All files in this diff */
  files: FileDiff[];
  /** Flattened array of all lines for fast virtualization */
  flatLines: Line[];
  /** Timestamps */
  createdAt: Date;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  kind?: "commit" | "local-staged" | "local-worktree";
  label?: string;
  additions?: number;
  deletions?: number;
}

export type BranchScope = "local" | "tracked" | "remote";

export interface BranchInfo {
  name: string;
  baseName: string;
  displayName: string;
  scope: BranchScope;
  remoteName?: string;
  latestCommit: CommitInfo;
}

export interface UserPreferences {
  /** 'unified' or 'split' */
  viewMode: "unified" | "split";
  /** Whether to ignore whitespace diffs */
  ignoreWhitespace: boolean;
  /** Recent search queries */
  searchHistory: string[];
  /** Theme for diff viewer */
  theme?: string;
  /** Color mode: light, dark, or auto */
  colorMode?: "light" | "dark" | "auto";
  /** Global application color mode */
  globalColorMode?: "light" | "dark" | "auto";
  /** Whether to enable line wrapping */
  wrapping?: boolean;
  /** Preferred side for the file tree sidebar */
  sidebarPosition?: "left" | "right";
  /** Whether the file tree sidebar is collapsed */
  sidebarCollapsed?: boolean;
  /** Horizontal sidebar width percentage */
  sidebarSize?: number;
  /** Vertical file tree section height percentage */
  sidebarFilesSize?: number;
  /** Vertical history section height percentage */
  sidebarHistorySize?: number;
  /** Whether the file tree panel is collapsed */
  sidebarFilesCollapsed?: boolean;
  /** Whether the history panel is collapsed */
  sidebarHistoryCollapsed?: boolean;
}
