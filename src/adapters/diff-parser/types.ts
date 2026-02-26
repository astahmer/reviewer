import { Context, Effect } from 'effect'
import { DiffParseError } from '~/lib/errors'
import { Diff } from '~/lib/types'

/**
 * Diff parser interface for parsing unified diff format
 */
export interface DiffParser {
  /**
   * Parse unified diff format into structured Diff object
   */
  parse(rawDiff: string, id: string, from: string, to: string): Effect.Effect<Diff, DiffParseError>
}

export class DiffParserContext extends Context.Tag('DiffParserContext')<DiffParserContext, DiffParser>() {
}
