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

type RefValue = { type: 'commit'; value: string } | { type: 'branch'; value: string }

export const HomePage: FC = () => {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedFrom, setSelectedFrom] = useState<RefValue>({ type: 'commit', value: 'HEAD~1' })
  const [selectedTo, setSelectedTo] = useState<RefValue>({ type: 'commit', value: 'HEAD' })
  const [customPathInput, setCustomPathInput] = useState('')
  const [customPaths, setCustomPaths] = useState<string[]>([])
  const [controlsCollapsed, setControlsCollapsed] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(REPO_STORAGE_KEY)
    if (saved) {
      try {
        setSelectedRepo(JSON.parse(saved))
      } catch {
      }
    }
    const savedPaths = localStorage.getItem(CUSTOM_PATHS_KEY)
    if (savedPaths) {
      try {
        setCustomPaths(JSON.parse(savedPaths))
      } catch {
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

  const fromValue = selectedFrom.type === 'branch' ? selectedFrom.value : selectedFrom.value
  const toValue = selectedTo.type === 'branch' ? selectedTo.value : selectedTo.value

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useQuery({
    queryKey: ['diff', fromValue, toValue, selectedRepo?.path],
    queryFn: async () => {
      const url = new URL('/api/diff', window.location.origin)
      url.searchParams.set('from', fromValue)
      url.searchParams.set('to', toValue)
      if (selectedRepo) url.searchParams.set('repoPath', selectedRepo.path)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch diff')
      return (await response.json()) as Diff
    },
    enabled: !!selectedRepo && !!fromValue && !!toValue,
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

  const getRefDisplay = (ref: RefValue) => {
    if (ref.type === 'branch') {
      return { label: ref.value, sublabel: 'branch' }
    }
    const info = commits.find(c => c.hash.startsWith(ref.value.slice(0, 7)) || ref.value === c.hash)
    if (ref.value === 'HEAD~1' || ref.value === 'HEAD') {
      return { label: ref.value, sublabel: info?.message || '' }
    }
    return {
      label: ref.value.slice(0, 7),
      sublabel: info?.message || ''
    }
  }

  const fromDisplay = getRefDisplay(selectedFrom)
  const toDisplay = getRefDisplay(selectedTo)

  const renderRefSelect = (
    label: string,
    value: RefValue,
    onChange: (v: RefValue) => void
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value.type === 'branch' ? `branch:${value.value}` : `commit:${value.value}`}
        onChange={(e) => {
          const val = e.target.value
          if (val.startsWith('branch:')) {
            onChange({ type: 'branch', value: val.replace('branch:', '') })
          } else {
            onChange({ type: 'commit', value: val.replace('commit:', '') })
          }
        }}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <optgroup label="Branches">
          {branches.map((branch) => (
            <option key={`branch:${branch}`} value={`branch:${branch}`}>
              {branch}
            </option>
          ))}
        </optgroup>
        <optgroup label="Commits">
          <option value="commit:HEAD~1">HEAD~1 (previous)</option>
          <option value="commit:HEAD">HEAD (current)</option>
          {commits.map((commit: CommitInfo) => (
            <option key={`commit:${commit.hash}`} value={`commit:${commit.hash}`}>
              {commit.hash.slice(0, 7)} - {commit.message}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Git Diff Reviewer</h1>

            <select
              value={selectedRepo?.path || ''}
              onChange={(e) => {
                const repo = repositories.find((r) => r.path === e.target.value)
                if (repo) handleRepoChange(repo)
              }}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              disabled={reposLoading}
            >
              <option value="">Select repository...</option>
              {repositories.map((repo: Repository) => (
                <option key={repo.path} value={repo.path}>
                  {repo.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRepo && diff && (
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <span
                className="font-mono cursor-pointer group relative hover:text-blue-600"
                title={fromDisplay.sublabel}
              >
                {fromDisplay.label}
              </span>
              <span className="text-gray-400">→</span>
              <span
                className="font-mono cursor-pointer group relative hover:text-blue-600"
                title={toDisplay.sublabel}
              >
                {toDisplay.label}
              </span>
              {currentBranch && (
                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-1 font-mono text-xs font-medium text-blue-700 ml-2">
                  {currentBranch}
                </span>
              )}
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

      {!controlsCollapsed && (
        <div className="border-b border-gray-200 bg-white p-3">
          <div className="mb-3 grid grid-cols-2 gap-3">
            {selectedRepo && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Branch</label>
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

          {selectedRepo && (
            <div className="grid grid-cols-2 gap-3">
              {renderRefSelect('From', selectedFrom, setSelectedFrom)}
              {renderRefSelect('To', selectedTo, setSelectedTo)}
            </div>
          )}

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
            No diff available for the selected refs.
          </div>
        )}
      </main>
    </div>
  )
}
