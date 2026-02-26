import * as Effect from 'effect'
import * as Diff from 'jsdiff'
import { PARSE_DIFF_TIMEOUT_MS } from '~/lib/constants'
import { FileDiff, Hunk, Line as DiffLine, Diff as DiffType } from '~/lib/types'
import { DiffParser } from './types'

/**
 * Parses unified diff format using jsdiff library
 */
export class JsDiffParser implements DiffParser {
  parse(rawDiff: string, id: string, from: string, to: string): Effect.Effect<DiffType> {
    return Effect.gen(function* () {
      try {
        const result = yield* Effect.tryPromise({
          try: async () => {
            return await Promise.race([
              parseDiffSync(rawDiff, id, from, to),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Diff parsing timeout')), PARSE_DIFF_TIMEOUT_MS),
              ),
            ])
          },
          catch: (error) =>
            new Error(`Failed to parse diff: ${error instanceof Error ? error.message : String(error)}`),
        })

        return result
      } catch (error) {
        return yield* Effect.fail(
          error instanceof Error ? error : new Error(String(error)),
        )
      }
    })
  }
}

/**
 * Parse unified diff synchronously (but wrapped in async for timeout)
 */
async function parseDiffSync(rawDiff: string, id: string, from: string, to: string): Promise<DiffType> {
  const files: FileDiff[] = []
  let currentFile: Partial<FileDiff> | null = null
  let currentHunk: Partial<Hunk> | null = null
  let fileIndex = 0
  let hunkIndex = 0
  let lineNumberOld = 0
  let lineNumberNew = 0
  let flatLines: DiffLine[] = []
  let lineId = 0

  const lines = rawDiff.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // File header: 'diff --git a/path b/path'
    if (line.startsWith('diff --git')) {
      // Save previous file
      if (currentFile && currentHunk) {
        currentFile.hunks = currentFile.hunks || []
        currentFile.hunks.push(currentHunk as Hunk)
      }
      if (currentFile) {
        files.push(currentFile as FileDiff)
      }

      // Parse new file
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
      if (match) {
        currentFile = {
          oldPath: match[1],
          newPath: match[2],
          status: 'modify',
          hunks: [],
          index: fileIndex++,
        }
        currentHunk = null
        hunkIndex = 0
      }
    }

    // Hunk header: '@@ -1,5 +1,6 @@'
    if (currentFile && line.startsWith('@@')) {
      // Save previous hunk
      if (currentHunk && currentFile.hunks) {
        currentFile.hunks.push(currentHunk as Hunk)
      }

      // Parse hunk header
      const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (hunkMatch) {
        lineNumberOld = parseInt(hunkMatch[1], 10)
        lineNumberNew = parseInt(hunkMatch[3], 10)

        currentHunk = {
          header: line,
          lines: [],
          index: hunkIndex++,
        }
      }
    }

    // Diff line
    if (currentFile && currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      if (line.startsWith('\\')) {
        // Skip "\ No newline at end of file"
        continue
      }

      const prefix = line[0]
      const content = line.slice(1)
      let type: 'add' | 'remove' | 'context'

      if (prefix === '+') {
        type = 'add'
      } else if (prefix === '-') {
        type = 'remove'
      } else {
        type = 'context'
      }

      const diffLine: DiffLine = {
        id: `${currentFile.index}-${hunkIndex}-${lineId++}`,
        content,
        type,
        oldLineNumber: type === 'add' ? -1 : lineNumberOld++,
        newLineNumber: type === 'remove' ? -1 : lineNumberNew++,
        fileIndex: currentFile.index!,
        hunkIndex: hunkIndex - 1,
      }

      if (type !== 'add') {
        lineNumberOld++
      }
      if (type !== 'remove') {
        lineNumberNew++
      }

      currentHunk.lines!.push(diffLine)
      flatLines.push(diffLine)
    }
  }

  // Save final file and hunk
  if (currentHunk && currentFile && currentFile.hunks) {
    currentFile.hunks.push(currentHunk as Hunk)
  }
  if (currentFile) {
    files.push(currentFile as FileDiff)
  }

  return {
    id,
    from,
    to,
    files,
    flatLines,
    createdAt: new Date(),
  }
}

/**
 * Create a jsdiff-based parser instance
 */
export const createJsDiffParser = (): DiffParser => {
  return new JsDiffParser()
}
