import { Effect } from 'effect'
import { matchSorter } from 'match-sorter'
import { Line, DiffFilter } from '~/lib/types'

/**
 * Search engine service
 * Provides real-time filtering and ranking of diff lines
 */
export class SearchEngineService {
  /**
   * Filter and rank lines based on search query
   */
  search(lines: Line[], filter: DiffFilter): Effect.Effect<Line[]> {
    return Effect.sync(() => {
      let results = lines

      // Filter by line type
      if (filter.type && filter.type !== 'all') {
        results = results.filter((line) => line.type === filter.type)
      }

      // Filter by file name
      if (filter.fileName) {
        results = results.filter((line) => {
          const fileName = line.fileIndex.toString()
          return fileName.includes(filter.fileName!)
        })
      }

      // Filter by folder path
      if (filter.folderPath) {
        results = results.filter((line) => {
          const path = line.fileIndex.toString()
          return path.includes(filter.folderPath!)
        })
      }

      // Search by content using match-sorter
      if (filter.query) {
        results = matchSorter(results, filter.query, {
          keys: [(item) => item.content],
          threshold: matchSorter.rankings.ACRONYM,
        })
      }

      return results
    })
  }

  /**
   * Highlight search matches in line content
   */
  highlightMatches(content: string, query: string): Array<{ text: string; isMatch: boolean }> {
    if (!query.trim()) {
      return [{ text: content, isMatch: false }]
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts: Array<{ text: string; isMatch: boolean }> = []

    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: content.slice(lastIndex, match.index), isMatch: false })
      }
      parts.push({ text: match[0], isMatch: true })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < content.length) {
      parts.push({ text: content.slice(lastIndex), isMatch: false })
    }

    return parts.length > 0 ? parts : [{ text: content, isMatch: false }]
  }
}

/**
 * Create a search engine service
 */
export const createSearchEngineService = (): SearchEngineService => {
  return new SearchEngineService()
}
