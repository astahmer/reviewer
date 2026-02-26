import { FC, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Line, CommitInfo, Diff } from '~/lib/types'
import { DiffViewer } from '~/components/diff-viewer'

/**
 * Home page - main interface for reviewing diffs
 * Fetches commits, allows selection, and displays diff
 */
export const HomePage: FC = () => {
  const [selectedFromCommit, setSelectedFromCommit] = useState<string>('HEAD~1')
  const [selectedToCommit, setSelectedToCommit] = useState<string>('HEAD')

  // Fetch available commits
  const {
    data: commits = [],
    isLoading: commitsLoading,
    error: commitsError,
  } = useQuery({
    queryKey: ['commits'],
    queryFn: async () => {
      const response = await fetch('/api/commits?limit=20')
      if (!response.ok) throw new Error('Failed to fetch commits')
      return (await response.json()) as CommitInfo[]
    },
  })

  // Fetch current branch
  const { data: currentBranch = 'main' } = useQuery({
    queryKey: ['currentBranch'],
    queryFn: async () => {
      const response = await fetch('/api/current-branch')
      if (!response.ok) throw new Error('Failed to fetch branch')
      return response.text()
    },
  })

  // Fetch diff based on selected commits
  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useQuery({
    queryKey: ['diff', selectedFromCommit, selectedToCommit],
    queryFn: async () => {
      const response = await fetch(
        `/api/diff?from=${encodeURIComponent(selectedFromCommit)}&to=${encodeURIComponent(selectedToCommit)}`,
      )
      if (!response.ok) throw new Error('Failed to fetch diff')
      return (await response.json()) as Diff
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Git Diff Reviewer</h1>
          <div className="text-sm text-gray-600">
            Branch: <span className="font-mono font-semibold text-gray-900">{currentBranch}</span>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">From Commit</label>
            <select
              value={selectedFromCommit}
              onChange={(e) => setSelectedFromCommit(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="HEAD~1">HEAD~1 (previous)</option>
              {commits.map((commit: CommitInfo) => (
                <option key={commit.hash} value={commit.hash}>
                  {commit.hash.slice(0, 7)} - {commit.message}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">To Commit</label>
            <select
              value={selectedToCommit}
              onChange={(e) => setSelectedToCommit(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="HEAD">HEAD (current)</option>
              {commits.map((commit: CommitInfo) => (
                <option key={commit.hash} value={commit.hash}>
                  {commit.hash.slice(0, 7)} - {commit.message}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(commitsError || diffError) && (
          <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {commitsError instanceof Error
              ? commitsError.message
              : diffError instanceof Error
                ? diffError.message
                : 'An error occurred'}
          </div>
        )}
      </div>

      {/* Diff Viewer */}
      <main className="p-6">
        {commitsLoading || diffLoading ? (
          <div className="rounded border border-gray-200 bg-white p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
            <p className="mt-3 text-gray-600">Loading diff...</p>
          </div>
        ) : diff ? (
          <DiffViewer
            diff={diff}
            highlightedIds={new Set()}
            onLineSelect={(line: Line) => {
              console.log('Selected line:', line)
            }}
            defaultMode="unified"
          />
        ) : (
          <div className="rounded border border-gray-200 bg-white p-8 text-center text-gray-600">
            No diff available for the selected commits.
          </div>
        )}
      </main>
    </div>
  )
}
