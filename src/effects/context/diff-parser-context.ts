import * as Effect from 'effect'
import { DiffParser } from '~/adapters/diff-parser/types'

export class DiffParserContext extends Effect.Tag<DiffParserContext>()('DiffParserContext') {
  readonly service: DiffParser = undefined!
}
