import { Effect } from 'effect'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { GIT_DIFF_TIMEOUT_MS } from '~/lib/constants'
import { VCSError } from '~/lib/errors'
import { VCSAdapter } from './vcs.interface'

const execAsync = promisify(exec)

/**
 * Git local VCS adapter
 * Executes git commands to fetch diffs and commits
 */
export class GitLocalAdapter implements VCSAdapter {
  constructor(private _repoPath: string = process.cwd()) {}

  getDiff(from: string, to: string, options?: { ignoreWhitespace?: boolean }): Effect.Effect<string, VCSError> {
    const repoPath = this._repoPath
    const whitespaceFlag = options?.ignoreWhitespace ? '--ignore-all-space' : ''
    const command = `git diff ${whitespaceFlag} ${from}..${to}`

    return Effect.tryPromise({
      try: () =>
        Promise.race([
          execAsync(command, { cwd: repoPath }).then(({ stdout }) => stdout),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Git diff timeout')), GIT_DIFF_TIMEOUT_MS),
          ),
        ]),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get diff: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    })
  }

  getCommits(limit: number = 20): Effect.Effect<Array<{ hash: string; message: string; author: string; date: Date }>, VCSError> {
    const repoPath = this._repoPath
    const format = '%H%n%s%n%an%n%ai'
    const command = `git log --pretty=format:"${format}" -n ${limit}`

    return Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(command, { cwd: repoPath })
        const lines = stdout.trim().split('\n')
        const commits: Array<{ hash: string; message: string; author: string; date: Date }> = []

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
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get commits: ${error instanceof Error ? error.message : String(error)}`,
          command,
        }),
    })
  }

  getCurrentBranch(): Effect.Effect<string, VCSError> {
    const repoPath = this._repoPath

    return Effect.tryPromise({
      try: () => execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }).then(({ stdout }) => stdout.trim()),
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
          command: 'git rev-parse --abbrev-ref HEAD',
        }),
    })
  }

  getBranches(): Effect.Effect<string[], VCSError> {
    const repoPath = this._repoPath

    return Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync('git branch --list', { cwd: repoPath })
        return stdout
          .trim()
          .split('\n')
          .map((line) => line.replace(/^\*?\s+/, ''))
          .filter((line) => line.length > 0)
      },
      catch: (error: unknown) =>
        new VCSError({
          message: `Failed to get branches: ${error instanceof Error ? error.message : String(error)}`,
          command: 'git branch --list',
        }),
    })
  }
}

/**
 * Create a Git local adapter instance
 */
export const createGitLocalAdapter = (repoPath?: string): VCSAdapter => {
  return new GitLocalAdapter(repoPath)
}
