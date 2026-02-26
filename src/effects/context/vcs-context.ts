import * as Effect from 'effect'
import { VCSAdapter } from '~/adapters/vcs/vcs.interface'

export class VCSContext extends Effect.Tag<VCSContext>()('VCSContext') {
  readonly service: VCSAdapter = undefined!
}
