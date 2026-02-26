import * as Effect from 'effect'
import { Diff, FileDiff, Hunk, Line } from '~/lib/types'

/**
 * Diff parser interface for parsing unified diff format
 */
export interface DiffParser {
  /**
   * Parse unified diff format into structured Diff object
   */
  parse(rawDiff: string, id: string, from: string, to: string): Effect.Effect<Diff>
}

export class DiffParserTag extends Effect.Tag<DiffParserTag>()('DiffParser') {
  readonly service: DiffParser = undefined!
}
