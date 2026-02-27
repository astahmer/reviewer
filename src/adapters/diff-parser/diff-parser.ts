import { Effect } from "effect";
import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata, Hunk } from "@pierre/diffs";
import { PARSE_DIFF_TIMEOUT_MS } from "~/lib/constants";
import { FileDiff, Line as DiffLine, Diff as DiffType } from "~/lib/types";
import { DiffParseError } from "~/lib/errors";
import { DiffParser } from "./types";

export interface ParsedDiffWithMetadata extends DiffType {
  /** @pierre/diffs parsed data for rendering with FileDiff component */
  pierreData?: FileDiffMetadata[];
}

/**
 * Parses unified diff format using @pierre/diffs
 */
export class PierreDiffParser implements DiffParser {
  parse(
    rawDiff: string,
    id: string,
    from: string,
    to: string,
  ): Effect.Effect<ParsedDiffWithMetadata, DiffParseError> {
    return Effect.tryPromise({
      try: async () => {
        return await Promise.race([
          parseDiffWithPierre(rawDiff, id, from, to),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Diff parsing timeout")), PARSE_DIFF_TIMEOUT_MS),
          ),
        ]);
      },
      catch: (error: unknown) =>
        new DiffParseError({
          message: `Failed to parse diff: ${error instanceof Error ? error.message : String(error)}`,
          rawDiff: rawDiff.slice(0, 100),
        }),
    });
  }
}

/**
 * Parse unified diff using @pierre/diffs for better rendering support
 */
async function parseDiffWithPierre(
  rawDiff: string,
  id: string,
  from: string,
  to: string,
): Promise<ParsedDiffWithMetadata> {
  // Parse with @pierre/diffs - returns array of patches
  const patches = parsePatchFiles(rawDiff, `${id}:${from}:${to}`);

  // Flatten all patches into a single array of files
  const pierreFiles: FileDiffMetadata[] = patches.flatMap((p) => p.files || []);

  // Convert to legacy format for backward compatibility
  const files: FileDiff[] = pierreFiles.map((file, fileIndex) => ({
    oldPath: file.prevName || file.name,
    newPath: file.name,
    status: (file.type === "new"
      ? "add"
      : file.type === "deleted"
        ? "remove"
        : file.type === "rename-pure" || file.type === "rename-changed"
          ? "rename"
          : "modify") as FileDiff["status"],
    hunks: file.hunks.map((hunk, hunkIndex) => ({
      header:
        hunk.hunkSpecs ||
        `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`,
      lines: extractLinesFromHunk(hunk, file, fileIndex, hunkIndex),
      index: hunkIndex,
    })),
    index: fileIndex,
  }));

  // Flatten all lines for searching/filtering
  const flatLines: DiffLine[] = files.flatMap((file) => file.hunks.flatMap((hunk) => hunk.lines));

  return {
    id,
    from,
    to,
    files,
    flatLines,
    createdAt: new Date(),
    pierreData: pierreFiles, // Store @pierre/diffs data for component usage
  };
}

/**
 * Extract lines from @pierre/diffs hunk structure
 */
function extractLinesFromHunk(
  hunk: Hunk,
  fileMeta: FileDiffMetadata,
  fileIndex: number,
  hunkIndex: number,
): DiffLine[] {
  const lines: DiffLine[] = [];
  let lineId = 0;

  const hunkContent = hunk.hunkContent || [];
  let oldLineNum = hunk.deletionStart;
  let newLineNum = hunk.additionStart;

  for (const content of hunkContent) {
    if (content.type === "context") {
      // Context lines - same in both old and new versions
      for (const lineContent of content.lines) {
        lines.push({
          id: `${fileIndex}-${hunkIndex}-${lineId++}`,
          content: lineContent,
          type: "context",
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
          fileIndex,
          hunkIndex,
        });
        oldLineNum++;
        newLineNum++;
      }
    } else if (content.type === "change") {
      // Deletions (lines only in old version)
      for (const lineContent of content.deletions) {
        lines.push({
          id: `${fileIndex}-${hunkIndex}-${lineId++}`,
          content: lineContent,
          type: "remove",
          oldLineNumber: oldLineNum,
          newLineNumber: -1,
          fileIndex,
          hunkIndex,
        });
        oldLineNum++;
      }

      // Additions (lines only in new version)
      for (const lineContent of content.additions) {
        lines.push({
          id: `${fileIndex}-${hunkIndex}-${lineId++}`,
          content: lineContent,
          type: "add",
          oldLineNumber: -1,
          newLineNumber: newLineNum,
          fileIndex,
          hunkIndex,
        });
        newLineNum++;
      }
    }
  }

  return lines;
}

/**
 * Create a @pierre/diffs-based parser instance
 */
export const createDiffParser = (): DiffParser => {
  return new PierreDiffParser();
};

/**
 * Backward compatibility export
 */
export const createJsDiffParser = createDiffParser;
