import * as Effect from 'effect'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { GIT_DIFF_TIMEOUT_MS } from '~/lib/constants'
import { VCSAdapter } from './vcs.interface'

const execAsync = promisify(exec)

/**
 * Git local VCS adapter
 * Executes git commands to fetch diffs and commits
 */
export class GitLocalAdapter implements VCSAdapter {
  constructor(private repoPath: string = process.cwd()) {}

  getDiff(from: string, to: string, options?: { ignoreWhitespace?: boolean }): Effect.Effect<string> {
    return Effect.gen(function* () {
      try {
        const whitespaceFlag = options?.ignoreWhitespace ? '--ignore-all-space' : ''
        const command = `git diff ${whitespaceFlag} ${from}..${to}`

        const { stdout } = yield* Effect.tryPromise(() =>
          Promise.race([
            execAsync(command, { cwd: this.repoPath }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Git diff timeout')), GIT_DIFF_TIMEOUT_MS),
            ),
          ]),
        )

        return stdout
      } catch (error) {
        return yield* Effect.fail(new Error(`Failed to get diff: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
  }

  getCommits(limit: number = 20): Effect.Effect<Array<{ hash: string; message: string; author: string; date: Date }>> {
    return Effect.gen(function* () {
      try {
        const format = '%H%n%s%n%an%n%ai'
        const command = `git log --pretty=format:"${format}" -n ${limit}`

        const { stdout } = yield* Effect.tryPromise(() => execAsync(command, { cwd: this.repoPath }))

        const lines = stdout.trim().split('\n')
        const commits = []

        for (let i = 0; i < lines.length; i += 4) {
          if (i + 3 < lines.length) {
            commits.push({
              hash: lines[i],
              message: lines[i + 1],
              author: lines[i + 2],
              date: new Date(lines[i + 3]),
            })
          }
        }

        return commits
      } catch (error) {
        return yield* Effect.fail(new Error(`Failed to get commits: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
  }

  getCurrentBranch(): Effect.Effect<string> {
    return Effect.gen(function* () {
      try {
        const { stdout } = yield* Effect.tryPromise(() =>
          execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.repoPath }),
        )
        return stdout.trim()
      } catch (error) {
        return yield* Effect.fail(
          new Error(`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`),
        )
      }
    })
  }

  getBranches(): Effect.Effect<string[]> {
    return Effect.gen(function* () {
      try {
        const { stdout } = yield* Effect.tryPromise(() =>
          execAsync('git branch --list', { cwd: this.repoPath }),
        )
        const branches = stdout
          .trim()
          .split('\n')
          .map((line) => line.replace(/^\*?\s+/, ''))
          .filter((line) => line.length > 0)
        return branches
      } catch (error) {
        return yield* Effect.fail(new Error(`Failed to get branches: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
  }
}

/**
 * Create a Git local adapter instance
 */
export const createGitLocalAdapter = (repoPath?: string): VCSAdapter => {
  return new GitLocalAdapter(repoPath)
}
