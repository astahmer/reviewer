import { FC, useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Line, CommitInfo, Diff } from '~/lib/types'
import { DiffViewer } from '~/components/diff-viewer'

const REPO_STORAGE_KEY = 'selectedRepoPath'
const CUSTOM_PATHS_KEY = 'customSearchPaths'
const CONTROLS_COLLAPSED_KEY = 'controlsCollapsed'

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
  const [controlsCollapsed, setControlsCollapsed] = useState(true)

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
    const savedCollapsed = localStorage.getItem(CONTROLS_COLLAPSED_KEY)
    if (savedCollapsed) {
      setControlsCollapsed(JSON.parse(savedCollapsed))
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

  // Fetch branches
  const {
    data: branches = [],
    isLoading: branchesLoading,
  } = useQuery({
    queryKey: ['branches', selectedRepo?.path],
    queryFn: async () => {
      const url = new URL('/api/branches', window.location.origin)
      if (selectedRepo) url.searchParams.set('repoPath', selectedRepo.path)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch branches')
      return (await response.json()) as string[]
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

  const toggleControlsCollapsed = () => {
    const newState = !controlsCollapsed
    setControlsCollapsed(newState)
    localStorage.setItem(CONTROLS_COLLAPSED_KEY, JSON.stringify(newState))
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Compact Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-gray-900">Git Diff Reviewer</h1>
          {selectedRepo && (
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-xs text-gray-500">{selectedRepo.name}</span>
              <span className="inline-flex items-center rounded bg-blue-50 px-2 py-1 font-mono text-xs font-medium text-blue-700">
                {currentBranch}
              </span>
            </div>
          )}
          <button
            onClick={toggleControlsCollapsed}
            className="ml-auto rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            {controlsCollapsed ? '▼ Show' : '▲ Hide'} Controls
          </button>
        </div>
      </header>

      {/* Collapsible Controls Section */}
      {!controlsCollapsed && (
        <div className="border-b border-gray-200 bg-white p-3">
          {/* Repository & Custom Paths */}
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Repository</label>
              <select
                value={selectedRepo?.path || ''}
                onChange={(e) => {
                  const repo = repositories.find((r) => r.path === e.target.value)
                  if (repo) handleRepoChange(repo)
                }}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                disabled={reposLoading}
              >
                <option value="">Select a repository...</option>
                {repositories.map((repo: Repository) => (
                  <option key={repo.path} value={repo.path}>
                    {repo.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedRepo && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={currentBranch}
                  disabled={branchesLoading}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-50"
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedRepo && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Add Custom Path</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomPath()}
                    placeholder="Path..."
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={addCustomPath}
                    className="rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Custom Paths Tags */}
          {customPaths.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {customPaths.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs"
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

          {/* Commit Selection */}
          {selectedRepo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From Commit</label>
                <select
                  value={selectedFromCommit}
                  onChange={(e) => setSelectedFromCommit(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="HEAD~1">HEAD~1 (previous)</option>
                  {commits.map((commit: CommitInfo) => (
                    <option key={commit.hash} value={commit.hash}>
                      {commit.hash.slice(0, 7)} - {commit.message}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">To Commit</label>
                <select
                  value={selectedToCommit}
                  onChange={(e) => setSelectedToCommit(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
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
          )}

          {/* Error Display */}
          {(commitsError || diffError) && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
              {commitsError instanceof Error
                ? commitsError.message
                : diffError instanceof Error
                  ? diffError.message
                  : 'An error occurred'}
            </div>
          )}
        </div>
      )}

      {/* Main Diff Viewer - Takes up most of the screen */}
      <main className="flex-1 min-h-0 p-2 overflow-hidden">
        {!selectedRepo ? (
          <div className="h-full rounded border border-gray-200 bg-white flex items-center justify-center text-gray-600 text-sm">
            Select a repository to get started.
          </div>
        ) : commitsLoading || diffLoading ? (
          <div className="h-full rounded border border-gray-200 bg-white flex flex-col items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
            <p className="mt-2 text-sm text-gray-600">Loading diff...</p>
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
          <div className="h-full rounded border border-gray-200 bg-white flex items-center justify-center text-gray-600 text-sm">
            No diff available for the selected commits.
          </div>
        )}
      </main>
    </div>
  )
}
