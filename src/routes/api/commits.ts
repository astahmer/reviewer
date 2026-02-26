import { createFileRoute } from '@tanstack/react-router'
import { getCommitList } from '~/server/diff-reviewer.start'

export const Route = createFileRoute('/api/commits')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url)
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
          const repoPath = url.searchParams.get('repoPath') || undefined

          const commits = await getCommitList(limit, repoPath)
          return Response.json(commits)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch commits'
          console.error('Error in /api/commits:', error)
          return Response.json({ error: message }, { status: 500 })
        }
      },
    },
  },
})
