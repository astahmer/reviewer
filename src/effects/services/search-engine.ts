import { Effect } from "effect";
import { matchSorter } from "match-sorter";
import { Line, DiffFilter, Diff } from "~/lib/types";

/**
 * Parsed search query with optional path filter
 */
interface ParsedQuery {
  pathFilter?: string;
  contentQuery: string;
}

/**
 * Search engine service
 * Provides real-time filtering and ranking of diff lines
 */
export class SearchEngineService {
  /**
   * Parse search query for "path:..." syntax
   * Examples:
   *   "path:src/component.tsx"
   *   "path:src/component.tsx handleClick"
   *   "path:utils foo"
   */
  private parseQuery(query: string): ParsedQuery {
    if (!query || !query.trim()) {
      return { contentQuery: "" };
    }

    const pathMatch = query.match(/^path:(\S+)\s*(.*)/);
    if (pathMatch && pathMatch[1]) {
      return {
        pathFilter: pathMatch[1],
        contentQuery: (pathMatch[2] || "").trim(),
      };
    }

    return { contentQuery: query.trim() };
  }

  /**
   * Filter and rank lines based on search query and diff context
   * Supports "path:..." prefix to filter by file path
   */
  search(lines: Line[], filter: DiffFilter, diff?: Diff): Effect.Effect<Line[]> {
    return Effect.sync(() => {
      let results = lines;

      // Parse query for path filter
      const parsed = this.parseQuery(filter.query || "");

      // Filter by line type
      if (filter.type && filter.type !== "all") {
        results = results.filter((line) => line.type === filter.type);
      }

      // Filter by file name
      if (filter.fileName) {
        results = results.filter((line) => {
          const fileName = line.fileIndex.toString();
          return fileName.includes(filter.fileName!);
        });
      }

      // Filter by path (from "path:..." syntax)
      if (parsed.pathFilter && diff) {
        results = results.filter((line) => {
          const file = diff.files?.[line.fileIndex];
          if (!file) {
            return false;
          }
          const filePath = file.newPath;
          return filePath.includes(parsed.pathFilter!);
        });
      }

      // Filter by folder path (existing filter)
      if (filter.folderPath) {
        results = results.filter((line) => {
          const path = line.fileIndex.toString();
          return path.includes(filter.folderPath!);
        });
      }

      // Search by content using match-sorter
      if (parsed.contentQuery) {
        results = matchSorter(results, parsed.contentQuery, {});
      }

      return results;
    });
  }

  /**
   * Highlight search matches in line content
   */
  highlightMatches(content: string, query: string): Array<{ text: string; isMatch: boolean }> {
    if (!query.trim()) {
      return [{ text: content, isMatch: false }];
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts: Array<{ text: string; isMatch: boolean }> = [];

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: content.slice(lastIndex, match.index), isMatch: false });
      }
      parts.push({ text: match[0], isMatch: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({ text: content.slice(lastIndex), isMatch: false });
    }

    return parts.length > 0 ? parts : [{ text: content, isMatch: false }];
  }
}

/**
 * Create a search engine service
 */
export const createSearchEngineService = (): SearchEngineService => {
  return new SearchEngineService();
};
