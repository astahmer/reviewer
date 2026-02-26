import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Git Diff Reviewer</h1>
        </header>

        <main className="p-6">
          <p className="text-gray-600">Welcome! Phase 1 foundation setup is complete.</p>
          <p className="mt-2 text-sm text-gray-500">
            Next: Implement diff processing, caching, and virtual scrolling.
          </p>
        </main>
      </div>
    </QueryClientProvider>
  )
}
