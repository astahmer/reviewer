import { Diff, FileDiff, Line } from '~/lib/types'

/**
 * Convert nested diff structure to flat array of lines for virtualization
 * Already done during parsing, but this utility is for any re-flattening if needed
 */
export function flattenDiffForVirtualization(diff: Diff): Line[] {
  return diff.flatLines
}

/**
 * Get file headers to display in the virtual list
 * Useful for showing file boundaries while scrolling
 */
export interface FlattendLineWithMetadata extends Line {
  fileInfo?: {
    fileName: string
    status: string
  }
}

/**
 * Prepare diff lines with file metadata for rendering
 */
export function enrichLinesWithFileMetadata(diff: Diff): FlattendLineWithMetadata[] {
  const fileMap = new Map<number, FileDiff>()
  diff.files.forEach((file) => {
    fileMap.set(file.index, file)
  })

  return diff.flatLines.map((line) => {
    const file = fileMap.get(line.fileIndex)
    return {
      ...line,
      fileInfo: file
        ? {
            fileName: file.newPath || file.oldPath,
            status: file.status,
          }
        : undefined,
    }
  })
}

/**
 * Get line ranges for each file (start and end indices in flat array)
 */
export function getFileLineRanges(
  diff: Diff,
): Array<{ fileIndex: number; fileName: string; startLine: number; endLine: number }> {
  const ranges: Array<{ fileIndex: number; fileName: string; startLine: number; endLine: number }> = []

  let currentFileIndex = -1
  let startLine = 0

  diff.flatLines.forEach((line, index) => {
    if (line.fileIndex !== currentFileIndex) {
      if (currentFileIndex !== -1) {
        const file = diff.files.find((f) => f.index === currentFileIndex)!
        ranges.push({
          fileIndex: currentFileIndex,
          fileName: file.newPath || file.oldPath,
          startLine,
          endLine: index - 1,
        })
      }
      currentFileIndex = line.fileIndex
      startLine = index
    }
  })

  // Add last file
  if (currentFileIndex !== -1) {
    const file = diff.files.find((f) => f.index === currentFileIndex)!
    ranges.push({
      fileIndex: currentFileIndex,
      fileName: file.newPath || file.oldPath,
      startLine,
      endLine: diff.flatLines.length - 1,
    })
  }

  return ranges
}
