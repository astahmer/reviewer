import { FC, useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Line, CommitInfo, Diff } from '~/lib/types'
import { DiffViewer } from '~/components/diff-viewer'

const REPO_STORAGE_KEY = 'selectedRepoPath'
const CUSTOM_PATHS_KEY = 'customSearchPaths'

interface Repository {
  path: string
  name: string
}

/**
 * Home page - main interface for reviewing diffs
 * Fetches commits, allows selection, and displays diff
 */
export const HomePage: FC = () => {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedFromCommit, setSelectedFromCommit] = useState<string>('HEAD~1')
  const [selectedToCommit, setSelectedToCommit] = useState<string>('HEAD')
  const [customPathInput, setCustomPathInput] = useState('')
  const [customPaths, setCustomPaths] = useState<string[]>([])

  // Load saved repo and custom paths from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(REPO_STORAGE_KEY)
    if (saved) {
      try {
        setSelectedRepo(JSON.parse(saved))
      } catch {
        // Invalid JSON, ignore
      }
    }
    const savedPaths = localStorage.getItem(CUSTOM_PATHS_KEY)
    if (savedPaths) {
      try {
        setCustomPaths(JSON.parse(savedPaths))
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [])

  const allSearchPaths = useMemo(() => {
    const defaults = ['/Users/astahmer/dev', '/Users/astahmer/projects']
    return [...customPaths, ...defaults.filter(d => !customPaths.includes(d))]
  }, [customPaths])

  // Fetch available repositories
  const {
    data: repositories = [],
    isLoading: reposLoading,
  } = useQuery({
    queryKey: ['repositories', customPaths],
    queryFn: async () => {
      const params = new URLSearchParams()
      allSearchPaths.forEach(p => params.append('basePath', p))
      const response = await fetch(`/api/repositories?${params}`)
      if (!response.ok) throw new Error('Failed to fetch repositories')
      return (await response.json()) as Repository[]
    },
  })

  const addCustomPath = () => {
    const path = customPathInput.trim()
    if (path && !customPaths.includes(path)) {
      const newPaths = [...customPaths, path]
      setCustomPaths(newPaths)
      localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths))
      setCustomPathInput('')
    }
  }

  const removeCustomPath = (path: string) => {
    const newPaths = customPaths.filter(p => p !== path)
    setCustomPaths(newPaths)
    localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(newPaths))
  }

  // Fetch available commits
  const {
    data: commits = [],
    isLoading: commitsLoading,
    error: commitsError,
  } = useQuery({
    queryKey: ['commits', selectedRepo?.path],
    queryFn: async () => {
      const url = new URL('/api/commits', window.location.origin)
      if (selectedRepo) url.searchParams.set('repoPath', selectedRepo.path)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch commits')
      return (await response.json()) as CommitInfo[]
    },
    enabled: !!selectedRepo,
  })

  // Fetch current branch
  const { data: currentBranch = 'main' } = useQuery({
    queryKey: ['currentBranch', selectedRepo?.path],
    queryFn: async () => {
      const url = new URL('/api/current-branch', window.location.origin)
      if (selectedRepo) url.searchParams.set('repoPath', selectedRepo.path)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch branch')
      return response.text()
    },
    enabled: !!selectedRepo,
  })

  // Fetch diff based on selected commits
  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useQuery({
    queryKey: ['diff', selectedFromCommit, selectedToCommit, selectedRepo?.path],
    queryFn: async () => {
      const url = new URL('/api/diff', window.location.origin)
      url.searchParams.set('from', selectedFromCommit)
      url.searchParams.set('to', selectedToCommit)
      if (selectedRepo) url.searchParams.set('repoPath', selectedRepo.path)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch diff')
      return (await response.json()) as Diff
    },
    enabled: !!selectedRepo && !!selectedFromCommit && !!selectedToCommit,
  })

  const handleRepoChange = (repo: Repository) => {
    setSelectedRepo(repo)
    localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repo))
  }

  return (
    <div className="min-h-screen bg-gray-50 h-full flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Git Diff Reviewer</h1>
        </div>
      </header>

      {/* Repository Selector */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Repository</label>
            <select
              value={selectedRepo?.path || ''}
              onChange={(e) => {
                const repo = repositories.find((r) => r.path === e.target.value)
                if (repo) handleRepoChange(repo)
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              disabled={reposLoading}
            >
              <option value="">Select a repository...</option>
              {repositories.map((repo: Repository) => (
                <option key={repo.path} value={repo.path}>
                  {repo.name} ({repo.path})
                </option>
              ))}
            </select>
          </div>
          {selectedRepo && (
            <div className="text-sm text-gray-600 self-end pb-2">
              Branch: <span className="font-mono font-semibold text-gray-900">{currentBranch}</span>
            </div>
          )}
        </div>

        {/* Custom Search Paths */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={customPathInput}
            onChange={(e) => setCustomPathInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomPath()}
            placeholder="Add custom search path..."
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={addCustomPath}
            className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            Add
          </button>
        </div>
        {customPaths.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {customPaths.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs"
              >
                {p}
                <button
                  onClick={() => removeCustomPath(p)}
                  className="text-gray-500 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Controls - only show when repo is selected */}
      {selectedRepo && (
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
      )}

      {/* Diff Viewer */}
      <main className="flex-1 p-6 min-h-0 h-full">
        {!selectedRepo ? (
          <div className="rounded border border-gray-200 bg-white p-8 text-center text-gray-600">
            Select a repository to get started.
          </div>
        ) : commitsLoading || diffLoading ? (
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
